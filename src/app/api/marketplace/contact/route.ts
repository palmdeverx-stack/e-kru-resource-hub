import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';

const SUPPORT_EMAIL = 'ekru.team@gmail.com';

export async function GET() {
  const [lineResult, platformResult] = await Promise.all([
    supabaseAdmin
      .from('marketplace_line_settings')
      .select('oa_basic_id, line_display_name')
      .eq('id', 'default')
      .maybeSingle(),
    supabaseAdmin
      .from('marketplace_provider_settings')
      .select(
        'platform_name_th, brand_name, logo_url, transparent_logo_url, support_email, support_phone, line_oa_id, business_hours, footer_text, copyright_text'
      )
      .eq('id', 'default')
      .maybeSingle(),
  ]);
  const { data: settings, error } = lineResult;
  const platform = platformResult.data;

  if (error && error.code !== '42P01') {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (platformResult.error && platformResult.error.code !== '42P01') {
    return NextResponse.json({ message: platformResult.error.message }, { status: 500 });
  }

  const configuredLineId = platform?.line_oa_id || settings?.oa_basic_id;
  const basicId = configuredLineId
    ? `@${configuredLineId.replace(/^@+/, '')}`
    : null;

  return NextResponse.json(
    {
      email: platform?.support_email || SUPPORT_EMAIL,
      supportPhone: platform?.support_phone || null,
      businessHours: platform?.business_hours || null,
      platformName: platform?.platform_name_th || 'E-KRU Marketplace',
      brandName: platform?.brand_name || 'E-KRU',
      logoUrl: platform?.logo_url || null,
      transparentLogoUrl: platform?.transparent_logo_url || null,
      footerText: platform?.footer_text || null,
      copyrightText: platform?.copyright_text || null,
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
