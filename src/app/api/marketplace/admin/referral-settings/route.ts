import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';

import { getReferralSettings } from 'src/sections/marketplace/referrals/server/referrals';

function authorize(request: Request) {
  return requireRole(request, ['master_admin']);
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตั้งค่า Referral' }, { status: 403 });
  }
  const settings = await getReferralSettings();
  const [{ count: members }, { count: rewards }] = await Promise.all([
    supabaseAdmin
      .from('marketplace_referral_codes')
      .select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('marketplace_referral_rewards')
      .select('id', { count: 'exact', head: true }),
  ]);

  return NextResponse.json({
    settings: {
      isEnabled: Boolean(settings.is_enabled),
      rewardRate: Number(settings.reward_rate),
      attributionDays: Number(settings.attribution_days),
      holdDays: Number(settings.hold_days),
      minimumPayout: Number(settings.minimum_payout),
      maxRewardPerOrder: Number(settings.max_reward_per_order),
      setupRequired: Boolean(settings.setup_required),
    },
    stats: { members: members ?? 0, rewards: rewards ?? 0 },
  });
}

export async function PATCH(request: Request) {
  const caller = authorize(request);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตั้งค่า Referral' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const isEnabled = body?.isEnabled === true;
  const rewardRate = Number(body?.rewardRate);
  const attributionDays = Number(body?.attributionDays);
  const holdDays = Number(body?.holdDays);
  const minimumPayout = Number(body?.minimumPayout);
  const maxRewardPerOrder = Number(body?.maxRewardPerOrder);
  if (
    !Number.isFinite(rewardRate) ||
    rewardRate < 0 ||
    rewardRate > 100 ||
    !Number.isInteger(attributionDays) ||
    attributionDays < 1 ||
    attributionDays > 365 ||
    !Number.isInteger(holdDays) ||
    holdDays < 0 ||
    holdDays > 180 ||
    !Number.isFinite(minimumPayout) ||
    minimumPayout < 0 ||
    !Number.isFinite(maxRewardPerOrder) ||
    maxRewardPerOrder < 0
  ) {
    return NextResponse.json({ message: 'ข้อมูลตั้งค่า Referral ไม่ถูกต้อง' }, { status: 400 });
  }

  const previous = await getReferralSettings();
  const { error } = await supabaseAdmin.from('marketplace_referral_settings').upsert({
    id: 'default',
    is_enabled: isEnabled,
    reward_rate: rewardRate,
    attribution_days: attributionDays,
    hold_days: holdDays,
    minimum_payout: minimumPayout,
    max_reward_per_order: maxRewardPerOrder,
    updated_by: caller.sub,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'admin',
    action: 'marketplace.referral_settings_update',
    targetType: 'referral_settings',
    targetId: 'default',
    result: 'success',
    metadata: {
      before: previous,
      after: {
        is_enabled: isEnabled,
        reward_rate: rewardRate,
        attribution_days: attributionDays,
        hold_days: holdDays,
        minimum_payout: minimumPayout,
        max_reward_per_order: maxRewardPerOrder,
      },
    },
  });
  return NextResponse.json({ success: true });
}
