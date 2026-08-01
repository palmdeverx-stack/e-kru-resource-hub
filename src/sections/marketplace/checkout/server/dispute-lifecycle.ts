import 'server-only';

import type Stripe from 'stripe';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createNotifications } from 'src/lib/notifications';

import { reconcileFeature } from './license-lifecycle';
import { recordCustomerCommunication } from './order-evidence';

type DisputeEventType =
  | 'charge.dispute.created'
  | 'charge.dispute.updated'
  | 'charge.dispute.closed'
  | 'charge.dispute.funds_withdrawn'
  | 'charge.dispute.funds_reinstated';

function objectId(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : (value?.id ?? null);
}

async function notifyDispute(
  buyerId: string,
  title: string,
  body: string,
  paymentSessionId: string
) {
  const { data: admins } = await supabaseAdmin
    .from('app_users')
    .select('id,school_id')
    .eq('role', 'master_admin')
    .eq('is_active', true);
  await createNotifications([
    {
      userId: buyerId,
      schoolId: null,
      type: 'marketplace_payment_dispute',
      title,
      body,
      link: '/dashboard/purchases',
    },
    ...(admins ?? []).map((admin) => ({
      userId: admin.id,
      schoolId: admin.school_id,
      type: 'marketplace_payment_dispute_admin',
      title,
      body,
      link: '/dashboard/payment-reviews',
    })),
  ]);
}

async function reconcileSchoolLicenses(
  licenses: Array<{ school_id: string; feature_keys: string[] | null }>
) {
  await Promise.all(
    licenses.flatMap((license) =>
      (license.feature_keys ?? []).map((featureKey) =>
        reconcileFeature(license.school_id, featureKey)
      )
    )
  );
}

