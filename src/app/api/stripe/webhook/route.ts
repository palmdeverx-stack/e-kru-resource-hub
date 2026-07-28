import type Stripe from 'stripe';

import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createNotifications } from 'src/lib/notifications';

import { finalizeMarketplacePayment } from 'src/sections/marketplace/checkout/server/finalize-payment';
import {
  getStripe,
  getStripeWebhookSecret,
} from 'src/sections/marketplace/checkout/server/stripe';

export const runtime = 'nodejs';

async function getProcessorFee(paymentIntentId: string | null) {
  if (!paymentIntentId) return 0;
  try {
    const intent = await getStripe().paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.balance_transaction'],
    });
    const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
    const transaction =
      charge && typeof charge.balance_transaction === 'object'
        ? charge.balance_transaction
        : null;
    return transaction ? Number(transaction.fee) / 100 : 0;
  } catch {
    return 0;
  }
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
  await supabaseAdmin
    .from('marketplace_orders')
    .update({ status: orderStatus, updated_at: now })
    .eq('payment_session_id', local.id)
    .eq('status', 'pending_payment');
  await createNotifications([
    {
      userId: local.buyer_id,
      schoolId: null,
      type: `marketplace_stripe_${status}`,
      title: status === 'expired' ? 'รายการ Stripe หมดอายุ' : 'การชำระผ่าน Stripe ไม่สำเร็จ',
      body: reason,
      link: `/checkout/payment/${local.id}`,
    },
  ]);
  return local.id;
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
        const paymentIntentId =
          typeof stripeSession.payment_intent === 'string'
            ? stripeSession.payment_intent
            : stripeSession.payment_intent?.id ?? null;
        const processorFee = await getProcessorFee(paymentIntentId);
        await finalizeMarketplacePayment({
          paymentSessionId: local.id,
          allowedStatuses: ['pending_payment'],
          stripePaymentIntentId: paymentIntentId,
          processorFee,
        });
      }
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
