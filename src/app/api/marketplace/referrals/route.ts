import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import {
  ensureReferralCode,
  getReferralSettings,
} from 'src/sections/marketplace/referrals/server/referrals';

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const settings = await getReferralSettings();
  if (!settings.is_enabled) {
    return NextResponse.json({
      enabled: false,
      settings: {
        rewardRate: Number(settings.reward_rate),
        attributionDays: Number(settings.attribution_days),
        holdDays: Number(settings.hold_days),
        minimumPayout: Number(settings.minimum_payout),
      },
      code: null,
      summary: { clicks: 0, pending: 0, available: 0, paid: 0 },
      rewards: [],
    });
  }

  const code = await ensureReferralCode(caller.sub);
  if (!code) {
    return NextResponse.json(
      { message: 'ยังไม่ได้ติดตั้งตาราง Referral กรุณาอัปเดตฐานข้อมูล' },
      { status: 503 }
    );
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from('marketplace_referral_rewards')
    .update({ status: 'available', updated_at: now })
    .eq('referrer_id', caller.sub)
    .eq('status', 'pending')
    .lte('available_at', now);

  const [rewardsResult, clicksResult] = await Promise.all([
    supabaseAdmin
      .from('marketplace_referral_rewards')
      .select(
        'id, order_id, order_amount, platform_fee, reward_rate, reward_amount, currency, status, available_at, paid_at, created_at, order:marketplace_orders(created_at, items:marketplace_order_items(title))'
      )
      .eq('referrer_id', caller.sub)
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('marketplace_referral_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('referral_code_id', code.id),
  ]);

  if (rewardsResult.error) {
    return NextResponse.json({ message: rewardsResult.error.message }, { status: 500 });
  }

  const rewards = rewardsResult.data ?? [];
  const sumStatus = (status: string) =>
    rewards
      .filter((reward) => reward.status === status)
      .reduce((total, reward) => total + Number(reward.reward_amount), 0);

  return NextResponse.json({
    enabled: true,
    settings: {
      rewardRate: Number(settings.reward_rate),
      attributionDays: Number(settings.attribution_days),
      holdDays: Number(settings.hold_days),
      minimumPayout: Number(settings.minimum_payout),
    },
    code: {
      value: code.code,
      link: `${new URL(request.url).origin}/r/${code.code}`,
    },
    summary: {
      clicks: clicksResult.count ?? 0,
      pending: sumStatus('pending'),
      available: sumStatus('available'),
      paid: sumStatus('paid'),
    },
    rewards,
  });
}
