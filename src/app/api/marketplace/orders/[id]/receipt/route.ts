import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import {
  renderMarketplaceReceiptPdf,
  type MarketplaceReceiptPdfData,
} from 'src/lib/marketplace-receipt-pdf';

import {
  getPlatformBrandAssets,
  getPlatformReceiptProviderSnapshot,
} from 'src/sections/marketplace/admin/server/platform-settings';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

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

async function getBuyerSnapshot(buyerId: string, role: string) {
  if (role === 'marketplace_user') {
    const { data } = await supabaseAdmin
      .from('marketplace_users')
      .select('display_name, first_name, last_name, username, email')
      .eq('id', buyerId)
      .maybeSingle();
    return {
      name:
        data?.display_name?.trim() ||
        `${data?.first_name ?? ''} ${data?.last_name ?? ''}`.trim() ||
        data?.username ||
        `ผู้ซื้อ #${buyerId.slice(0, 8)}`,
      email: data?.email ?? null,
    };
  }

  const { data } = await supabaseAdmin
    .from('app_users')
    .select('first_name, last_name, username, email')
    .eq('id', buyerId)
    .maybeSingle();
  return {
    name:
      `${data?.first_name ?? ''} ${data?.last_name ?? ''}`.trim() ||
      data?.username ||
      `ผู้ซื้อ #${buyerId.slice(0, 8)}`,
    email: data?.email ?? null,
  };
}

