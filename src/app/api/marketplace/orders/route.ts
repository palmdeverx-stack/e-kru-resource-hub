import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { STRIPE_MINIMUM_THB } from 'src/sections/marketplace/shared/payment';
import { money, getFinanceSettings } from 'src/sections/marketplace/admin/server/finance';
import { verifyShippingQuote } from 'src/sections/marketplace/shipping/server/quote-token';
import { captureOrderEvidence } from 'src/sections/marketplace/checkout/server/order-evidence';
import { getStripe, isStripeConfigured } from 'src/sections/marketplace/checkout/server/stripe';
import { resolveReferralAttribution } from 'src/sections/marketplace/referrals/server/referrals';
import { withPublicSystemStoreFlag } from 'src/sections/marketplace/seller/server/public-seller';
import { recordShippingCustomerCharge } from 'src/sections/marketplace/shipping/server/accounting';
import { getEligibleLicenseSchools } from 'src/sections/marketplace/checkout/server/school-targets';
import { createSchoolOnboardingForPaidOrders } from 'src/sections/marketplace/checkout/server/school-onboarding';
import {
  withMediaUrls,
  withoutFileScanMetadata,
} from 'src/sections/marketplace/seller/server/product-media';
import { grantFeatureEntitlementsForOrders } from 'src/sections/marketplace/checkout/server/grant-feature-entitlements';
import {
  canViewSellerTools,
  SELLER_TOOLS_CATEGORY,
} from 'src/sections/marketplace/seller/server/seller-tools-access';
import {
  hasPurchasedProduct,
  getProductPurchaseAccess,
} from 'src/sections/marketplace/catalog/server/product-engagement';
import {
  getMarketplaceShippingConfig,
  isMarketplaceShippingEnabledForOfficialSeller,
} from 'src/sections/marketplace/shipping/server/config';

type RequestedItem = {
  productId: string;
};

type SalesDealRow = {
  id: string;
  product_id: string;
  school_id: string | null;
  negotiated_price: number;
  expires_at: string;
};

type OrderProduct = {
  id: string;
  title: string;
  title_en: string | null;
  short_description: string | null;
  short_description_en: string | null;
  file_url: string | null;
  cover_url: string | null;
  resource_type: string;
  license_scope: 'individual' | 'school' | 'teacher' | 'platform' | null;
  images?: Array<{ storage_bucket: string; storage_path: string; [key: string]: unknown }>;
  files?: Array<{ storage_bucket: string; storage_path: string; [key: string]: unknown }>;
} | null;

