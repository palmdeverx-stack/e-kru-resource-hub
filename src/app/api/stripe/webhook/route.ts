import type Stripe from 'stripe';

import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createNotifications } from 'src/lib/notifications';

import { handleStripeDispute } from 'src/sections/marketplace/checkout/server/dispute-lifecycle';
import { getStripe, getStripeWebhookSecret } from 'src/sections/marketplace/checkout/server/stripe';
import { finalizeMarketplacePayment } from 'src/sections/marketplace/checkout/server/finalize-payment';
import { recordShippingRefundForOrders } from 'src/sections/marketplace/shipping/server/accounting';
import { revokeLicensesForPaymentSession } from 'src/sections/marketplace/checkout/server/license-lifecycle';
import {
  subscriptionPeriod,
  stripeSubscriptionId,
  createRenewalPayment,
  alignOrderLicensesToPeriod,
  markSubscriptionPaymentFailed,
} from 'src/sections/marketplace/checkout/server/license-subscriptions';

export const runtime = 'nodejs';

async function getProcessorDetails(paymentIntentId: string | null) {
  if (!paymentIntentId) return { fee: 0, snapshot: null };
  try {
    const intent = await getStripe().paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.balance_transaction'],
    });
    const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
    const transaction =
      charge && typeof charge.balance_transaction === 'object' ? charge.balance_transaction : null;
    return {
      fee: transaction ? Number(transaction.fee) / 100 : 0,
      snapshot: {
        id: intent.id,
        status: intent.status,
        amount: intent.amount,
        currency: intent.currency,
        created: intent.created,
        payment_method_types: intent.payment_method_types,
        receipt_email: intent.receipt_email,
        latest_charge: charge && {
          id: charge.id,
          billing_details: charge.billing_details,
          outcome: charge.outcome,
          payment_method_details: charge.payment_method_details,
          receipt_url: charge.receipt_url,
        },
      },
    };
  } catch {
    return { fee: 0, snapshot: null };
  }
}

async function invoicePaymentIntentId(invoice: Stripe.Invoice) {
  const embedded = invoice.payments?.data.map((item) => item.payment.payment_intent).find(Boolean);
  if (embedded) return typeof embedded === 'string' ? embedded : embedded.id;
  const payments = await getStripe().invoicePayments.list({ invoice: invoice.id, status: 'paid' });
  const intent = payments.data.map((item) => item.payment.payment_intent).find(Boolean);
  return intent ? (typeof intent === 'string' ? intent : intent.id) : null;
}

function localSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === 'trialing') return 'active';
  if (status === 'incomplete_expired') return 'canceled';
  return status;
}