async function getProviderSnapshot() {
  const platformProvider = await getPlatformReceiptProviderSnapshot();
  if (platformProvider?.provider_name) return platformProvider;

  const { data, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .select(
      'id, owner_id, display_name, seller_name, company_name, company_tax_id, national_tax_id, business_address, contact_email, phone'
    )
    .eq('owner_role', 'master_admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const { data: signature } = await supabaseAdmin
    .from('marketplace_seller_documents')
    .select('storage_bucket, storage_path, mime_type')
    .eq('seller_id', data.id)
    .eq('document_type', 'receipt_signature')
    .maybeSingle();
  return {
    issued_by: data.owner_id,
    provider_name:
      data.company_name?.trim() || data.seller_name?.trim() || data.display_name?.trim() || null,
    provider_tax_id: data.company_tax_id || data.national_tax_id || null,
    provider_address: data.business_address?.trim() || null,
    provider_email: data.contact_email || null,
    provider_phone: data.phone || null,
    provider_signature_bucket: signature?.storage_bucket || null,
    provider_signature_path: signature?.storage_path || null,
    provider_signature_mime_type: signature?.mime_type || null,
  };
}

export async function GET(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const { id } = await params;
  const { data: order, error: orderError } = await supabaseAdmin
    .from('marketplace_orders')
    .select('id, payment_session_id')
    .eq('id', id)
    .eq('buyer_id', caller.sub)
    .maybeSingle();

  if (orderError || !order?.payment_session_id) {
    return NextResponse.json(
      { message: orderError?.message ?? 'ไม่พบคำสั่งซื้อหรือใบเสร็จรับเงิน' },
      { status: orderError ? 500 : 404 }
    );
  }

  const { data: receipt, error: receiptError } = await supabaseAdmin
    .from('marketplace_receipts')
    .select(
      'receipt_number, status, amount, currency, payment_method, transaction_reference, items_snapshot, buyer_name, buyer_email, buyer_tax_id, buyer_address, provider_name, provider_tax_id, provider_address, provider_email, provider_phone, provider_signature_bucket, provider_signature_path, provider_signature_mime_type, paid_at, subtotal_amount, discount_amount, vat_amount, notes, issued_at, voided_at, void_reason'
    )
    .eq('payment_session_id', order.payment_session_id)
    .eq('buyer_id', caller.sub)
    .maybeSingle();

  if (receiptError || !receipt) {
    return NextResponse.json(
      { message: receiptError?.message ?? 'ระบบยังไม่ได้ออกใบเสร็จรับเงินสำหรับรายการนี้' },
      { status: receiptError ? 500 : 404 }
    );
  }

  try {
    let signatureDataUrl: string | null = null;
    let brandLogoDataUrl: string | null = null;
    if (
      receipt.provider_signature_bucket &&
      receipt.provider_signature_path &&
      receipt.provider_signature_mime_type
    ) {
      const { data: signatureFile } = await supabaseAdmin.storage
        .from(receipt.provider_signature_bucket)
        .download(receipt.provider_signature_path);
      if (signatureFile) {
        const signatureBytes = Buffer.from(await signatureFile.arrayBuffer());
        signatureDataUrl = `data:${receipt.provider_signature_mime_type};base64,${signatureBytes.toString('base64')}`;
      }
    }
    const brand = await getPlatformBrandAssets();
    if (brand.logo) {
      const { data: logoFile } = await supabaseAdmin.storage
        .from(brand.logo.bucket)
        .download(brand.logo.path);
      if (logoFile) {
        const logoBytes = Buffer.from(await logoFile.arrayBuffer());
        brandLogoDataUrl = `data:${brand.logo.mimeType};base64,${logoBytes.toString('base64')}`;
      }
    }
    const pdf = await renderMarketplaceReceiptPdf(
      receipt as MarketplaceReceiptPdfData,
      signatureDataUrl,
      { name: brand.platformName, logoDataUrl: brandLogoDataUrl }
    );
    const download = new URL(request.url).searchParams.get('download') === '1';
    const safeNumber =
      receipt.receipt_number.replace(/[^A-Za-z0-9_-]/g, '') || `receipt-${order.id.slice(0, 8)}`;

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${safeNumber}.pdf"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ message: 'ไม่สามารถสร้างไฟล์ใบเสร็จรับเงินได้' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const requestedBuyerName = String(body?.buyerName ?? '').trim();
  const requestedBuyerEmail = String(body?.buyerEmail ?? '').trim();
  const buyerTaxId = String(body?.buyerTaxId ?? '').replace(/\D/g, '');
  const buyerAddress = String(body?.buyerAddress ?? '').trim();

  if (requestedBuyerName.length < 2 || buyerAddress.length < 5) {
    return NextResponse.json(
      { message: 'กรุณาระบุชื่อผู้รับใบเสร็จและที่อยู่สำหรับใช้เบิกค่าใช้จ่าย' },
      { status: 400 }
    );
  }
  if (requestedBuyerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedBuyerEmail)) {
    return NextResponse.json({ message: 'รูปแบบอีเมลผู้รับไม่ถูกต้อง' }, { status: 400 });
  }
  if (buyerTaxId && buyerTaxId.length !== 13) {
    return NextResponse.json({ message: 'เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก' }, { status: 400 });
  }

  const { id } = await params;
  const { data: order, error: orderError } = await supabaseAdmin
    .from('marketplace_orders')
    .select('id, status, payment_session_id')
    .eq('id', id)
    .eq('buyer_id', caller.sub)
    .maybeSingle();

  if (orderError || !order?.payment_session_id) {
    return NextResponse.json(
      { message: orderError?.message ?? 'ไม่พบคำสั่งซื้อหรือข้อมูลการชำระเงิน' },
      { status: orderError ? 500 : 404 }
    );
  }
  if (!['paid', 'completed'].includes(order.status)) {
    return NextResponse.json(
      { message: 'ออกใบเสร็จได้เฉพาะคำสั่งซื้อที่ชำระเงินสำเร็จแล้ว' },
      { status: 409 }
    );
  }

  const { data: existingReceipt } = await supabaseAdmin
    .from('marketplace_receipts')
    .select('*')
    .eq('payment_session_id', order.payment_session_id)
    .eq('buyer_id', caller.sub)
    .maybeSingle();
  if (existingReceipt) {
    if (existingReceipt.status !== 'issued') {
      return NextResponse.json(
        { message: 'ไม่สามารถแก้ไขข้อมูลผู้รับของใบเสร็จที่ยกเลิกแล้ว' },
        { status: 409 }
      );
    }
    const { data: updatedReceipt, error: updateError } = await supabaseAdmin
      .from('marketplace_receipts')
      .update({
        buyer_name: requestedBuyerName,
        buyer_email: requestedBuyerEmail || null,
        buyer_tax_id: buyerTaxId || null,
        buyer_address: buyerAddress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingReceipt.id)
      .eq('buyer_id', caller.sub)
      .select('*')
      .single();
    if (updateError || !updatedReceipt) {
      return NextResponse.json(
        { message: updateError?.message ?? 'ไม่สามารถแก้ไขข้อมูลผู้รับใบเสร็จได้' },
        { status: 500 }
      );
    }
    return NextResponse.json({ receipt: updatedReceipt });
  }

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .select(
      'id, buyer_id, amount, currency, payment_method, status, submitted_at, reviewed_at, bank_transaction_reference, stripe_payment_intent_id, orders:marketplace_orders(id, status, paid_at, gross_amount, discount_amount, seller:marketplace_sellers(display_name), items:marketplace_order_items(title, unit_price, list_unit_price, quantity))'
    )
    .eq('id', order.payment_session_id)
    .eq('buyer_id', caller.sub)
    .maybeSingle();

  const paidOrders = ((payment?.orders ?? []) as unknown as PaymentOrder[]).filter((item) =>
    ['paid', 'completed'].includes(item.status)
  );
  if (paymentError || !payment || payment.status !== 'verified' || !paidOrders.length) {
    return NextResponse.json(
      { message: paymentError?.message ?? 'ยังไม่สามารถยืนยันข้อมูลการชำระเงินได้' },
      { status: paymentError ? 500 : 409 }
    );
  }

  let provider;
  try {
    provider = await getProviderSnapshot();
  } catch (providerError) {
    return NextResponse.json(
      {
        message:
          providerError instanceof Error
            ? providerError.message
            : 'ไม่สามารถโหลดข้อมูลผู้ออกใบเสร็จได้',
      },
      { status: 500 }
    );
  }
  if (
    !provider?.provider_name ||
    provider.provider_tax_id?.length !== 13 ||
    !provider.provider_address
  ) {
    return NextResponse.json(
      { message: 'ข้อมูลผู้ออกใบเสร็จยังไม่ครบ กรุณาติดต่อผู้ดูแลระบบ' },
      { status: 409 }
    );
  }

  const buyer = await getBuyerSnapshot(caller.sub, caller.role);
  const { data: receiptNumber, error: numberError } = await supabaseAdmin.rpc(
    'next_marketplace_receipt_number'
  );
  if (numberError || !receiptNumber) {
    return NextResponse.json(
      { message: numberError?.message ?? 'ไม่สามารถสร้างเลขที่ใบเสร็จได้' },
      { status: 500 }
    );
  }

  const itemsSnapshot = paidOrders.flatMap((paidOrder) =>
    (paidOrder.items ?? []).map((item) => ({
      orderId: paidOrder.id,
      sellerName: paidOrder.seller?.display_name || 'E-KRU Marketplace',
      title: item.title,
      unitPrice: Number(item.unit_price),
      listUnitPrice: Number(item.list_unit_price ?? item.unit_price),
      quantity: Number(item.quantity),
      subtotal: Number(item.unit_price) * Number(item.quantity),
    }))
  );
  const subtotalAmount = paidOrders.reduce(
    (total, paidOrder) =>
      total +
      Number(paidOrder.gross_amount ?? 0) +
      Number(paidOrder.discount_amount ?? 0),
    0
  );
  const discountAmount = paidOrders.reduce(
    (total, paidOrder) => total + Number(paidOrder.discount_amount ?? 0),
    0
  );
  const paidAt =
    paidOrders
      .map((paidOrder) => paidOrder.paid_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ||
    payment.reviewed_at ||
    payment.submitted_at ||
    new Date().toISOString();

  const { data: receipt, error: receiptError } = await supabaseAdmin
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
      buyer_id: caller.sub,
      buyer_name: requestedBuyerName,
      buyer_email: requestedBuyerEmail || buyer.email,
      buyer_tax_id: buyerTaxId || null,
      buyer_address: buyerAddress,
      ...provider,
      paid_at: paidAt,
      subtotal_amount: Math.max(Number(payment.amount), subtotalAmount),
      discount_amount: discountAmount,
      vat_amount: 0,
      notes: null,
      issued_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (receiptError || !receipt) {
    if (receiptError?.code === '23505') {
      const { data: concurrentReceipt } = await supabaseAdmin
        .from('marketplace_receipts')
        .select('*')
        .eq('payment_session_id', payment.id)
        .eq('buyer_id', caller.sub)
        .maybeSingle();
      if (concurrentReceipt) return NextResponse.json({ receipt: concurrentReceipt });
    }
    return NextResponse.json(
      { message: receiptError?.message ?? 'ไม่สามารถออกใบเสร็จรับเงินได้' },
      { status: 500 }
    );
  }

  return NextResponse.json({ receipt }, { status: 201 });
}
