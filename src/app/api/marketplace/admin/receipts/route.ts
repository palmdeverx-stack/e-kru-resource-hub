import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { getPlatformReceiptProviderSnapshot } from 'src/sections/marketplace/admin/server/platform-settings';

type BuyerInfo = {
  id: string;
  name: string;
  email: string | null;
};

type PaymentOrder = {
  id: string;
  status: string;
  paid_at?: string | null;
  gross_amount?: number | null;
  discount_amount?: number | null;
  seller?: { display_name?: string | null } | null;
  items?: Array<{
    title: string;
    unit_price: number;
    list_unit_price?: number | null;
    quantity: number;
  }>;
};

function unauthorized() {
  return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการใบเสร็จรับเงิน' }, { status: 403 });
}

async function getBuyers(buyerIds: string[]) {
  const buyers = new Map<string, BuyerInfo>();
  if (!buyerIds.length) return buyers;

  const [{ data: marketplaceUsers }, { data: appUsers }] = await Promise.all([
    supabaseAdmin
      .from('marketplace_users')
      .select('id, display_name, first_name, last_name, username, email')
      .in('id', buyerIds),
    supabaseAdmin
      .from('app_users')
      .select('id, first_name, last_name, username, email')
      .in('id', buyerIds),
  ]);

  for (const user of marketplaceUsers ?? []) {
    buyers.set(user.id, {
      id: user.id,
      name:
        user.display_name?.trim() ||
        `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() ||
        user.username,
      email: user.email ?? null,
    });
  }
  for (const user of appUsers ?? []) {
    if (buyers.has(user.id)) continue;
    buyers.set(user.id, {
      id: user.id,
      name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username,
      email: user.email ?? null,
    });
  }
  return buyers;
}

async function getProviderSnapshot(ownerId: string) {
  const platformProvider = await getPlatformReceiptProviderSnapshot(ownerId);
  if (platformProvider?.provider_name) return platformProvider;

  const { data, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .select(
      'id, display_name, seller_name, company_name, company_tax_id, national_tax_id, business_address, contact_email, phone'
    )
    .eq('owner_id', ownerId)
    .eq('owner_role', 'master_admin')
    .maybeSingle();

  if (error) throw new Error(error.message);
  const providerName =
    data?.company_name?.trim() || data?.seller_name?.trim() || data?.display_name?.trim();
  const providerTaxId = data?.company_tax_id || data?.national_tax_id;
  const providerAddress = data?.business_address?.trim();
  if (!data) return null;
  const { data: signature } = await supabaseAdmin
    .from('marketplace_seller_documents')
    .select('storage_bucket, storage_path, mime_type')
    .eq('seller_id', data.id)
    .eq('document_type', 'receipt_signature')
    .maybeSingle();

  return {
    provider_name: providerName || null,
    provider_tax_id: providerTaxId || null,
    provider_address: providerAddress || null,
    provider_email: data?.contact_email || null,
    provider_phone: data?.phone || null,
    provider_signature_bucket: signature?.storage_bucket || null,
    provider_signature_path: signature?.storage_path || null,
    provider_signature_mime_type: signature?.mime_type || null,
  };
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) return unauthorized();

  const [{ data: payments, error: paymentError }, { data: receipts, error: receiptError }] =
    await Promise.all([
      supabaseAdmin
        .from('marketplace_payment_sessions')
        .select(
          'id, buyer_id, amount, currency, payment_method, status, submitted_at, bank_transaction_reference, stripe_payment_intent_id, reviewed_at, created_at, orders:marketplace_orders(id, status, paid_at, gross_amount, discount_amount, seller:marketplace_sellers(display_name), items:marketplace_order_items(title, unit_price, list_unit_price, quantity))'
        )
        .eq('status', 'verified')
        .order('reviewed_at', { ascending: false, nullsFirst: false })
        .limit(200),
      supabaseAdmin
        .from('marketplace_receipts')
        .select('*')
        .order('issued_at', { ascending: false })
        .limit(200),
    ]);

  if (paymentError || receiptError) {
    return NextResponse.json(
      {
        message:
          paymentError?.message || receiptError?.message || 'ไม่สามารถโหลดรายการใบเสร็จรับเงินได้',
      },
      { status: 500 }
    );
  }

  const buyerIds = [...new Set((payments ?? []).map((payment) => payment.buyer_id))];
  let provider;
  try {
    provider = await getProviderSnapshot(caller.sub);
  } catch (providerError) {
    return NextResponse.json(
      {
        message:
          providerError instanceof Error ? providerError.message : 'ไม่สามารถโหลดข้อมูลร้านระบบได้',
      },
      { status: 500 }
    );
  }
  const buyers = await getBuyers(buyerIds);
  const receiptMap = new Map(
    (receipts ?? []).map((receipt) => [receipt.payment_session_id, receipt])
  );

  const items = (payments ?? [])
    .filter((payment) =>
      ((payment.orders ?? []) as PaymentOrder[]).some((order) =>
        ['paid', 'completed'].includes(order.status)
      )
    )
    .map((payment) => ({
      ...payment,
      buyer: buyers.get(payment.buyer_id) ?? {
        id: payment.buyer_id,
        name: `ผู้ซื้อ #${payment.buyer_id.slice(0, 8)}`,
        email: null,
      },
      receipt: receiptMap.get(payment.id) ?? null,
    }));

  return NextResponse.json({ items, provider });
}

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireRole(request, ['master_admin']);
  if (!caller) return unauthorized();

  const body = await request.json().catch(() => null);
  const paymentSessionId = String(body?.paymentSessionId ?? '').trim();
  const buyerName = String(body?.buyerName ?? '').trim();
  const buyerEmail = String(body?.buyerEmail ?? '').trim();
  const buyerTaxId = String(body?.buyerTaxId ?? '').replace(/\D/g, '');
  const buyerAddress = String(body?.buyerAddress ?? '').trim();
  const notes = String(body?.notes ?? '').trim();

  if (!paymentSessionId || buyerName.length < 2) {
    return NextResponse.json(
      { message: 'กรุณาระบุรายการชำระเงินและชื่อผู้รับใบเสร็จ' },
      { status: 400 }
    );
  }
  if (buyerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return NextResponse.json({ message: 'รูปแบบอีเมลผู้รับไม่ถูกต้อง' }, { status: 400 });
  }
  if (buyerTaxId && buyerTaxId.length !== 13) {
    return NextResponse.json({ message: 'เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก' }, { status: 400 });
  }

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .select(
      'id, buyer_id, amount, currency, payment_method, status, submitted_at, reviewed_at, bank_transaction_reference, stripe_payment_intent_id, orders:marketplace_orders(id, status, paid_at, gross_amount, discount_amount, seller:marketplace_sellers(display_name), items:marketplace_order_items(title, unit_price, list_unit_price, quantity))'
    )
    .eq('id', paymentSessionId)
    .maybeSingle();

  if (paymentError) {
    return NextResponse.json({ message: paymentError.message }, { status: 500 });
  }
  const orders = (payment?.orders ?? []) as unknown as PaymentOrder[];
  const paidOrders = orders.filter((order) => ['paid', 'completed'].includes(order.status));
  if (!payment || payment.status !== 'verified' || !paidOrders.length) {
    return NextResponse.json(
      { message: 'ออกใบเสร็จได้เฉพาะรายการที่ชำระเงินสำเร็จแล้ว' },
      { status: 409 }
    );
  }

  let provider;
  try {
    provider = await getProviderSnapshot(caller.sub);
  } catch (providerError) {
    return NextResponse.json(
      {
        message:
          providerError instanceof Error ? providerError.message : 'ไม่สามารถโหลดข้อมูลร้านระบบได้',
      },
      { status: 500 }
    );
  }
  if (
    !provider?.provider_name ||
    provider.provider_name.length < 2 ||
    provider.provider_tax_id?.length !== 13 ||
    !provider.provider_address ||
    provider.provider_address.length < 10
  ) {
    return NextResponse.json(
      {
        message:
          'กรุณากรอกชื่อผู้ออก เลขผู้เสียภาษี และที่อยู่ในเมนูข้อมูลแพลตฟอร์มก่อนออกใบเสร็จ',
      },
      { status: 409 }
    );
  }
  const issuedAt = new Date();
  const { data: receiptNumber, error: numberError } = await supabaseAdmin.rpc(
    'next_marketplace_receipt_number'
  );
  if (numberError || !receiptNumber) {
    return NextResponse.json(
      {
        message:
          numberError?.message || 'ไม่สามารถสร้างเลขที่ใบเสร็จรับเงินได้ กรุณาลองใหม่อีกครั้ง',
      },
      { status: 500 }
    );
  }
  const itemsSnapshot = paidOrders.flatMap((order) =>
    (order.items ?? []).map((item) => ({
      orderId: order.id,
      sellerName: order.seller?.display_name || 'E-KRU Marketplace',
      title: item.title,
      unitPrice: Number(item.unit_price),
      listUnitPrice: Number(item.list_unit_price ?? item.unit_price),
      quantity: Number(item.quantity),
      subtotal: Number(item.unit_price) * Number(item.quantity),
    }))
  );
  const subtotalAmount = paidOrders.reduce(
    (total, order) =>
      total + Number(order.gross_amount ?? 0) + Number(order.discount_amount ?? 0),
    0
  );
  const discountAmount = paidOrders.reduce(
    (total, order) => total + Number(order.discount_amount ?? 0),
    0
  );
  const paidAt =
    paidOrders
      .map((order) => order.paid_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ||
    payment.reviewed_at ||
    payment.submitted_at ||
    issuedAt.toISOString();

  const { data: receipt, error } = await supabaseAdmin
    .from('marketplace_receipts')
    .insert({
      payment_session_id: payment.id,
      receipt_number: receiptNumber,
      status: 'issued',
      amount: Number(payment.amount),
      currency: payment.currency,
      payment_method: payment.payment_method,
      transaction_reference:
        payment.bank_transaction_reference || payment.stripe_payment_intent_id || null,
      items_snapshot: itemsSnapshot,
      buyer_id: payment.buyer_id,
      buyer_name: buyerName,
      buyer_email: buyerEmail || null,
      buyer_tax_id: buyerTaxId || null,
      buyer_address: buyerAddress || null,
      ...provider,
      paid_at: paidAt,
      subtotal_amount: Math.max(Number(payment.amount), subtotalAmount),
      discount_amount: discountAmount,
      vat_amount: 0,
      notes: notes || null,
      issued_at: issuedAt.toISOString(),
      issued_by: caller.sub,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { message: 'รายการชำระเงินนี้มีใบเสร็จรับเงินแล้ว กรุณาโหลดข้อมูลใหม่' },
        { status: 409 }
      );
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ receipt }, { status: 201 });
}
