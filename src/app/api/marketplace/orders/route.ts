import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import {
  money,
  getFinanceSettings,
} from 'src/sections/marketplace/admin/server/finance';
import {
  getStripe,
  isStripeConfigured,
} from 'src/sections/marketplace/checkout/server/stripe';

type RequestedItem = {
  productId: string;
  quantity: number;
};

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
      '*, seller:marketplace_sellers(id, display_name), items:marketplace_order_items(*, product:marketplace_products(file_url, cover_url, resource_type))'
    )
    .eq('buyer_id', caller.sub)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  const safeOrders = (orders ?? []).map((order) => ({
    ...order,
    items: order.items?.map((item: Record<string, unknown>) => ({
      ...item,
      product:
        ['paid', 'completed'].includes(order.status) && item.product
          ? item.product
          : { ...(item.product as Record<string, unknown>), file_url: null },
    })),
  }));
  return NextResponse.json({ orders: safeOrders });
}

export async function POST(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const requestedPaymentMethod = String(body?.paymentMethod ?? '');
  const requestedItems: RequestedItem[] = Array.isArray(body?.items) ? body.items : [];
  const uniqueProductIds = [...new Set(requestedItems.map((item) => String(item.productId)))];

  if (!uniqueProductIds.length || !['promptpay', 'stripe'].includes(requestedPaymentMethod)) {
    return NextResponse.json({ message: 'รายการสินค้าหรือวิธีชำระเงินไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: products, error: productError } = await supabaseAdmin
    .from('marketplace_products')
    .select(
      'id, seller_id, title, price, currency, status, seller:marketplace_sellers(owner_role)'
    )
    .in('id', uniqueProductIds)
    .eq('status', 'published');

  if (productError || !products || products.length !== uniqueProductIds.length) {
    return NextResponse.json(
      { message: productError?.message ?? 'สินค้าบางรายการไม่พร้อมจำหน่าย' },
      { status: 400 }
    );
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const itemsBySeller = new Map<string, Array<(typeof products)[number] & { quantity: number }>>();

  for (const item of requestedItems) {
    const product = productMap.get(String(item.productId));
    if (!product) continue;
    const quantity = Math.max(1, Math.min(Number(item.quantity) || 1, 10));
    const group = itemsBySeller.get(product.seller_id) ?? [];
    group.push({ ...product, quantity });
    itemsBySeller.set(product.seller_id, group);
  }

  const finance = await getFinanceSettings();
  const checkoutTotal = money(
    [...itemsBySeller.values()].reduce(
      (sum, items) =>
        sum + items.reduce((subtotal, item) => subtotal + Number(item.price) * item.quantity, 0),
      0
    )
  );
  const isFree = checkoutTotal === 0;

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
      { message: 'ระบบ Stripe ยังไม่เปิดใช้งาน กรุณาเลือกช่องทางอื่นหรือติดต่อผู้ดูแลระบบ' },
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
        !isFree && requestedPaymentMethod === 'promptpay'
          ? finance.promptpay_account_name
          : null,
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
    const grossAmount = money(
      items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
    );
    const sellerRecord = Array.isArray(items[0]?.seller)
      ? items[0]?.seller[0]
      : items[0]?.seller;
    const commissionRate =
      sellerRecord?.owner_role === 'master_admin' ? 0 : Number(finance.commission_rate);
    const platformFee = money((grossAmount * commissionRate) / 100);
    const sellerNet = money(grossAmount - platformFee);
    const { data: order, error: orderError } = await supabaseAdmin
      .from('marketplace_orders')
      .insert({
        buyer_id: caller.sub,
        seller_id: sellerId,
        payment_session_id: paymentSession.id,
        status: isFree ? 'paid' : 'pending_payment',
        total: grossAmount,
        gross_amount: grossAmount,
        commission_rate: commissionRate,
        platform_fee: platformFee,
        seller_net: sellerNet,
        paid_at: isFree ? now.toISOString() : null,
        available_at: isFree ? availableAt : null,
        currency: items[0]?.currency ?? 'THB',
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
        quantity: item.quantity,
      }))
    );
    if (itemError) {
      await cleanupCheckout(paymentSession.id);
      return NextResponse.json({ message: itemError.message }, { status: 500 });
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
  if (!isFree && requestedPaymentMethod === 'stripe') {
    try {
      const origin = new URL(request.url).origin;
      const stripeSession = await getStripe().checkout.sessions.create({
        mode: 'payment',
        client_reference_id: paymentSession.id,
        line_items: [...itemsBySeller.values()]
          .flat()
          .filter((item) => Number(item.price) > 0)
          .map((item) => ({
            quantity: item.quantity,
            price_data: {
              currency: 'thb',
              unit_amount: Math.round(Number(item.price) * 100),
              product_data: { name: item.title.slice(0, 120) },
            },
          })),
        metadata: {
          marketplace_payment_session_id: paymentSession.id,
          buyer_id: caller.sub,
        },
        payment_intent_data: {
          metadata: { marketplace_payment_session_id: paymentSession.id },
        },
        success_url: `${origin}/checkout/payment/${paymentSession.id}?stripe=success`,
        cancel_url: `${origin}/checkout/payment/${paymentSession.id}?stripe=cancelled`,
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
        await getStripe().checkout.sessions.expire(stripeSession.id).catch(() => undefined);
        throw updateError ?? new Error('บันทึก Stripe Checkout Session ไม่สำเร็จ');
      }
      finalPaymentSession = updatedSession;
    } catch (stripeError) {
      await cleanupCheckout(paymentSession.id);
      return NextResponse.json(
        {
          message:
            stripeError instanceof Error
              ? `สร้าง Stripe Checkout ไม่สำเร็จ: ${stripeError.message}`
              : 'สร้าง Stripe Checkout ไม่สำเร็จ',
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