export async function handleStripeDispute(dispute: Stripe.Dispute, eventType: DisputeEventType) {
  const paymentIntentId = objectId(dispute.payment_intent);
  if (!paymentIntentId) throw new Error('Stripe Dispute ไม่มี Payment Intent');

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .select(
      'id,buyer_id,amount,currency,status,orders:marketplace_orders(id,seller_id,seller_net,status)'
    )
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();
  if (sessionError || !session) {
    throw sessionError ?? new Error('ไม่พบรายการชำระเงินของ Dispute');
  }

  const orders = session.orders ?? [];
  const orderIds = orders.map((order) => order.id);
  const [
    { data: schoolLicenses },
    { data: userLicenses },
    { data: platformLicenses },
    { data: existingDispute },
  ] =
    await Promise.all([
      orderIds.length
        ? supabaseAdmin
            .from('marketplace_school_licenses')
            .select('id,status,school_id,feature_keys')
            .in('order_id', orderIds)
        : Promise.resolve({ data: [] }),
      orderIds.length
        ? supabaseAdmin
            .from('marketplace_user_licenses')
            .select('id,status')
            .in('order_id', orderIds)
        : Promise.resolve({ data: [] }),
      orderIds.length
        ? supabaseAdmin
            .from('marketplace_platform_licenses')
            .select('id,status')
            .in('order_id', orderIds)
        : Promise.resolve({ data: [] }),
      supabaseAdmin
        .from('marketplace_payment_disputes')
        .select('id,license_state_snapshot')
        .eq('stripe_dispute_id', dispute.id)
        .maybeSingle(),
    ]);
  const licenseStateSnapshot = existingDispute?.license_state_snapshot?.length
    ? existingDispute.license_state_snapshot
    : [
        ...(schoolLicenses ?? []).map((license) => ({
          type: 'school',
          id: license.id,
          status: license.status,
        })),
        ...(userLicenses ?? []).map((license) => ({
          type: 'user',
          id: license.id,
          status: license.status,
        })),
        ...(platformLicenses ?? []).map((license) => ({
          type: 'platform',
          id: license.id,
          status: license.status,
        })),
      ];
  const disputeRecord = dispute as unknown as Record<string, unknown>;
  const paymentMethodDetails = disputeRecord.payment_method_details as
    | { card?: { three_d_secure?: { result?: string }; liability_shift?: boolean } }
    | undefined;
  const now = new Date().toISOString();
  const disputedAmount = Number(dispute.amount) / 100;
  const disputedRatio = Math.min(
    1,
    Math.max(0, disputedAmount / Math.max(Number(session.amount), 0.01))
  );
  const disputedSellerAmount = (sellerNet: unknown) =>
    Math.round(Math.abs(Number(sellerNet)) * disputedRatio * 100) / 100;

  const { error: disputeError } = await supabaseAdmin.from('marketplace_payment_disputes').upsert(
    {
      stripe_dispute_id: dispute.id,
      stripe_charge_id: objectId(dispute.charge),
      stripe_payment_intent_id: paymentIntentId,
      payment_session_id: session.id,
      buyer_id: session.buyer_id,
      amount: disputedAmount,
      currency: dispute.currency.toUpperCase(),
      reason: dispute.reason,
      status: dispute.status,
      evidence_due_by: dispute.evidence_details?.due_by
        ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
        : null,
      is_charge_refundable: dispute.is_charge_refundable,
      has_liability_shift: paymentMethodDetails?.card?.liability_shift ?? null,
      stripe_evidence_details: dispute.evidence_details ?? {},
      raw_snapshot: JSON.parse(JSON.stringify(dispute)),
      license_state_snapshot: licenseStateSnapshot,
      updated_at: now,
      ...(eventType === 'charge.dispute.closed' || ['won', 'lost'].includes(dispute.status)
        ? { closed_at: now }
        : {}),
    },
    { onConflict: 'stripe_dispute_id' }
  );
  if (disputeError) throw disputeError;

  const opened =
    eventType === 'charge.dispute.created' || eventType === 'charge.dispute.funds_withdrawn';
  const won =
    eventType === 'charge.dispute.funds_reinstated' ||
    (eventType === 'charge.dispute.closed' && dispute.status === 'won');
  const lost = eventType === 'charge.dispute.closed' && dispute.status === 'lost';

  if (opened && session.status !== 'disputed') {
    await supabaseAdmin
      .from('marketplace_payment_sessions')
      .update({ status: 'disputed', updated_at: now })
      .eq('id', session.id)
      .eq('status', 'verified');
    if (orderIds.length) {
      await supabaseAdmin
        .from('marketplace_orders')
        .update({ status: 'disputed', updated_at: now })
        .in('id', orderIds)
        .in('status', ['paid', 'completed']);
      await supabaseAdmin
        .from('marketplace_school_licenses')
        .update({
          status: 'disputed',
          revoked_at: now,
          revoke_reason: `Stripe dispute ${dispute.id}`,
          updated_at: now,
        })
        .in('order_id', orderIds)
        .eq('status', 'active');
      await supabaseAdmin
        .from('marketplace_user_licenses')
        .update({
          status: 'disputed',
          revoked_at: now,
          revoke_reason: `Stripe dispute ${dispute.id}`,
          updated_at: now,
        })
        .in('order_id', orderIds)
        .eq('status', 'active');
      await supabaseAdmin
        .from('marketplace_platform_licenses')
        .update({
          status: 'disputed',
          revoked_at: now,
          revoke_reason: `Stripe dispute ${dispute.id}`,
          updated_at: now,
        })
        .in('order_id', orderIds)
        .eq('status', 'active');
      await supabaseAdmin.from('marketplace_ledger_entries').upsert(
        orders.map((order) => ({
          order_id: order.id,
          seller_id: order.seller_id,
          account_scope: 'seller',
          entry_type: 'chargeback',
          amount: -disputedSellerAmount(order.seller_net),
          available_at: now,
          description: `ระงับยอดจาก Stripe dispute ${dispute.id}`,
        })),
        { onConflict: 'order_id,account_scope,entry_type', ignoreDuplicates: true }
      );
    }
    await reconcileSchoolLicenses(schoolLicenses ?? []);
    await recordCustomerCommunication({
      paymentSessionId: session.id,
      buyerId: session.buyer_id,
      eventType: 'payment_disputed',
      subject: 'รายการชำระเงินอยู่ระหว่างข้อพิพาท',
      content: `ธนาคารได้รับคำร้องโต้แย้งรายการ ${dispute.id} เหตุผล ${dispute.reason}`,
      providerReference: dispute.id,
      metadata: { status: dispute.status, evidence_due_by: dispute.evidence_details?.due_by },
    });
    await notifyDispute(
      session.buyer_id,
      'พบข้อพิพาทการชำระเงิน',
      `Stripe dispute ${dispute.id} · ${dispute.reason}`,
      session.id
    );
  }

  if (won && session.status === 'disputed') {
    await supabaseAdmin
      .from('marketplace_payment_sessions')
      .update({ status: 'verified', updated_at: now })
      .eq('id', session.id)
      .eq('status', 'disputed');
    if (orderIds.length) {
      await supabaseAdmin
        .from('marketplace_orders')
        .update({ status: 'paid', updated_at: now })
        .in('id', orderIds)
        .eq('status', 'disputed');
      const activeSchoolIds = licenseStateSnapshot
        .filter(
          (license: { type: string; status: string }) =>
            license.type === 'school' && license.status === 'active'
        )
        .map((license: { id: string }) => license.id);
      const activeUserIds = licenseStateSnapshot
        .filter(
          (license: { type: string; status: string }) =>
            license.type === 'user' && license.status === 'active'
        )
        .map((license: { id: string }) => license.id);
      const activePlatformIds = licenseStateSnapshot
        .filter(
          (license: { type: string; status: string }) =>
            license.type === 'platform' && license.status === 'active'
        )
        .map((license: { id: string }) => license.id);
      if (activeSchoolIds.length) {
        await supabaseAdmin
          .from('marketplace_school_licenses')
          .update({ status: 'active', revoked_at: null, revoke_reason: null, updated_at: now })
          .in('id', activeSchoolIds)
          .eq('status', 'disputed');
      }
      if (activeUserIds.length) {
        await supabaseAdmin
          .from('marketplace_user_licenses')
          .update({ status: 'active', revoked_at: null, revoke_reason: null, updated_at: now })
          .in('id', activeUserIds)
          .eq('status', 'disputed');
      }
      if (activePlatformIds.length) {
        await supabaseAdmin
          .from('marketplace_platform_licenses')
          .update({ status: 'active', revoked_at: null, revoke_reason: null, updated_at: now })
          .in('id', activePlatformIds)
          .eq('status', 'disputed');
      }
      await supabaseAdmin.from('marketplace_ledger_entries').upsert(
        orders.map((order) => ({
          order_id: order.id,
          seller_id: order.seller_id,
          account_scope: 'seller',
          entry_type: 'chargeback_reversal',
          amount: disputedSellerAmount(order.seller_net),
          available_at: now,
          description: `คืนยอดหลังชนะ Stripe dispute ${dispute.id}`,
        })),
        { onConflict: 'order_id,account_scope,entry_type', ignoreDuplicates: true }
      );
    }
    await reconcileSchoolLicenses(schoolLicenses ?? []);
    await notifyDispute(
      session.buyer_id,
      'ข้อพิพาทสิ้นสุด — ร้านค้าชนะ',
      'ระบบคืนสิทธิ์การใช้งานจากคำสั่งซื้อแล้ว',
      session.id
    );
  }

  if (lost && session.status === 'disputed') {
    if (orderIds.length) {
      await supabaseAdmin
        .from('marketplace_orders')
        .update({ status: 'refunded', updated_at: now })
        .in('id', orderIds)
        .eq('status', 'disputed');
      await supabaseAdmin
        .from('marketplace_school_licenses')
        .update({
          status: 'refunded',
          revoked_at: now,
          revoke_reason: `แพ้ Stripe dispute ${dispute.id}`,
          updated_at: now,
        })
        .in('order_id', orderIds)
        .eq('status', 'disputed');
      await supabaseAdmin
        .from('marketplace_user_licenses')
        .update({
          status: 'refunded',
          revoked_at: now,
          revoke_reason: `แพ้ Stripe dispute ${dispute.id}`,
          updated_at: now,
        })
        .in('order_id', orderIds)
        .eq('status', 'disputed');
      await supabaseAdmin
        .from('marketplace_platform_licenses')
        .update({
          status: 'refunded',
          revoked_at: now,
          revoke_reason: `แพ้ Stripe dispute ${dispute.id}`,
          updated_at: now,
        })
        .in('order_id', orderIds)
        .eq('status', 'disputed');
    }
    await reconcileSchoolLicenses(schoolLicenses ?? []);
    await notifyDispute(
      session.buyer_id,
      'ข้อพิพาทสิ้นสุด — ธนาคารคืนเงิน',
      'สิทธิ์จากคำสั่งซื้อถูกยกเลิกและเก็บไว้ในประวัติ',
      session.id
    );
  }

  return session.id;
}
