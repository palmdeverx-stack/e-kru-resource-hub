import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { getStripe } from 'src/sections/marketplace/checkout/server/stripe';
import { subscriptionPeriod } from 'src/sections/marketplace/checkout/server/license-subscriptions';

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('marketplace_license_subscriptions')
    .select(
      'id,product_id,billing_cycle,amount,currency,status,current_period_start,current_period_end,cancel_at_period_end,canceled_at'
    )
    .eq('buyer_id', caller.sub)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ subscriptions: data ?? [] });
}

export async function PATCH(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const action = String(body?.action ?? '');
  if (!id || !['cancel', 'resume'].includes(action)) {
    return NextResponse.json({ message: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
  }
  const { data: local } = await supabaseAdmin
    .from('marketplace_license_subscriptions')
    .select('*')
    .eq('id', id)
    .eq('buyer_id', caller.sub)
    .maybeSingle();
  if (!local?.stripe_subscription_id || local.status === 'canceled') {
    return NextResponse.json({ message: 'Subscription นี้ไม่สามารถเปลี่ยนแปลงได้' }, { status: 409 });
  }
  const subscription = await getStripe().subscriptions.update(local.stripe_subscription_id, {
    cancel_at_period_end: action === 'cancel',
  });
  const period = subscriptionPeriod(subscription);
  const { data, error } = await supabaseAdmin
    .from('marketplace_license_subscriptions')
    .update({
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_start: period.startsAt,
      current_period_end: period.endsAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', local.id)
    .select(
      'id,product_id,billing_cycle,amount,currency,status,current_period_start,current_period_end,cancel_at_period_end,canceled_at'
    )
    .single();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ subscription: data });
}
