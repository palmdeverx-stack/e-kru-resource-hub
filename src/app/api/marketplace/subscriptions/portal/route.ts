import { NextResponse } from 'next/server';

import { requireAuthenticated } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

import { getStripe } from 'src/sections/marketplace/checkout/server/stripe';

export async function POST(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const { data: local } = await supabaseAdmin
    .from('marketplace_license_subscriptions')
    .select('stripe_customer_id')
    .eq('buyer_id', caller.sub)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!local?.stripe_customer_id) {
    return NextResponse.json({ message: 'ยังไม่พบบัญชีเรียกเก็บเงิน Stripe' }, { status: 404 });
  }
  try {
    const origin = new URL(request.url).origin;
    const stripe = getStripe();
    const configurations = await stripe.billingPortal.configurations.list({ active: true, limit: 1 });
    const configuration =
      configurations.data[0] ??
      (await stripe.billingPortal.configurations.create({
        business_profile: {
          headline: 'จัดการบัตร ใบแจ้งหนี้ และ License ของ E-KRU Marketplace',
          privacy_policy_url: `${origin}/privacy-policy`,
          terms_of_service_url: `${origin}/terms-of-service`,
        },
        features: {
          customer_update: { enabled: false, allowed_updates: [] },
          invoice_history: { enabled: true },
          payment_method_update: { enabled: true },
          subscription_cancel: { enabled: true, mode: 'at_period_end' },
          subscription_update: { enabled: false, default_allowed_updates: [] },
        },
      }));
    const portal = await stripe.billingPortal.sessions.create({
      customer: local.stripe_customer_id,
      configuration: configuration.id,
      return_url: `${origin}/dashboard/my-apps`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? `เปิดหน้าจัดการบัตรไม่สำเร็จ: ${error.message}`
            : 'เปิดหน้าจัดการบัตรไม่สำเร็จ',
      },
      { status: 500 }
    );
  }
}
