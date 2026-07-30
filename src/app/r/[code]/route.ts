import { NextResponse, type NextRequest } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import {
  REFERRAL_COOKIE,
  getReferralSettings,
} from 'src/sections/marketplace/referrals/server/referrals';

type Context = { params: Promise<{ code: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const settings = await getReferralSettings();
  const requestedPath = request.nextUrl.searchParams.get('to') ?? '/';
  const destination =
    requestedPath.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/';
  const response = NextResponse.redirect(new URL(destination, request.url));
  if (!settings.is_enabled) return response;

  const { code: rawCode } = await params;
  const codeValue = rawCode.trim().toUpperCase();
  const { data: code } = await supabaseAdmin
    .from('marketplace_referral_codes')
    .select('id, code')
    .eq('code', codeValue)
    .eq('is_active', true)
    .maybeSingle();
  if (!code) return response;

  response.cookies.set(REFERRAL_COOKIE, code.code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Number(settings.attribution_days) * 86400,
  });
  await supabaseAdmin.from('marketplace_referral_clicks').insert({
    referral_code_id: code.id,
    landing_path: destination.slice(0, 500),
  });
  return response;
}
