import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { signShippingQuote } from 'src/sections/marketplace/shipping/server/quote-token';
import {
  getShippopRates,
  type ShippingAddress,
} from 'src/sections/marketplace/shipping/server/shippop-client';
import {
  getMarketplaceShippingConfig,
  isMarketplaceShippingEnabledForOfficialSeller,
} from 'src/sections/marketplace/shipping/server/config';

function normalizeAddress(value: any): ShippingAddress {
  return {
    name: String(value?.name ?? '').trim(),
    phone: String(value?.phone ?? '').replace(/\D/g, ''),
    address: String(value?.address ?? '').trim(),
    subdistrict: String(value?.subdistrict ?? '').trim(),
    district: String(value?.district ?? '').trim(),
    province: String(value?.province ?? '').trim(),
    postalCode: String(value?.postalCode ?? '').replace(/\D/g, ''),
  };
}

function validAddress(value: ShippingAddress) {
  return (
    Object.values(value).every(Boolean) &&
    /^0\d{8,9}$/.test(value.phone) &&
    /^\d{5}$/.test(value.postalCode)
  );
}

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  if (
    !(await isActionAllowed({
      request,
      action: 'marketplace-shipping-rates',
      subject: caller.sub,
      maxAttempts: 20,
      windowSeconds: 60,
    }))
  ) {
    return NextResponse.json(
      { message: 'คำนวณค่าขนส่งบ่อยเกินไป กรุณารอสักครู่' },
      { status: 429 }
    );
  }
  const shippingConfig = await getMarketplaceShippingConfig();
  if (!shippingConfig.enabled && !shippingConfig.officialEnabled) {
    return NextResponse.json({ message: 'ระบบจัดส่งยังไม่เปิดใช้งาน' }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const receiver = normalizeAddress(body?.address);
  const productIds = Array.isArray(body?.productIds)
    ? [...new Set<string>(body.productIds.map(String))]
    : [];
  if (!validAddress(receiver) || !productIds.length) {
    return NextResponse.json({ message: 'ที่อยู่หรือรายการสินค้าไม่ถูกต้อง' }, { status: 400 });
  }
  const { data: products, error } = await supabaseAdmin
    .from('marketplace_products')
    .select(
      'id,seller_id,title,status,resource_type,shipping_weight_grams,shipping_width_cm,shipping_length_cm,shipping_height_cm,seller:marketplace_sellers(id,display_name,owner_role,shipping_contact_name,shipping_phone,shipping_address_line,shipping_subdistrict,shipping_district,shipping_province,shipping_postal_code)'
    )
    .in('id', productIds)
    .eq('status', 'published');
  if (
    error ||
    !products ||
    products.length !== productIds.length ||
    products.some((item) => item.resource_type !== 'physical')
  ) {
    return NextResponse.json(
      { message: error?.message ?? 'สินค้าจัดส่งไม่พร้อมจำหน่าย' },
      { status: 400 }
    );
  }
  if (
    products.some((product) => {
      const seller: any = Array.isArray(product.seller) ? product.seller[0] : product.seller;
      return !isMarketplaceShippingEnabledForOfficialSeller(shippingConfig, seller?.owner_role);
    })
  ) {
    return NextResponse.json(
      { message: 'ระบบจัดส่งยังไม่เปิดใช้งานสำหรับร้านนี้' },
      { status: 503 }
    );
  }
  const groups = new Map<string, typeof products>();
  products.forEach((product) =>
    groups.set(product.seller_id, [...(groups.get(product.seller_id) ?? []), product])
  );
  const results = [];
  for (const [sellerId, items] of groups) {
    const seller: any = Array.isArray(items[0].seller) ? items[0].seller[0] : items[0].seller;
    const sender = normalizeAddress({
      name: seller?.shipping_contact_name,
      phone: seller?.shipping_phone,
      address: seller?.shipping_address_line,
      subdistrict: seller?.shipping_subdistrict,
      district: seller?.shipping_district,
      province: seller?.shipping_province,
      postalCode: seller?.shipping_postal_code,
    });
    const invalidProduct = items.some(
      (item) =>
        !item.shipping_weight_grams ||
        !item.shipping_width_cm ||
        !item.shipping_length_cm ||
        !item.shipping_height_cm
    );
    if (!validAddress(sender) || invalidProduct) {
      return NextResponse.json(
        { message: `ร้าน ${seller?.display_name ?? ''} ยังตั้งค่าต้นทางหรือขนาดพัสดุไม่ครบ` },
        { status: 409 }
      );
    }
    const parcel = {
      name: items
        .map((item) => item.title)
        .join(', ')
        .slice(0, 200),
      weightGrams: items.reduce((sum, item) => sum + Number(item.shipping_weight_grams), 0),
      widthCm: Math.max(...items.map((item) => Number(item.shipping_width_cm))),
      lengthCm: Math.max(...items.map((item) => Number(item.shipping_length_cm))),
      heightCm: items.reduce((sum, item) => sum + Number(item.shipping_height_cm), 0),
    };
    let rates;
    try {
      rates = await getShippopRates({
        sender,
        receiver,
        parcel,
        environment: shippingConfig.environment,
      });
    } catch (providerError) {
      return NextResponse.json(
        {
          message:
            providerError instanceof Error
              ? `SHIPPOP คำนวณค่าขนส่งไม่สำเร็จ: ${providerError.message}`
              : 'SHIPPOP คำนวณค่าขนส่งไม่สำเร็จ',
        },
        { status: 502 }
      );
    }
    results.push({
      sellerId,
      sellerName: seller?.display_name ?? 'ร้านค้า',
      rates: rates.map((rate) => ({
        ...rate,
        quoteToken: signShippingQuote({
          sellerId,
          courierCode: rate.courierCode,
          courierName: rate.courierName,
          courierRef: rate.courierRef,
          serviceName: rate.serviceName,
          serviceType: rate.serviceType,
          price: rate.price,
        }),
      })),
    });
  }
  return NextResponse.json({ groups: results });
}