async function cleanupCheckout(paymentSessionId: string) {
  await supabaseAdmin
    .from('marketplace_orders')
    .delete()
    .eq('payment_session_id', paymentSessionId);
  await supabaseAdmin.from('marketplace_payment_sessions').delete().eq('id', paymentSessionId);
}

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const { data: orders, error } = await supabaseAdmin
    .from('marketplace_orders')
    .select(
      '*, seller:marketplace_sellers(id, display_name, slug, logo_url, owner_role), items:marketplace_order_items(*, product:marketplace_products(id, title, title_en, short_description, short_description_en, file_url, cover_url, resource_type, license_scope, images:marketplace_product_images(*), files:marketplace_product_files(*)))'
    )
    .eq('buyer_id', caller.sub)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const safeOrders = await Promise.all(
    (orders ?? []).map(async (order) => {
      const isPaid = ['paid', 'completed'].includes(order.status);
      const items = await Promise.all(
        (order.items ?? []).map(async (item: Record<string, unknown>) => {
          const product = item.product as OrderProduct;
          if (!product) return item;
          const media = await withMediaUrls({
            images: product.images ?? [],
            files: [],
            cover_url: product.cover_url,
            seller: order.seller,
          });
          if (!isPaid) {
            return {
              ...item,
              product: {
                ...product,
                images: media.images,
                cover_url: media.cover_url,
                file_url: null,
                files: [],
              },
            };
          }
          const files = (product.files ?? []).map((file) => ({
            ...withoutFileScanMetadata(file),
            url: `/api/marketplace/downloads/${String(file.id)}?orderItemId=${String(item.id)}`,
          }));
          return {
            ...item,
            product: { ...product, images: media.images, cover_url: media.cover_url, files },
          };
        })
      );
      return { ...order, seller: withPublicSystemStoreFlag(order.seller), items };
    })
  );

  return NextResponse.json({ orders: safeOrders });
}

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }
  if (
    !(await isActionAllowed({
      request,
      action: 'marketplace-checkout',
      subject: caller.sub,
      maxAttempts: 10,
      windowSeconds: 60,
    }))
  ) {
    return NextResponse.json(
      { message: 'สร้างรายการชำระเงินบ่อยเกินไป กรุณารอสักครู่' },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  if (body?.acceptedPurchaseTerms !== true) {
    return NextResponse.json(
      { message: 'กรุณายอมรับข้อกำหนดการซื้อและนโยบายคืนเงินก่อนชำระเงิน' },
      { status: 400 }
    );
  }
  const requestedPaymentMethod = String(body?.paymentMethod ?? '');
  let requestedLicenseSchoolId = String(body?.licenseSchoolId ?? '').trim();
  const salesDealToken = String(body?.salesDealToken ?? '').trim();
  const shippingAddress = body?.shipping?.address ?? null;
  const requestedShippingQuotes: string[] = Array.isArray(body?.shipping?.quoteTokens)
    ? body.shipping.quoteTokens.map(String)
    : [];
  const requestedItems: RequestedItem[] = Array.isArray(body?.items) ? body.items : [];
  const uniqueProductIds = [...new Set(requestedItems.map((item) => String(item.productId)))];

  if (!uniqueProductIds.length || !['promptpay', 'stripe'].includes(requestedPaymentMethod)) {
    return NextResponse.json(
      { message: 'รายการสินค้าหรือวิธีชำระเงินไม่ถูกต้อง' },
      { status: 400 }
    );
  }

  const { data: products, error: productError } = await supabaseAdmin
    .from('marketplace_products')
    .select(
      'id, seller_id, title, title_en, category, short_description, description, price, list_price, currency, status, resource_type, shipping_weight_grams, shipping_width_cm, shipping_length_cm, shipping_height_cm, grants_feature_key, grants_feature_keys, grants_plan_code, grant_duration_days, license_billing_cycle, license_scope, license_seat_count, license_max_teachers, license_max_students, license_max_school_admins, license_line_quota, purchase_benefits, purchase_benefits_html, seller:marketplace_sellers(owner_role, commission_rate_override, display_name, shipping_contact_name, shipping_phone, shipping_address_line, shipping_subdistrict, shipping_district, shipping_province, shipping_postal_code)'
    )
    .in('id', uniqueProductIds)
    .eq('status', 'published');

  if (productError || !products || products.length !== uniqueProductIds.length) {
    return NextResponse.json(
      { message: productError?.message ?? 'สินค้าบางรายการไม่พร้อมจำหน่าย' },
      { status: 400 }
    );
  }
  if (
    products.some((product) => product.category === SELLER_TOOLS_CATEGORY) &&
    !(await canViewSellerTools(caller.sub))
  ) {
    return NextResponse.json(
      { message: 'สินค้านี้จำหน่ายเฉพาะผู้ขายที่เปิดร้านแล้ว' },
      { status: 403 }
    );
  }

  let salesDeal: SalesDealRow | null = null;
  if (salesDealToken) {
    const { data: deal, error: dealError } = await supabaseAdmin
      .from('marketplace_sales_deals')
      .select('*')
      .eq('public_token', salesDealToken)
      .eq('accepted_by', caller.sub)
      .in('status', ['accepted', 'awaiting_payment'])
      .maybeSingle();
    if (
      dealError ||
      !deal ||
      uniqueProductIds.length !== 1 ||
      deal.product_id !== uniqueProductIds[0] ||
      new Date(deal.expires_at) <= new Date()
    ) {
      return NextResponse.json(
        { message: dealError?.message ?? 'ข้อเสนอขายไม่ถูกต้อง หมดอายุ หรือไม่ใช่บัญชีที่ยอมรับ' },
        { status: dealError ? 500 : 409 }
      );
    }
    salesDeal = deal as SalesDealRow;
    products[0].list_price = Math.max(
      Number(products[0].list_price ?? products[0].price),
      Number(products[0].price)
    );
    products[0].price = Number(deal.negotiated_price);
    requestedLicenseSchoolId = deal.school_id ?? requestedLicenseSchoolId;
  }

  const hasPlatformLicense = products.some(
    (product) => product.resource_type === 'feature_unlock' && product.license_scope === 'platform'
  );
  const recurringProducts = products.filter(
    (product) =>
      product.resource_type === 'feature_unlock' &&
      ['monthly', 'yearly'].includes(product.license_billing_cycle ?? 'one_time')
  );
  if (
    recurringProducts.length > 0 &&
    (products.length !== 1 || requestedPaymentMethod !== 'stripe' || salesDeal)
  ) {
    return NextResponse.json(
      {
        message: 'License ต่ออายุอัตโนมัติต้องซื้อครั้งละ 1 รายการและชำระด้วยบัตรผ่าน Stripe',
      },
      { status: 400 }
    );
  }
  if (hasPlatformLicense && caller.role !== 'master_admin') {
    return NextResponse.json(
      { message: 'เฉพาะ Master Admin เท่านั้นที่เปิด License สำหรับทั้งแพลตฟอร์มได้' },
      { status: 403 }
    );
  }
  const hasSchoolLicense = products.some(
    (product) =>
      product.resource_type === 'feature_unlock' &&
      ['school', 'teacher'].includes(product.license_scope)
  );
  if (hasSchoolLicense) {
    const eligibleSchools = await getEligibleLicenseSchools(caller);
    const canCreateSchoolAfterPayment =
      caller.role === 'marketplace_user' && !requestedLicenseSchoolId;
    if (
      !canCreateSchoolAfterPayment &&
      (!requestedLicenseSchoolId ||
        !eligibleSchools.some((school) => school.id === requestedLicenseSchoolId))
    ) {
      return NextResponse.json(
        {
          message:
            'กรุณาเลือกโรงเรียนที่คุณมีสิทธิ์เป็นผู้ดูแล หรือใช้บัญชีสมาชิกทั่วไปเพื่อสร้างโรงเรียนหลังชำระเงิน',
        },
        { status: 403 }
      );
    }
  }

  const purchaseAccess = await Promise.all(
    products.map(async (product) => {
      if (
        caller.role === 'marketplace_user' &&
        !requestedLicenseSchoolId &&
        product.resource_type === 'feature_unlock' &&
        ['school', 'teacher'].includes(product.license_scope)
      ) {
        const hasPurchased = await hasPurchasedProduct(product.id, caller.sub);
        return {
          product,
          access: {
            canPurchase: !hasPurchased,
            hasPurchased,
            accessExpiresAt: null,
            message: hasPurchased ? 'คุณซื้อ License นี้และกำลังรอสร้างโรงเรียน' : null,
          },
        };
      }
      return {
        product,
        access: await getProductPurchaseAccess({
          productId: product.id,
          buyerId: caller.sub,
          buyerRole: caller.role,
          schoolId: hasSchoolLicense ? requestedLicenseSchoolId : caller.schoolId,
          resourceType: product.resource_type,
          licenseScope: product.license_scope,
          featureKeys: product.grants_feature_keys,
          price: product.price,
          licenseBillingCycle: product.license_billing_cycle,
          grantDurationDays: product.grant_duration_days,
        }),
      };
    })
  );
  const unavailable = purchaseAccess.find(({ access }) => !access.canPurchase);
  if (unavailable) {
    return NextResponse.json(
      {
        message:
          unavailable.access.message ??
          `ไม่สามารถซื้อ “${unavailable.product.title}” ซ้ำได้ในขณะนี้`,
        productId: unavailable.product.id,
        accessExpiresAt: unavailable.access.accessExpiresAt,
      },
      { status: 409 }
    );
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const itemsBySeller = new Map<string, Array<(typeof products)[number] & { quantity: number }>>();

  for (const productId of uniqueProductIds) {
    const product = productMap.get(productId);
    if (!product) continue;
    const group = itemsBySeller.get(product.seller_id) ?? [];
    group.push({ ...product, quantity: 1 });
    itemsBySeller.set(product.seller_id, group);
  }

  const physicalProducts = products.filter((product) => product.resource_type === 'physical');
  const shippingQuotes = new Map<string, ReturnType<typeof verifyShippingQuote>>();
  if (physicalProducts.length) {
    const shippingConfig = await getMarketplaceShippingConfig();
    const unavailablePhysicalProduct = physicalProducts.find((product) => {
      const seller: any = Array.isArray(product.seller) ? product.seller[0] : product.seller;
      return !isMarketplaceShippingEnabledForOfficialSeller(shippingConfig, seller?.owner_role);
    });
    if (unavailablePhysicalProduct) {
      return NextResponse.json(
        { message: 'ระบบจัดส่งยังไม่เปิดใช้งานสำหรับร้านนี้' },
        { status: 409 }
      );
    }
    const addressValues = [
      shippingAddress?.name,
      shippingAddress?.phone,
      shippingAddress?.address,
      shippingAddress?.subdistrict,
      shippingAddress?.district,
      shippingAddress?.province,
      shippingAddress?.postalCode,
    ].map((value) => String(value ?? '').trim());
    if (
      addressValues.some((value) => !value) ||
      !/^0\d{8,9}$/.test(String(shippingAddress.phone).replace(/\D/g, '')) ||
      !/^\d{5}$/.test(String(shippingAddress.postalCode))
    ) {
      return NextResponse.json({ message: 'กรุณากรอกที่อยู่จัดส่งให้ครบถ้วน' }, { status: 400 });
    }
    try {
      requestedShippingQuotes.forEach((token) => {
        const quote = verifyShippingQuote(token);
        shippingQuotes.set(quote.sellerId, quote);
      });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : 'ค่าขนส่งไม่ถูกต้อง' },
        { status: 400 }
      );
    }
    const physicalSellerIds = [...new Set(physicalProducts.map((product) => product.seller_id))];
    if (
      physicalSellerIds.some((sellerId) => !shippingQuotes.has(sellerId)) ||
      shippingQuotes.size !== physicalSellerIds.length
    ) {
      return NextResponse.json({ message: 'กรุณาเลือกขนส่งให้ครบทุกร้าน' }, { status: 400 });
    }
  } else if (requestedShippingQuotes.length) {
    return NextResponse.json({ message: 'รายการนี้ไม่มีสินค้าที่ต้องจัดส่ง' }, { status: 400 });
  }

  const finance = await getFinanceSettings();
  const productTotal = money(
    [...itemsBySeller.values()].reduce(
      (sum, items) =>
        sum + items.reduce((subtotal, item) => subtotal + Number(item.price) * item.quantity, 0),
      0
    )
  );
  const shippingTotal = money(
    [...shippingQuotes.values()].reduce((sum, quote) => sum + quote.price, 0)
  );
  const checkoutTotal = money(productTotal + shippingTotal);
  const isFree = checkoutTotal === 0;

  if (!isFree && requestedPaymentMethod === 'stripe' && checkoutTotal < STRIPE_MINIMUM_THB) {
    return NextResponse.json(
      {
        message: `ระบบชำระเงินออนไลน์รองรับยอดขั้นต่ำ ฿${STRIPE_MINIMUM_THB.toFixed(
          2
        )} กรุณาเลือก PromptPay หรือเพิ่มสินค้าในตะกร้า`,
      },
      { status: 400 }
    );
  }

  if (
    !isFree &&
    requestedPaymentMethod === 'promptpay' &&
    (!finance.is_active || !finance.promptpay_id)
  ) {
    return NextResponse.json(
      { message: 'ระบบรับชำระ PromptPay ยังไม่เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ' },
      { status: 503 }
    );
  }
  if (
    !isFree &&
    requestedPaymentMethod === 'stripe' &&
    (!finance.stripe_enabled || !isStripeConfigured())
  ) {
    return NextResponse.json(
      {
        message:
          'ระบบชำระเงินออนไลน์อัตโนมัติยังไม่เปิดใช้งาน กรุณาเลือกช่องทางอื่นหรือติดต่อผู้ดูแลระบบ',
      },
      { status: 503 }
    );
  }

  const now = new Date();
  const availableAt = new Date(
    now.getTime() + Number(finance.hold_days) * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: paymentSession, error: sessionError } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .insert({
      buyer_id: caller.sub,
      amount: checkoutTotal,
      payment_method: isFree ? 'free' : requestedPaymentMethod,
      status: isFree ? 'verified' : 'pending_payment',
      promptpay_id_snapshot:
        !isFree && requestedPaymentMethod === 'promptpay' ? finance.promptpay_id : null,
      account_name_snapshot:
        !isFree && requestedPaymentMethod === 'promptpay' ? finance.promptpay_account_name : null,
      submitted_at: isFree ? now.toISOString() : null,
      reviewed_at: isFree ? now.toISOString() : null,
    })
    .select('*')
    .single();

  if (sessionError || !paymentSession) {
    return NextResponse.json(
      { message: sessionError?.message ?? 'ไม่สามารถเริ่มรายการชำระเงินได้' },
      { status: 500 }
    );
  }

  const createdOrders = [];
  for (const [sellerId, items] of itemsBySeller) {
    const referralAttribution = await resolveReferralAttribution(request, caller.sub, sellerId);
    const grossAmount = money(
      items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
    );
    const listAmount = money(
      items.reduce(
        (sum, item) =>
          sum + Math.max(Number(item.list_price ?? item.price), Number(item.price)) * item.quantity,
        0
      )
    );
    const discountAmount = money(Math.max(0, listAmount - grossAmount));
    const sellerRecord = Array.isArray(items[0]?.seller) ? items[0]?.seller[0] : items[0]?.seller;
    const commissionRate =
      sellerRecord?.owner_role === 'master_admin'
        ? 0
        : Number(sellerRecord?.commission_rate_override ?? finance.commission_rate);
    const platformFee = money((grossAmount * commissionRate) / 100);
    const sellerNet = money(grossAmount - platformFee);
    const shippingQuote = shippingQuotes.get(sellerId);
    const shippingAmount = money(shippingQuote?.price ?? 0);
    const { data: order, error: orderError } = await supabaseAdmin
      .from('marketplace_orders')
      .insert({
        buyer_id: caller.sub,
        seller_id: sellerId,
        payment_session_id: paymentSession.id,
        sales_deal_id: salesDeal?.id ?? null,
        license_school_id:
          hasSchoolLicense && requestedLicenseSchoolId ? requestedLicenseSchoolId : null,
        status: isFree ? 'paid' : 'pending_payment',
        total: money(grossAmount + shippingAmount),
        gross_amount: grossAmount,
        shipping_amount: shippingAmount,
        shipping_address_snapshot: shippingQuote ? shippingAddress : null,
        shipping_quote_snapshot: shippingQuote ?? null,
        discount_amount: discountAmount,
        commission_rate: commissionRate,
        platform_fee: platformFee,
        seller_net: sellerNet,
        paid_at: isFree ? now.toISOString() : null,
        available_at: isFree ? availableAt : null,
        currency: items[0]?.currency ?? 'THB',
        ...(referralAttribution ?? {}),
      })
      .select('*')
      .single();

    if (orderError || !order) {
      await cleanupCheckout(paymentSession.id);
      return NextResponse.json(
        { message: orderError?.message ?? 'ไม่สามารถสร้างคำสั่งซื้อได้' },
        { status: 500 }
      );
    }

    const { error: itemError } = await supabaseAdmin.from('marketplace_order_items').insert(
      items.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        title: item.title,
        unit_price: item.price,
        list_unit_price: Math.max(Number(item.list_price ?? item.price), Number(item.price)),
        quantity: item.quantity,
      }))
    );
    if (itemError) {
      await cleanupCheckout(paymentSession.id);
      return NextResponse.json({ message: itemError.message }, { status: 500 });
    }
    if (shippingQuote) {
      const sellerSnapshot: any = Array.isArray(items[0]?.seller)
        ? items[0]?.seller[0]
        : items[0]?.seller;
      const physicalItems = items.filter((item) => item.resource_type === 'physical');
      const sender = {
        name: sellerSnapshot?.shipping_contact_name,
        phone: sellerSnapshot?.shipping_phone,
        address: sellerSnapshot?.shipping_address_line,
        subdistrict: sellerSnapshot?.shipping_subdistrict,
        district: sellerSnapshot?.shipping_district,
        province: sellerSnapshot?.shipping_province,
        postalCode: sellerSnapshot?.shipping_postal_code,
      };
      const receiver = {
        name: String(shippingAddress.name).trim(),
        phone: String(shippingAddress.phone).replace(/\D/g, ''),
        address: String(shippingAddress.address).trim(),
        subdistrict: String(shippingAddress.subdistrict).trim(),
        district: String(shippingAddress.district).trim(),
        province: String(shippingAddress.province).trim(),
        postalCode: String(shippingAddress.postalCode).trim(),
      };
      const parcel = {
        name: physicalItems
          .map((item) => item.title)
          .join(', ')
          .slice(0, 200),
        weightGrams: physicalItems.reduce(
          (sum, item) => sum + Number(item.shipping_weight_grams),
          0
        ),
        widthCm: Math.max(...physicalItems.map((item) => Number(item.shipping_width_cm))),
        lengthCm: Math.max(...physicalItems.map((item) => Number(item.shipping_length_cm))),
        heightCm: physicalItems.reduce((sum, item) => sum + Number(item.shipping_height_cm), 0),
      };
      const { data: shipment, error: shipmentError } = await supabaseAdmin
        .from('marketplace_shipments')
        .insert({
          order_id: order.id,
          seller_id: sellerId,
          buyer_id: caller.sub,
          courier_code: shippingQuote.courierCode,
          courier_name: shippingQuote.courierName,
          service_name: shippingQuote.serviceName,
          shipping_fee: shippingAmount,
          quote_snapshot: shippingQuote,
          sender_snapshot: sender,
          receiver_snapshot: receiver,
          package_snapshot: parcel,
          idempotency_key: `order:${order.id}`,
        })
        .select('id')
        .single();
      if (shipmentError || !shipment) {
        await cleanupCheckout(paymentSession.id);
        return NextResponse.json(
          { message: shipmentError?.message ?? 'บันทึกข้อมูลจัดส่งไม่สำเร็จ' },
          { status: 500 }
        );
      }
      if (isFree) {
        try {
          await recordShippingCustomerCharge({
            shipmentId: shipment.id,
            orderId: order.id,
            amount: shippingAmount,
          });
        } catch (accountingError) {
          await cleanupCheckout(paymentSession.id);
          return NextResponse.json(
            {
              message:
                accountingError instanceof Error
                  ? `บันทึกบัญชีค่าจัดส่งไม่สำเร็จ: ${accountingError.message}`
                  : 'บันทึกบัญชีค่าจัดส่งไม่สำเร็จ',
            },
            { status: 500 }
          );
        }
      }
    }
    try {
      await captureOrderEvidence({
        request,
        caller,
        orderId: order.id,
        paymentSessionId: paymentSession.id,
        products: items,
      });
    } catch (evidenceError) {
      await cleanupCheckout(paymentSession.id);
      return NextResponse.json(
        {
          message:
            evidenceError instanceof Error
              ? `บันทึกหลักฐานคำสั่งซื้อไม่สำเร็จ: ${evidenceError.message}`
              : 'บันทึกหลักฐานคำสั่งซื้อไม่สำเร็จ',
        },
        { status: 500 }
      );
    }

    if (isFree) {
      await supabaseAdmin.from('marketplace_ledger_entries').insert([
        {
          order_id: order.id,
          seller_id: sellerId,
          account_scope: 'seller',
          entry_type: 'sale',
          amount: sellerNet,
          available_at: availableAt,
          description: 'รายได้จากคำสั่งซื้อสินค้าฟรี',
        },
        {
          order_id: order.id,
          seller_id: sellerId,
          account_scope: 'platform',
          entry_type: 'commission',
          amount: platformFee,
          available_at: now.toISOString(),
          description: 'ค่าธรรมเนียมแพลตฟอร์ม',
        },
      ]);
    }
    createdOrders.push(order);
  }

  let finalPaymentSession = paymentSession;
  if (isFree) {
    const orderIds = createdOrders.map((order) => String(order.id));
    await grantFeatureEntitlementsForOrders(orderIds);
    await createSchoolOnboardingForPaidOrders({
      paymentSessionId: paymentSession.id,
      buyerId: caller.sub,
      orderIds,
    });
    if (salesDeal) {
      await supabaseAdmin
        .from('marketplace_sales_deals')
        .update({ status: 'active', updated_at: now.toISOString() })
        .eq('id', salesDeal.id);
    }
  } else if (salesDeal) {
    await supabaseAdmin
      .from('marketplace_sales_deals')
      .update({ status: 'awaiting_payment', updated_at: now.toISOString() })
      .eq('id', salesDeal.id)
      .in('status', ['accepted', 'awaiting_payment']);
  }
  if (!isFree && requestedPaymentMethod === 'stripe') {
    try {
      const origin = new URL(request.url).origin;
      const { data: buyerForStripe } = await supabaseAdmin
        .from('app_users')
        .select('email')
        .eq('id', caller.sub)
        .maybeSingle();
      const recurringProduct = recurringProducts[0];
      const { data: previousSubscription } = recurringProduct
        ? await supabaseAdmin
            .from('marketplace_license_subscriptions')
            .select('stripe_customer_id')
            .eq('buyer_id', caller.sub)
            .not('stripe_customer_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : { data: null };
      const stripeCustomerId = previousSubscription?.stripe_customer_id ?? null;
      const stripeSession = await getStripe().checkout.sessions.create({
        mode: recurringProduct ? 'subscription' : 'payment',
        client_reference_id: paymentSession.id,
        ...(stripeCustomerId
          ? { customer: stripeCustomerId }
          : { customer_email: buyerForStripe?.email ?? undefined }),
        line_items: [
          ...[...itemsBySeller.values()]
            .flat()
            .filter((item) => Number(item.price) > 0)
            .map((item) => ({
              quantity: item.quantity,
              price_data: {
                currency: 'thb',
                unit_amount: Math.round(Number(item.price) * 100),
                ...(recurringProduct && {
                  recurring: {
                    interval:
                      recurringProduct.license_billing_cycle === 'yearly'
                        ? ('year' as const)
                        : ('month' as const),
                  },
                }),
                product_data: { name: item.title.slice(0, 120) },
              },
            })),
          ...[...shippingQuotes.values()]
            .filter((quote) => quote.price > 0)
            .map((quote) => ({
              quantity: 1,
              price_data: {
                currency: 'thb',
                unit_amount: Math.round(quote.price * 100),
                product_data: { name: `ค่าจัดส่ง ${quote.courierName}`.slice(0, 120) },
              },
            })),
        ],
        metadata: {
          marketplace_payment_session_id: paymentSession.id,
          buyer_id: caller.sub,
        },
        ...(recurringProduct
          ? {
              payment_method_types: ['card'] as const,
              subscription_data: {
                metadata: {
                  marketplace_payment_session_id: paymentSession.id,
                  marketplace_order_id: String(createdOrders[0]?.id ?? ''),
                  marketplace_product_id: recurringProduct.id,
                },
              },
            }
          : {
              payment_intent_data: {
                metadata: { marketplace_payment_session_id: paymentSession.id },
              },
            }),
        success_url: `${origin}/dashboard/payment/${paymentSession.id}?stripe=success`,
        cancel_url: `${origin}/dashboard/payment/${paymentSession.id}?stripe=cancelled`,
      });
      if (!stripeSession.url) throw new Error('Stripe ไม่ส่ง Checkout URL กลับมา');

      const { data: updatedSession, error: updateError } = await supabaseAdmin
        .from('marketplace_payment_sessions')
        .update({
          stripe_checkout_session_id: stripeSession.id,
          stripe_checkout_url: stripeSession.url,
          expires_at: new Date(stripeSession.expires_at * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentSession.id)
        .select('*')
        .single();
      if (updateError || !updatedSession) {
        await getStripe()
          .checkout.sessions.expire(stripeSession.id)
          .catch(() => undefined);
        throw updateError ?? new Error('บันทึกรายการชำระเงินออนไลน์ไม่สำเร็จ');
      }
      if (recurringProduct) {
        const { error: subscriptionError } = await supabaseAdmin
          .from('marketplace_license_subscriptions')
          .insert({
            buyer_id: caller.sub,
            product_id: recurringProduct.id,
            seller_id: recurringProduct.seller_id,
            initial_order_id: createdOrders[0].id,
            license_school_id: requestedLicenseSchoolId || null,
            billing_cycle: recurringProduct.license_billing_cycle,
            amount: checkoutTotal,
            currency: recurringProduct.currency ?? 'THB',
            stripe_checkout_session_id: stripeSession.id,
          });
        if (subscriptionError) {
          await getStripe()
            .checkout.sessions.expire(stripeSession.id)
            .catch(() => undefined);
          throw subscriptionError;
        }
      }
      finalPaymentSession = updatedSession;
    } catch (stripeError) {
      await cleanupCheckout(paymentSession.id);
      return NextResponse.json(
        {
          message:
            stripeError instanceof Error
              ? `สร้างรายการชำระเงินออนไลน์ไม่สำเร็จ: ${stripeError.message}`
              : 'สร้างรายการชำระเงินออนไลน์ไม่สำเร็จ',
        },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(
    {
      orders: createdOrders,
      paymentSession: { ...finalPaymentSession, orders: createdOrders },
    },
    { status: 201 }
  );
}
