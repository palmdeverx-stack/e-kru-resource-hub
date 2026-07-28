import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

const IP_MAX_ATTEMPTS = 20;
const IP_WINDOW_SECONDS = 60;
const USERNAME_MAX_ATTEMPTS = 5;
const USERNAME_WINDOW_SECONDS = 60;

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim() || 'unknown';
}

async function checkRateLimit(
  identifier: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
    p_identifier: identifier,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error('Rate limit check failed', error);
    return true;
  }

  return data as boolean;
}

/**
 * Fails open on infra errors: a broken rate-limit check shouldn't lock
 * everyone out of sign-in.
 */
export async function isSignInAllowed(request: Request, username: string): Promise<boolean> {
  const ip = getClientIp(request);

  const [ipAllowed, usernameAllowed] = await Promise.all([
    checkRateLimit(`ip:${ip}`, IP_MAX_ATTEMPTS, IP_WINDOW_SECONDS),
    checkRateLimit(`user:${username.toLowerCase()}`, USERNAME_MAX_ATTEMPTS, USERNAME_WINDOW_SECONDS),
  ]);

  return ipAllowed && usernameAllowed;
}