async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const period = subscriptionPeriod(subscription);
  let { data, error } = await supabaseAdmin
    .from('marketplace_license_subscriptions')
    .update({
      stripe_customer_id: idOf(subscription.customer),
      stripe_subscription_id: subscription.id,
      status: localSubscriptionStatus(subscription.status),
      current_period_start: period.startsAt,
      current_period_end: period.endsAt,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data && subscription.metadata.marketplace_order_id) {
    const fallback = await supabaseAdmin
      .from('marketplace_license_subscriptions')
      .update({
        stripe_customer_id: idOf(subscription.customer),
        stripe_subscription_id: subscription.id,
        status: localSubscriptionStatus(subscription.status),
        current_period_start: period.startsAt,
        current_period_end: period.endsAt,
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq('initial_order_id', subscription.metadata.marketplace_order_id)
      .select('id')
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
    if (error) throw error;
  }
  return data?.id ?? null;
}

function idOf(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : (value?.id ?? null);
}

async function loadLocalSession(stripeSession: Stripe.Checkout.Session) {
  const paymentSessionId = stripeSession.metadata?.marketplace_payment_session_id;
  if (!paymentSessionId) throw new Error('Stripe event ไม่มี marketplace_payment_session_id');

  const { data: local, error } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .select('id, buyer_id, amount, currency, status, stripe_checkout_session_id')
    .eq('id', paymentSessionId)
    .maybeSingle();
  if (error) throw error;
  if (!local) throw new Error('ไม่พบ Marketplace payment session');
  if (local.stripe_checkout_session_id !== stripeSession.id) {
    throw new Error('Stripe Checkout Session ID ไม่ตรงกับรายการในระบบ');
  }
  if (
    stripeSession.amount_total !== Math.round(Number(local.amount) * 100) ||
    stripeSession.currency?.toUpperCase() !== String(local.currency).toUpperCase()
  ) {
    throw new Error('ยอดเงินหรือสกุลเงินจาก Stripe ไม่ตรงกับคำสั่งซื้อ');
  }
  return local;
}

async function markStripePaymentFailed(
  stripeSession: Stripe.Checkout.Session,
  status: 'rejected' | 'expired',
  reason: string
) {
  const local = await loadLocalSession(stripeSession);
  const orderStatus = status === 'expired' ? 'cancelled' : 'payment_rejected';
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('marketplace_payment_sessions')
    .update({ status, rejection_reason: reason, updated_at: now })
    .eq('id', local.id)
    .eq('status', 'pending_payment');
  const { data: unavailableOrders } = await supabaseAdmin
    .from('marketplace_orders')
    .update({ status: orderStatus, updated_at: now })
    .eq('payment_session_id', local.id)
    .eq('status', 'pending_payment')
    .select('id,shipping_amount');
  const unavailableShippingOrderIds = (unavailableOrders ?? [])
    .filter((order) => Number(order.shipping_amount ?? 0) > 0)
    .map((order) => order.id);
  if (unavailableShippingOrderIds.length) {
    await supabaseAdmin
      .from('marketplace_shipments')
      .update({ status: 'cancelled', updated_at: now })
      .in('order_id', unavailableShippingOrderIds)
      .eq('status', 'pending');
  }
  await createNotifications([
    {
      userId: local.buyer_id,
      schoolId: null,
      type: `marketplace_stripe_${status}`,
      title: status === 'expired' ? 'รายการชำระเงินออนไลน์หมดอายุ' : 'การชำระเงินออนไลน์ไม่สำเร็จ',
      body: reason,
      link: `/checkout/payment/${local.id}`,
    },
  ]);
  return local.id;
}

async function refundStripePayment(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) throw new Error('Stripe refund ไม่มี Payment Intent');
  const { data: session, error } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .select('id,buyer_id,orders:marketplace_orders(id,shipping_amount)')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();
  if (error || !session) throw error ?? new Error('ไม่พบรายการชำระเงินสำหรับ Refund');

  await revokeLicensesForPaymentSession(session.id, 'refunded', 'Stripe คืนเงินให้ผู้ซื้อ');
  await recordShippingRefundForOrders(
    (session.orders ?? [])
      .filter((order) => Number(order.shipping_amount ?? 0) > 0)
      .map((order) => order.id),
    `stripe-refund:${charge.id}`
  );
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('marketplace_orders')
    .update({ status: 'refunded', updated_at: now })
    .eq('payment_session_id', session.id)
    .in('status', ['paid', 'completed']);
  await createNotifications([
    {
      userId: session.buyer_id,
      schoolId: null,
      type: 'marketplace_payment_refunded',
      title: 'รายการได้รับการคืนเงินแล้ว',
      body: 'License จากคำสั่งซื้อนี้ถูกยกเลิกและเก็บไว้ในประวัติ',
      link: '/dashboard/purchases',
    },
  ]);
  return session.id;
}

async function markPaymentIntentFailed(intent: Stripe.PaymentIntent) {
  const paymentSessionId = intent.metadata?.marketplace_payment_session_id;
  if (!paymentSessionId)
    throw new Error('Stripe Payment Intent ไม่มี marketplace_payment_session_id');
  const reason =
    intent.last_payment_error?.message ?? 'ผู้ให้บริการชำระเงินแจ้งว่าการชำระเงินไม่สำเร็จ';
  const now = new Date().toISOString();
  const { data: session, error } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .update({ status: 'rejected', rejection_reason: reason, updated_at: now })
    .eq('id', paymentSessionId)
    .eq('status', 'pending_payment')
    .select('id,buyer_id')
    .maybeSingle();
  if (error) throw error;
  if (!session) return paymentSessionId;
  await supabaseAdmin
    .from('marketplace_orders')
    .update({ status: 'payment_rejected', updated_at: now })
    .eq('payment_session_id', paymentSessionId)
    .eq('status', 'pending_payment');
  await createNotifications([
    {
      userId: session.buyer_id,
      schoolId: null,
      type: 'marketplace_stripe_rejected',
      title: 'การชำระเงินออนไลน์ไม่สำเร็จ',
      body: reason,
      link: `/checkout/payment/${paymentSessionId}`,
    },
  ]);
  return paymentSessionId;
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ message: 'Missing Stripe-Signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Invalid Stripe signature' },
      { status: 400 }
    );
  }

  const { data: existing } = await supabaseAdmin
    .from('marketplace_stripe_events')
    .select('status')
    .eq('event_id', event.id)
    .maybeSingle();
  if (existing?.status === 'processed' || existing?.status === 'ignored') {
    return NextResponse.json({ received: true });
  }

  await supabaseAdmin.from('marketplace_stripe_events').upsert({
    event_id: event.id,
    event_type: event.type,
    status: 'processing',
    last_error: null,
    updated_at: new Date().toISOString(),
  });

  let paymentSessionId: string | null = null;
  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const stripeSession = event.data.object as Stripe.Checkout.Session;
      const local = await loadLocalSession(stripeSession);
      paymentSessionId = local.id;
      if (stripeSession.payment_status === 'paid') {
        const stripeSubscription = idOf(stripeSession.subscription);
        const stripeInvoice = idOf(stripeSession.invoice);
        let paymentIntentId = idOf(stripeSession.payment_intent);
        let periodEnd: string | null = null;
        if (stripeSubscription) {
          const subscription = await getStripe().subscriptions.retrieve(stripeSubscription, {
            expand: ['items.data'],
          });
          const period = subscriptionPeriod(subscription);
          periodEnd = period.endsAt;
          const invoice = stripeInvoice
            ? await getStripe().invoices.retrieve(stripeInvoice, { expand: ['payments'] })
            : null;
          paymentIntentId = invoice ? await invoicePaymentIntentId(invoice) : null;
          const { data: order } = await supabaseAdmin
            .from('marketplace_orders')
            .select('id')
            .eq('payment_session_id', local.id)
            .maybeSingle();
          await supabaseAdmin
            .from('marketplace_payment_sessions')
            .update({
              stripe_invoice_id: stripeInvoice,
              stripe_subscription_id: stripeSubscription,
              stripe_payment_intent_id: paymentIntentId,
            })
            .eq('id', local.id);
          await supabaseAdmin
            .from('marketplace_license_subscriptions')
            .update({
              stripe_customer_id: idOf(stripeSession.customer),
              stripe_subscription_id: stripeSubscription,
              status: localSubscriptionStatus(subscription.status),
              current_period_start: period.startsAt,
              current_period_end: period.endsAt,
              last_invoice_id: stripeInvoice,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_checkout_session_id', stripeSession.id);
          const processor = await getProcessorDetails(paymentIntentId);
          await finalizeMarketplacePayment({
            paymentSessionId: local.id,
            allowedStatuses: ['pending_payment'],
            stripePaymentIntentId: paymentIntentId,
            processorFee: processor.fee,
            paymentSnapshot: processor.snapshot,
          });
          if (order && periodEnd) await alignOrderLicensesToPeriod(order.id, periodEnd);
        } else {
          const processor = await getProcessorDetails(paymentIntentId);
          await finalizeMarketplacePayment({
            paymentSessionId: local.id,
            allowedStatuses: ['pending_payment'],
            stripePaymentIntentId: paymentIntentId,
            processorFee: processor.fee,
            paymentSnapshot: processor.snapshot,
          });
        }
      }
    } else if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      if (stripeSubscriptionId(invoice) && invoice.billing_reason !== 'subscription_create') {
        const paymentIntentId = await invoicePaymentIntentId(invoice);
        const processor = await getProcessorDetails(paymentIntentId);
        paymentSessionId = await createRenewalPayment({
          invoice,
          paymentIntentId,
          processorFee: processor.fee,
        });
      }
    } else if (event.type === 'invoice.payment_failed') {
      await markSubscriptionPaymentFailed(event.data.object as Stripe.Invoice);
    } else if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await syncStripeSubscription(event.data.object as Stripe.Subscription);
    } else if (event.type === 'checkout.session.expired') {
      paymentSessionId = await markStripePaymentFailed(
        event.data.object as Stripe.Checkout.Session,
        'expired',
        'ไม่ได้ชำระเงินภายในเวลาที่ Stripe กำหนด'
      );
    } else if (event.type === 'checkout.session.async_payment_failed') {
      paymentSessionId = await markStripePaymentFailed(
        event.data.object as Stripe.Checkout.Session,
        'rejected',
        'Stripe แจ้งว่าการชำระเงินไม่สำเร็จ'
      );
    } else if (
      event.type === 'charge.dispute.created' ||
      event.type === 'charge.dispute.updated' ||
      event.type === 'charge.dispute.closed' ||
      event.type === 'charge.dispute.funds_withdrawn' ||
      event.type === 'charge.dispute.funds_reinstated'
    ) {
      paymentSessionId = await handleStripeDispute(event.data.object as Stripe.Dispute, event.type);
    } else if (event.type === 'charge.refunded') {
      paymentSessionId = await refundStripePayment(event.data.object as Stripe.Charge);
    } else if (event.type === 'payment_intent.payment_failed') {
      paymentSessionId = await markPaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
    } else {
      await supabaseAdmin
        .from('marketplace_stripe_events')
        .update({
          status: 'ignored',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', event.id);
      return NextResponse.json({ received: true });
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from('marketplace_stripe_events')
      .update({
        payment_session_id: paymentSessionId,
        status: 'processed',
        processed_at: now,
        updated_at: now,
      })
      .eq('event_id', event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    await supabaseAdmin
      .from('marketplace_stripe_events')
      .update({
        payment_session_id: paymentSessionId,
        status: 'failed',
        last_error: error instanceof Error ? error.message : 'Webhook processing failed',
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', event.id);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
