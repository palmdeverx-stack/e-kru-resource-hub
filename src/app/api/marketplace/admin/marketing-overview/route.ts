import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

import { getVercelMarketingAnalytics } from 'src/sections/marketplace/admin/server/vercel-analytics';

const ALLOWED_RANGES = new Set([7, 30, 90]);

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export async function GET(request: Request) {
  if (!requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูภาพรวมการตลาด' }, { status: 403 });
  }

  const requestedDays = Number(new URL(request.url).searchParams.get('days'));
  const days = ALLOWED_RANGES.has(requestedDays) ? requestedDays : 30;
  const today = startOfDay(new Date());
  const since = new Date(today);
  since.setDate(since.getDate() - (days - 1));
  const untilExclusive = new Date(today);
  untilExclusive.setDate(untilExclusive.getDate() + 1);

  const [marketplaceResult, vercel] = await Promise.all([
    supabaseAdmin.rpc('marketplace_admin_marketing_stats', {
      since_at: since.toISOString(),
      until_at: untilExclusive.toISOString(),
    }),
    getVercelMarketingAnalytics(since, today),
  ]);

  if (marketplaceResult.error && marketplaceResult.error.code !== '42883') {
    return NextResponse.json({ message: marketplaceResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    days,
    period: {
      since: since.toISOString(),
      until: today.toISOString(),
    },
    generatedAt: new Date().toISOString(),
    setupRequired: marketplaceResult.error?.code === '42883',
    marketplace: marketplaceResult.data ?? {
      summary: {
        orders: 0,
        grossSales: 0,
        platformRevenue: 0,
        unitsSold: 0,
        productViews: 0,
        productVisitors: 0,
        newUsers: 0,
        newSellers: 0,
        newProducts: 0,
      },
      daily: [],
      topProducts: [],
      topSellers: [],
    },
    vercel,
  });
}
