import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';

const SUPPORT_EMAIL = 'ekru.team@gmail.com';

export async function GET() {
  const { data: settings, error } = await supabaseAdmin
    .from('marketplace_line_settings')
    .select('oa_basic_id, line_display_name')
    .eq('id', 'default')
    .maybeSingle();

  if (error && error.code !== '42P01') {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const basicId = settings?.oa_basic_id
    ? `@${settings.oa_basic_id.replace(/^@+/, '')}`
    : null;

  return NextResponse.json(
    {
      email: SUPPORT_EMAIL,
      line: basicId
        ? {
            basicId,
            displayName: settings?.line_display_name || 'E-KRU Marketplace',
            url: `https://line.me/R/ti/p/${encodeURIComponent(basicId)}`,
          }
        : null,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  );
}
