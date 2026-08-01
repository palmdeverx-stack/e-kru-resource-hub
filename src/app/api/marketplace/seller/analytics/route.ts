import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

const ALLOWED_RANGES = new Set([7, 30, 90, 365]);

function bangkokStartOfToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  const dateKey = `${part('year')}-${part('month')}-${part('day')}`;
  return new Date(`${dateKey}T00:00:00+07:00`);
}

function emptyAnalytics() {
  return {
    summary: {
      products: 0,
      publishedProducts: 0,
      orders: 0,
      grossSales: 0,
      netRevenue: 0,
      unitsSold: 0,
      productViews: 0,
      visitors: 0,
    },
    daily: [],
    products: [],
    searchSummary: { searches: 0, uniqueTerms: 0, productImpressions: 0 },
    searchTerms: [],
  };
}

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const { data: seller, error: sellerError } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, display_name, status')
    .eq('owner_id', caller.sub)
    .maybeSingle();
  if (sellerError) return NextResponse.json({ message: sellerError.message }, { status: 500 });
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้าของคุณ' }, { status: 404 });

  const requestedDays = Number(new URL(request.url).searchParams.get('days'));
  const days = ALLOWED_RANGES.has(requestedDays) ? requestedDays : 30;
  const today = bangkokStartOfToday();
  const since = new Date(today);
  since.setDate(since.getDate() - (days - 1));
  const untilExclusive = new Date(today);
  untilExclusive.setDate(untilExclusive.getDate() + 1);

  const { data, error } = await supabaseAdmin.rpc('marketplace_seller_analytics', {
    target_seller_id: seller.id,
    since_at: since.toISOString(),
    until_at: untilExclusive.toISOString(),
  });
  if (error && !['42883', 'PGRST202'].includes(error.code)) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    seller,
    days,
    period: { since: since.toISOString(), until: today.toISOString() },
    generatedAt: new Date().toISOString(),
    setupRequired: Boolean(error),
    analytics: data ?? emptyAnalytics(),
  });
}
