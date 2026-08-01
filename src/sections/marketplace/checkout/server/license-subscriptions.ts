import 'server-only';

import type Stripe from 'stripe';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createNotifications } from 'src/lib/notifications';

import { money } from '../../admin/server/finance';
import { reconcileFeature } from './license-lifecycle';
import { finalizeMarketplacePayment } from './finalize-payment';

function idOf(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : value?.id ?? null;
}

export function stripeSubscriptionId(invoice: Stripe.Invoice) {
  return idOf(invoice.parent?.subscription_details?.subscription ?? null);
}

export function subscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  return {
    startsAt: item ? new Date(item.current_period_start * 1000).toISOString() : null,
    endsAt: item ? new Date(item.current_period_end * 1000).toISOString() : null,
  };
}

export async function alignOrderLicensesToPeriod(orderId: string, expiresAt: string) {
  const [{ data: school }, { data: users }, { data: platform }] = await Promise.all([
    supabaseAdmin
      .from('marketplace_school_licenses')
      .update({ expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .select('school_id,license_scope,feature_keys'),
    supabaseAdmin
      .from('marketplace_user_licenses')
      .update({ expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .select('id'),
    supabaseAdmin
      .from('marketplace_platform_licenses')
      .update({ expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .select('id'),
  ]);
  await Promise.all(
    (school ?? [])
      .filter((license) => license.license_scope === 'school')
      .flatMap((license) =>
        (license.feature_keys as string[]).map(async (featureKey) => {
          await supabaseAdmin
            .from('school_feature_purchases')
            .update({ expires_at: expiresAt, updated_at: new Date().toISOString() })
            .eq('school_id', license.school_id)
            .eq('feature_key', featureKey);
          await reconcileFeature(license.school_id, featureKey);
        })
      )
  );
  return (school?.length ?? 0) + (users?.length ?? 0) + (platform?.length ?? 0);
}

export async function createRenewalPayment({
  invoice,
  paymentIntentId,
  processorFee,
}: {
  invoice: Stripe.Invoice;
  paymentIntentId: string | null;
  processorFee: number;
}) {
  const stripeId = stripeSubscriptionId(invoice);
  if (!stripeId) return null;
  const { data: subscription, error } = await supabaseAdmin
    .from('marketplace_license_subscriptions')
    .select(
      '*, initial_order:marketplace_orders(*, items:marketplace_order_items(product_id,title,unit_price,list_unit_price,quantity))'
    )
    .eq('stripe_subscription_id', stripeId)
    .maybeSingle();
  if (error) throw error;
  if (!subscription) return null;

  const { data: existing } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .select('*')
    .eq('stripe_invoice_id', invoice.id)
    .maybeSingle();

  const initialOrder = Array.isArray(subscription.initial_order)
    ? subscription.initial_order[0]
    : subscription.initial_order;
  if (!initialOrder) throw new Error('ไม่พบคำสั่งซื้อเริ่มต้นของ Subscription');
  const amount = Number(invoice.amount_paid) / 100;
  const commissionRate = Number(initialOrder.commission_rate);
  const platformFee = money((amount * commissionRate) / 100);
  const sellerNet = money(amount - platformFee);
  const now = new Date().toISOString();
  let paymentSession = existing;
  if (!paymentSession) {
    const { data, error: paymentError } = await supabaseAdmin
      .from('marketplace_payment_sessions')
      .insert({
        buyer_id: subscription.buyer_id,
        amount,
        currency: String(invoice.currency).toUpperCase(),
        payment_method: 'stripe',
        status: 'pending_payment',
        submitted_at: now,
        stripe_invoice_id: invoice.id,
        stripe_subscription_id: stripeId,
        stripe_payment_intent_id: paymentIntentId,
      })
      .select('*')
      .single();
    if (paymentError || !data) throw paymentError ?? new Error('สร้างรอบชำระ Subscription ไม่สำเร็จ');
    paymentSession = data;
  }

  let { data: order, error: findOrderError } = await supabaseAdmin
    .from('marketplace_orders')
    .select('*')
    .eq('payment_session_id', paymentSession.id)
    .maybeSingle();
  if (findOrderError) throw findOrderError;
  if (!order) {
    const { data, error: orderError } = await supabaseAdmin
      .from('marketplace_orders')
      .insert({
        buyer_id: subscription.buyer_id,
        seller_id: subscription.seller_id,
        payment_session_id: paymentSession.id,
        license_school_id: subscription.license_school_id,
        status: 'pending_payment',
        total: amount,
        gross_amount: amount,
        discount_amount: 0,
        commission_rate: commissionRate,
        platform_fee: platformFee,
        seller_net: sellerNet,
        currency: String(invoice.currency).toUpperCase(),
      })
      .select('*')
      .single();
    if (orderError || !data) throw orderError ?? new Error('สร้างคำสั่งซื้อต่ออายุไม่สำเร็จ');
    order = data;
  }
  const items = (initialOrder.items ?? []) as Array<Record<string, unknown>>;
  const { count: itemCount, error: countError } = await supabaseAdmin
    .from('marketplace_order_items')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', order.id);
  if (countError) throw countError;
  if (!itemCount) {
    const { error: itemError } = await supabaseAdmin.from('marketplace_order_items').insert(
      items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        title: item.title,
        unit_price: amount,
        list_unit_price: amount,
        quantity: item.quantity ?? 1,
      }))
    );
    if (itemError) throw itemError;
  }

  if (paymentSession.status === 'pending_payment') {
    await finalizeMarketplacePayment({
      paymentSessionId: paymentSession.id,
      allowedStatuses: ['pending_payment'],
      stripePaymentIntentId: paymentIntentId,
      processorFee,
    });
  }
  if (paymentSession.status !== 'pending_payment' && subscription.last_invoice_id === invoice.id) {
    return paymentSession.id;
  }
  await alignOrderLicensesToPeriod(order.id, new Date(invoice.period_end * 1000).toISOString());
  await supabaseAdmin
    .from('marketplace_license_subscriptions')
    .update({
      status: 'active',
      current_period_start: new Date(invoice.period_start * 1000).toISOString(),
      current_period_end: new Date(invoice.period_end * 1000).toISOString(),
      last_invoice_id: invoice.id,
      updated_at: now,
    })
    .eq('id', subscription.id);
  await createNotifications([
    {
      userId: subscription.buyer_id,
      schoolId: subscription.license_school_id,
      type: 'marketplace_subscription_renewed',
      title: 'ต่ออายุ License สำเร็จ',
      body: `ชำระรอบใหม่ ${amount.toLocaleString('th-TH')} บาท และต่อสิทธิ์แล้ว`,
      link: '/dashboard/my-apps',
    },
  ]);
  return paymentSession.id;
}

export async function markSubscriptionPaymentFailed(invoice: Stripe.Invoice) {
  const stripeId = stripeSubscriptionId(invoice);
  if (!stripeId) return null;
  const { data } = await supabaseAdmin
    .from('marketplace_license_subscriptions')
    .update({ status: 'past_due', last_invoice_id: invoice.id, updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', stripeId)
    .select('id,buyer_id,license_school_id')
    .maybeSingle();
  if (data) {
    await createNotifications([
      {
        userId: data.buyer_id,
        schoolId: data.license_school_id,
        type: 'marketplace_subscription_payment_failed',
        title: 'ตัดเงินต่ออายุ License ไม่สำเร็จ',
        body: 'กรุณาอัปเดตวิธีชำระเงิน สิทธิ์เดิมยังใช้ได้ถึงวันสิ้นสุดรอบปัจจุบัน',
        link: '/dashboard/my-apps',
      },
    ]);
  }
  return data?.id ?? null;
}
