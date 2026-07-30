import 'server-only';

import { randomBytes } from 'node:crypto';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createNotifications } from 'src/lib/notifications';

import { money } from '../../admin/server/finance';

export const REFERRAL_COOKIE = 'ekru_marketplace_referral';

export const DEFAULT_REFERRAL_SETTINGS = {
  id: 'default',
  is_enabled: false,
  reward_rate: 20,
  attribution_days: 30,
  hold_days: 14,
  minimum_payout: 500,
  max_reward_per_order: 300,
};

export async function getReferralSettings() {
  const { data, error } = await supabaseAdmin
    .from('marketplace_referral_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') return { ...DEFAULT_REFERRAL_SETTINGS, setup_required: true };
    throw error;
  }
  return data ?? DEFAULT_REFERRAL_SETTINGS;
}

export async function ensureReferralCode(userId: string) {
  const existing = await supabaseAdmin
    .from('marketplace_referral_codes')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing.data) return existing.data;
  if (existing.error && existing.error.code === '42P01') return null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = randomBytes(6).toString('hex').toUpperCase();
    const { data, error } = await supabaseAdmin
      .from('marketplace_referral_codes')
      .insert({ user_id: userId, code })
      .select('*')
      .single();
    if (data) return data;
    if (error?.code !== '23505') throw error;
  }

  return (
    await supabaseAdmin
      .from('marketplace_referral_codes')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
  ).data;
}

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get('cookie') ?? '';
  const match = cookies
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

export async function resolveReferralAttribution(
  request: Request,
  buyerId: string,
  sellerId: string
) {
  const settings = await getReferralSettings();
  if (!settings.is_enabled) return null;

  const codeValue = cookieValue(request, REFERRAL_COOKIE).trim().toUpperCase();
  if (!codeValue) return null;

  const { data: code } = await supabaseAdmin
    .from('marketplace_referral_codes')
    .select('id, user_id, is_active')
    .eq('code', codeValue)
    .eq('is_active', true)
    .maybeSingle();
  if (!code || code.user_id === buyerId) return null;

  const { data: seller } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('owner_id')
    .eq('id', sellerId)
    .maybeSingle();
  if (seller?.owner_id === code.user_id) return null;

  return {
    referral_code_id: code.id,
    referrer_id: code.user_id,
    referral_reward_rate: Number(settings.reward_rate),
    referral_hold_days: Number(settings.hold_days),
    referral_reward_cap: Number(settings.max_reward_per_order),
  };
}

type ReferralOrder = {
  id?: unknown;
  referrer_id?: unknown;
  referral_code_id?: unknown;
  referral_reward_rate?: unknown;
  referral_hold_days?: unknown;
  referral_reward_cap?: unknown;
  gross_amount?: unknown;
  platform_fee?: unknown;
  currency?: unknown;
};

export async function createReferralRewards(orders: ReferralOrder[], buyerId: string) {
  const now = new Date();
  const rows = orders.flatMap((order) => {
    const referrerId = String(order.referrer_id ?? '');
    const referralCodeId = String(order.referral_code_id ?? '');
    const platformFee = money(Number(order.platform_fee) || 0);
    const rewardRate = Number(order.referral_reward_rate) || 0;
    if (!referrerId || !referralCodeId || referrerId === buyerId || platformFee <= 0) return [];

    const uncappedReward = money((platformFee * rewardRate) / 100);
    const cap = Number(order.referral_reward_cap);
    const rewardAmount = money(
      Number.isFinite(cap) && cap > 0 ? Math.min(uncappedReward, cap) : uncappedReward
    );
    if (rewardAmount <= 0) return [];

    const holdDays = Math.max(0, Number(order.referral_hold_days) || 0);
    return [
      {
        referral_code_id: referralCodeId,
        order_id: String(order.id),
        referrer_id: referrerId,
        referred_buyer_id: buyerId,
        order_amount: money(Number(order.gross_amount) || 0),
        platform_fee: platformFee,
        reward_rate: rewardRate,
        reward_amount: rewardAmount,
        currency: String(order.currency || 'THB'),
        status: holdDays ? 'pending' : 'available',
        available_at: new Date(now.getTime() + holdDays * 86400000).toISOString(),
      },
    ];
  });
  if (!rows.length) return [];

  const { data, error } = await supabaseAdmin
    .from('marketplace_referral_rewards')
    .upsert(rows, { onConflict: 'order_id', ignoreDuplicates: true })
    .select('id, referrer_id, reward_amount');
  if (error) {
    if (error.code === '42P01' || error.code === '42703') return [];
    throw error;
  }

  await createNotifications(
    (data ?? []).map((reward) => ({
      userId: reward.referrer_id,
      schoolId: null,
      type: 'marketplace_referral_reward',
      title: 'คุณได้รับรางวัลจากการแนะนำเพื่อน',
      body: `รางวัล ฿${Number(reward.reward_amount).toLocaleString('th-TH')} อยู่ระหว่างพักยอด`,
      link: '/dashboard/referrals',
    }))
  );
  return data ?? [];
}
