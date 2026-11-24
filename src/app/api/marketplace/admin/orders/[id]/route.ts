import type { AdminOrderDetails } from 'src/sections/marketplace/admin/order-list';

import { z } from 'zod';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireRole, isActiveTokenAccount } from 'src/lib/auth-token';

import { getPaymentReason } from 'src/sections/marketplace/shared/payment-message';

type Context = { params: Promise<{ id: string }> };
type License = { status: string; starts_at: string; expires_at: string | null };

const shipmentLabels = new Map([
  ['pending', 'รอยืนยันการจัดส่ง'],
  ['ready', 'เตรียมจัดส่ง'],
  ['booking', 'กำลังจองขนส่ง'],
  ['shipping', 'กำลังจัดส่ง'],
  ['complete', 'จัดส่งสำเร็จ'],
  ['problem', 'การจัดส่งมีปัญหา'],
  ['return', 'พัสดุตีกลับ'],
  ['cancelled', 'ยกเลิกจัดส่ง'],
]);

const paymentMethods = new Map([
  ['free', 'คำสั่งซื้อฟรี'],
  ['stripe', 'ชำระออนไลน์ผ่าน Stripe'],
  ['promptpay', 'พร้อมเพย์แบบแนบสลิป'],
]);

function loadError() {
  return NextResponse.json({ message: 'โหลดรายละเอียดคำสั่งซื้อไม่สำเร็จ' }, { status: 500 });
}

function licenseLabel(license: License, now: number) {
  if (license.status === 'renewed') return 'ต่ออายุด้วยสิทธิ์รายการใหม่แล้ว';
  if (license.status === 'disputed') return 'ระงับสิทธิ์ระหว่างข้อพิพาท';
  if (['refunded', 'revoked'].includes(license.status)) return 'เพิกถอนสิทธิ์แล้ว';
  if (
    license.status === 'expired' ||
    (license.expires_at && Date.parse(license.expires_at) <= now)
  ) {
    return 'สิทธิ์หมดอายุ';
  }
  if (license.status === 'active') {
    return Date.parse(license.starts_at) > now ? 'รอถึงวันเริ่มใช้งาน' : 'เปิดสิทธิ์แล้ว';
  }
  return 'ตรวจสอบสถานะสิทธิ์';
}

