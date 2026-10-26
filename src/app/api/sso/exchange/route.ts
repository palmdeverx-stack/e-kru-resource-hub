import type { AppTokenPayload } from 'src/lib/auth-token';

import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { isActiveTokenAccount } from 'src/lib/auth-token';
import {
  ssoConfig,
  ssoChallenge,
  hashSsoValue,
  validSsoClient,
  validSsoVerifier,
} from 'src/lib/marketplace-sso';

// Server-to-server endpoint: client secret + PKCE, no cookie authentication or CORS.
export async function POST(request: Request) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    const config = ssoConfig();
    if (!validSsoClient(request, config.secret)) return fail('Unauthorized client', 401);
    if (
      !(await isActionAllowed({
        request,
        action: 'sso_exchange',
        maxAttempts: 60,
        windowSeconds: 60,
      }))
    )
      return fail('Too many requests', 429);
    const { code, code_verifier: verifier, redirect_uri: redirectUri } = await request.json();
    if (
      typeof code !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(code) ||
      !validSsoVerifier(verifier) ||
      redirectUri !== config.callback
    )
      return fail('Invalid SSO request', 400);
    const { data, error } = await supabaseAdmin.rpc('consume_marketplace_sso_code', {
      p_code_hash: hashSsoValue(code),
      p_challenge: ssoChallenge(verifier),
      p_redirect_uri: config.callback,
    });
    if (error) return fail('SSO temporarily unavailable', 503);
    const actor = data as AppTokenPayload | null;
    if (!actor || !(await isActiveTokenAccount(actor))) return fail('Invalid or expired code', 401);
    const table = actor.role === 'marketplace_user' ? 'marketplace_users' : 'app_users';
    const { data: user, error: userError } = await supabaseAdmin
      .from(table)
      .select('id,auth_user_id,first_name,last_name')
      .eq('id', actor.sub)
      .single();
    if (userError || !user) return fail('Account unavailable', 401);
    return NextResponse.json(
      {
        issuer: new URL(request.url).origin,
        subject: `${table}:${user.id}`,
        account_type: table,
        user_id: user.id,
        auth_user_id: user.auth_user_id ?? null,
        first_name: user.first_name,
        last_name: user.last_name,
        // Identity only. E-KRU must resolve its own memberships, roles and entitlements.
      },
      { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } }
    );
  } catch {
    return fail('Invalid request or SSO unavailable', 503);
  }
}
