import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';

import { getFinanceSettings } from 'src/sections/marketplace/admin/server/finance';
import { isStripeConfigured } from 'src/sections/marketplace/checkout/server/stripe';
import { normalizePromptPayId } from 'src/sections/marketplace/checkout/server/promptpay';

function authorize(request: Request) {
  return requireRole(request, ['master_admin']);
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตั้งค่าการเงิน' }, { status: 403 });
  }
  const settings = await getFinanceSettings();
  return NextResponse.json({
    settings: {
      promptpayId: settings.promptpay_id ?? '',
      promptpayAccountName: settings.promptpay_account_name ?? '',
      commissionRate: Number(settings.commission_rate),
      holdDays: Number(settings.hold_days),
      payoutDay: Number(settings.payout_day),
      minimumPayout: Number(settings.minimum_payout),
      stripeEnabled: settings.stripe_enabled,
      stripeConfigured: isStripeConfigured(),
      stripeWebhookUrl: `${new URL(request.url).origin}/api/stripe/webhook`,
      isActive: settings.is_active,
    },
  });
}

export async function PATCH(request: Request) {
  const caller = authorize(request);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตั้งค่าการเงิน' }, { status: 403 });
  }
  const previous = await getFinanceSettings();
  const body = await request.json().catch(() => null);
  const promptpayId = String(body?.promptpayId ?? '').replace(/\D/g, '');
  const accountName = String(body?.promptpayAccountName ?? '').trim();
  const commissionRate = Number(body?.commissionRate);
  const holdDays = Number(body?.holdDays);
  const payoutDay = Number(body?.payoutDay);
  const minimumPayout = Number(body?.minimumPayout);
  const isActive = body?.isActive === true;
  const stripeEnabled = body?.stripeEnabled === true;

  try {
    if (promptpayId) normalizePromptPayId(promptpayId);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'PromptPay ID ไม่ถูกต้อง' },
      { status: 400 }
    );
  }

  if (
    (isActive && (!promptpayId || accountName.length < 2)) ||
    (stripeEnabled && !isStripeConfigured()) ||
    accountName.length > 150 ||
    !Number.isFinite(commissionRate) ||
    commissionRate < 0 ||
    commissionRate > 100 ||
    !Number.isInteger(holdDays) ||
    holdDays < 0 ||
    holdDays > 90 ||
    !Number.isInteger(payoutDay) ||
    payoutDay < 0 ||
    payoutDay > 6 ||
    !Number.isFinite(minimumPayout) ||
    minimumPayout < 0
  ) {
    return NextResponse.json({ message: 'ข้อมูลตั้งค่าการเงินไม่ถูกต้อง' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('marketplace_finance_settings').upsert({
    id: 'default',
    promptpay_id: promptpayId || null,
    promptpay_account_name: accountName || null,
    commission_rate: commissionRate,
    hold_days: holdDays,
    payout_day: payoutDay,
    minimum_payout: minimumPayout,
    stripe_enabled: stripeEnabled,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'admin',
    action: 'marketplace.finance_settings_update',
    targetType: 'finance_settings',
    targetId: 'default',
    result: 'success',
    metadata: {
      before: {
        commission_rate: Number(previous.commission_rate),
        hold_days: Number(previous.hold_days),
        payout_day: Number(previous.payout_day),
        minimum_payout: Number(previous.minimum_payout),
        stripe_enabled: previous.stripe_enabled,
        is_active: previous.is_active,
      },
      after: {
        commission_rate: commissionRate,
        hold_days: holdDays,
        payout_day: payoutDay,
        minimum_payout: minimumPayout,
        stripe_enabled: stripeEnabled,
        is_active: isActive,
      },
    },
  });

  return NextResponse.json({ success: true });
}
