import { NextResponse } from 'next/server';

import { getReferralSettings } from 'src/sections/marketplace/referrals/server/referrals';

export async function GET() {
  const settings = await getReferralSettings();
  return NextResponse.json(
    {
      enabled: Boolean(settings.is_enabled),
      rewardRate: Number(settings.reward_rate),
      attributionDays: Number(settings.attribution_days),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