export async function GET(request: Request, { params }: Context) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller || !(await isActiveTokenAccount(caller))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูรายละเอียดคำสั่งซื้อ' }, { status: 403 });
  }
  const id = z.uuid().safeParse((await params).id);
  if (!id.success)
    return NextResponse.json({ message: 'เลขคำสั่งซื้อไม่ถูกต้อง' }, { status: 400 });

  const { data: order, error } = await supabaseAdmin
    .from('marketplace_orders')
    .select(
      'id,status,created_at,paid_at,currency,payment_session_id,payment:marketplace_payment_sessions(status,payment_method,rejection_reason,submitted_at,reviewed_at,updated_at),shipment:marketplace_shipments(status,booked_at,completed_at),items:marketplace_order_items(id,title,product:marketplace_products(resource_type,file_url,external_links,files:marketplace_product_files(scan_status)),school:marketplace_school_licenses(status,starts_at,expires_at),user_license:marketplace_user_licenses(status,starts_at,expires_at),platform:marketplace_platform_licenses(status,starts_at,expires_at))'
    )
    .eq('id', id.data)
    .maybeSingle();

  if (error) return loadError();
  if (!order) return NextResponse.json({ message: 'ไม่พบคำสั่งซื้อ' }, { status: 404 });

  const orderItemIds = (order.items ?? []).map((item) => item.id);
  const [audit, refunds, download] = await Promise.all([
    order.payment_session_id
      ? supabaseAdmin
          .from('security_audit_logs')
          .select('action,actor_username,metadata,created_at')
          .eq('target_type', 'payment_session')
          .eq('target_id', order.payment_session_id)
          .eq('result', 'success')
          .in('action', ['marketplace.payment_approve', 'marketplace.payment_reject'])
          .order('created_at', { ascending: false })
          .limit(25)
      : null,
    order.payment_session_id
      ? supabaseAdmin
          .from('marketplace_stripe_refund_totals')
          .select('refunded_amount,charge_amount,updated_at')
          .eq('payment_session_id', order.payment_session_id)
          .gt('refunded_amount', 0)
          .order('updated_at', { ascending: false })
          .limit(25)
      : null,
    orderItemIds.length
      ? supabaseAdmin
          .from('marketplace_product_downloads')
          .select('downloaded_at')
          .in('order_item_id', orderItemIds)
          .order('downloaded_at', { ascending: true })
          .limit(1)
          .maybeSingle()
      : null,
  ]);
  if (audit?.error || refunds?.error || download?.error) return loadError();

  // These relationships are many-to-one or unique per order/item. The client has no generated schema.
  const one = <T>(value: T | T[] | null): T | null =>
    Array.isArray(value) ? (value[0] ?? null) : value;
  const payment = one(order.payment);
  const shipment = one(order.shipment);
  const method = paymentMethods.get(payment?.payment_method ?? '');
  const reason = getPaymentReason(payment);
  const events: AdminOrderDetails['events'] = [{ label: 'สร้างคำสั่งซื้อ', at: order.created_at }];
  if (payment?.submitted_at) events.push({ label: 'แนบสลิป', at: payment.submitted_at });
  if (order.paid_at) events.push({ label: 'ยืนยันการชำระเงิน', at: order.paid_at, detail: method });

  for (const entry of audit?.data ?? []) {
    const approved = entry.action === 'marketplace.payment_approve';
    const actor = entry.actor_username ? `โดย ${entry.actor_username}` : '';
    const note =
      !approved && typeof entry.metadata?.reason === 'string' ? entry.metadata.reason : '';
    events.push({
      label: approved ? 'อนุมัติสลิป' : 'สลิปไม่ผ่านการตรวจสอบ',
      at: entry.created_at,
      detail: [actor, note].filter(Boolean).join(' · ') || undefined,
    });
  }

  if (
    order.status === 'payment_rejected' &&
    !(audit?.data ?? []).some(
      (entry) =>
        entry.action === 'marketplace.payment_reject' &&
        entry.created_at >= (payment?.reviewed_at ?? payment?.updated_at ?? '')
    )
  ) {
    events.push({
      label: 'การชำระเงินไม่สำเร็จ',
      at: payment?.reviewed_at ?? payment?.updated_at ?? null,
      detail: reason ?? undefined,
    });
  }
  if (order.status === 'cancelled') {
    events.push({
      label: 'ยกเลิกคำสั่งซื้อ',
      at: payment?.status === 'expired' ? payment.updated_at : null,
      detail: reason ?? 'ไม่มีบันทึกเหตุผลหรือผู้ยกเลิก',
    });
  }
  for (const refund of refunds?.data ?? []) {
    events.push({
      label:
        refund.refunded_amount >= refund.charge_amount
          ? 'คืนเงินเต็มจำนวนของรายการชำระ'
          : 'คืนเงินบางส่วนของรายการชำระ',
      at: refund.updated_at,
    });
  }
  if (order.status === 'refunded' && !refunds?.data?.length) {
    events.push({ label: 'สถานะคำสั่งซื้อคืนเงินแล้ว', at: null });
  }
  if (shipment?.booked_at) events.push({ label: 'จองขนส่งแล้ว', at: shipment.booked_at });
  if (shipment?.completed_at) events.push({ label: 'จัดส่งสำเร็จ', at: shipment.completed_at });
  events.sort(
    (a, b) => (a.at ? Date.parse(a.at) : Infinity) - (b.at ? Date.parse(b.at) : Infinity)
  );

  const now = Date.now();
  const paid = ['paid', 'completed'].includes(order.status);
  const delivery: AdminOrderDetails['delivery'] = (order.items ?? []).map((item) => {
    const product = one(item.product);
    const schoolLicense = one(item.school);
    const license = schoolLicense ?? one(item.user_license) ?? one(item.platform);
    let status = 'ไม่มีข้อมูลการส่งมอบ';
    if (license) {
      status = licenseLabel(license, now);
      if (status === 'เปิดสิทธิ์แล้ว' && schoolLicense) status = 'เปิดสิทธิ์ให้โรงเรียนแล้ว';
    } else if (product?.resource_type === 'physical' || (shipment && !product)) {
      status = shipmentLabels.get(shipment?.status ?? '') ?? 'ไม่พบรายการจัดส่ง';
    } else if (!paid) {
      status = ['pending', 'pending_payment', 'payment_review', 'payment_rejected'].includes(
        order.status
      )
        ? 'รอยืนยันการชำระเงิน'
        : 'ไม่มีสิทธิ์ส่งมอบตามสถานะคำสั่งซื้อ';
    } else if (product?.resource_type === 'feature_unlock') {
      status = 'ชำระแล้ว แต่ไม่พบสิทธิ์ที่เปิดใช้งาน';
    } else if (product?.files?.some((file) => file.scan_status === 'safe') || product?.file_url) {
      status = 'มีไฟล์ให้ดาวน์โหลด';
    } else if (product?.external_links?.length) {
      status = 'มีลิงก์ให้เข้าถึง';
    } else if (product?.files?.some((file) => file.scan_status === 'pending_scan')) {
      status = 'ไฟล์อยู่ระหว่างตรวจสอบ';
    } else if (product?.files?.length) {
      status = 'ไฟล์ถูกระงับ';
    } else if (product?.resource_type === 'service') {
      status = 'ไม่พบข้อมูลยืนยันการส่งมอบบริการ';
    }
    return { id: item.id, title: item.title, status };
  });

  return NextResponse.json(
    {
      paymentMethod: method ?? null,
      refundBlockedByDownload: Boolean(download?.data),
      events,
      delivery,
    } satisfies AdminOrderDetails,
    {
      headers: { 'Cache-Control': 'private, no-store' },
    }
  );
}
