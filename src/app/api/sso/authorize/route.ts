import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { ssoConfig, hashSsoValue } from 'src/lib/marketplace-sso';
import { requireAuthenticated, isActiveTokenAccount } from 'src/lib/auth-token';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    const config = ssoConfig();
    const url = new URL(request.url);
    const state = url.searchParams.get('state') || '';
    const challenge = url.searchParams.get('code_challenge') || '';
    if (
      url.searchParams.get('redirect_uri') !== config.callback ||
      url.searchParams.get('code_challenge_method') !== 'S256' ||
      !/^[A-Za-z0-9_-]{43}$/.test(challenge) ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(state)
    ) {
      return fail('Invalid SSO request', 400);
    }
    const caller = requireAuthenticated(request);
    if (!caller) {
      const signIn = new URL('/auth/sign-in', request.url);
      signIn.searchParams.set('returnTo', url.pathname + url.search);
      return NextResponse.redirect(signIn);
    }
    if (!(await isActiveTokenAccount(caller))) return fail('Session expired', 401);
    if (
      !(await isActionAllowed({
        request,
        action: 'sso_authorize',
        subject: caller.sub,
        maxAttempts: 20,
        windowSeconds: 60,
      }))
    )
      return fail('Too many requests', 429);
    const code = randomBytes(32).toString('base64url');
    const { error } = await supabaseAdmin.from('marketplace_sso_codes').insert({
      code_hash: hashSsoValue(code),
      actor: caller,
      challenge,
      redirect_uri: config.callback,
      expires_at: new Date(Date.now() + 60000).toISOString(),
    });
    if (error) return fail('SSO temporarily unavailable', 503);
    const callback = new URL(config.callback);
    callback.searchParams.set('code', code);
    callback.searchParams.set('state', state);
    const response = NextResponse.redirect(callback);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch {
    return fail('SSO is not configured or temporarily unavailable', 503);
  }
}
