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
  try {
    const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_max_attempts: maxAttempts,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error('Rate limit check failed; request denied', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Rate limit check threw; request denied', error);
    return false;
  }
}

export async function isActionAllowed({
  request,
  action,
  subject,
  maxAttempts,
  windowSeconds,
}: {
  request: Request;
  action: string;
  subject?: string | null;
  maxAttempts: number;
  windowSeconds: number;
}) {
  const ip = getClientIp(request);
  const normalizedAction = action.replace(/[^a-z0-9:_-]/gi, '').slice(0, 80);
  const normalizedSubject = subject?.trim().toLowerCase().slice(0, 160);
  const checks = [
    checkRateLimit(`action:${normalizedAction}:ip:${ip}`, maxAttempts, windowSeconds),
  ];
  if (normalizedSubject) {
    checks.push(
      checkRateLimit(
        `action:${normalizedAction}:subject:${normalizedSubject}`,
        maxAttempts,
        windowSeconds
      )
    );
  }
  return (await Promise.all(checks)).every(Boolean);
}

export async function isSignInAllowed(request: Request, username: string): Promise<boolean> {
  const ip = getClientIp(request);

  const [ipAllowed, usernameAllowed] = await Promise.all([
    checkRateLimit(`ip:${ip}`, IP_MAX_ATTEMPTS, IP_WINDOW_SECONDS),
    checkRateLimit(
      `user:${username.toLowerCase()}`,
      USERNAME_MAX_ATTEMPTS,
      USERNAME_WINDOW_SECONDS
    ),
  ]);

  return ipAllowed && usernameAllowed;
}
