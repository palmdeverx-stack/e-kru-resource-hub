import 'server-only';

import jwt from 'jsonwebtoken';

// ----------------------------------------------------------------------

const rawSecret = process.env.AUTH_JWT_SECRET;

if (!rawSecret) {
  throw new Error('Missing AUTH_JWT_SECRET environment variable');
}

const secret: string = rawSecret;
const pinChallengeSecret = `${secret}:pin-challenge`;

export const ACCESS_TOKEN_COOKIE = 'access_token';
const ACCESS_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export const accessTokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
};

export type AppRole =
  | 'master_admin'
  | 'super_admin'
  | 'school_admin'
  | 'teacher'
  | 'student'
  | 'marketplace_user';

export type AppTokenPayload = {
  sub: string;
  username: string;
  role: AppRole;
  schoolId: string | null;
};

type PinChallengePayload = {
  sub: string;
  purpose: 'pin_verification';
};

export function signAppToken(payload: AppTokenPayload): string {
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyAppToken(token: string): AppTokenPayload | null {
  try {
    return jwt.verify(token, secret) as AppTokenPayload;
  } catch {
    return null;
  }
}

export function signPinChallenge(userId: string): string {
  return jwt.sign({ sub: userId, purpose: 'pin_verification' }, pinChallengeSecret, {
    expiresIn: '5m',
  });
}

export function verifyPinChallenge(token: string): PinChallengePayload | null {
  try {
    const payload = jwt.verify(token, pinChallengeSecret) as PinChallengePayload;
    return payload.purpose === 'pin_verification' && payload.sub ? payload : null;
  } catch {
    return null;
  }
}

function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) continue;
    if (part.slice(0, separatorIndex).trim() === name) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }
  return null;
}

/** The access token lives in an httpOnly cookie — never in a client-readable header or storage. */
export function getRequestToken(request: Request): string | null {
  return getCookieValue(request, ACCESS_TOKEN_COOKIE);
}

/** Returns the caller's token payload if it's authenticated and has one of `roles`, else null. */
export function requireRole(request: Request, roles: AppRole[]): AppTokenPayload | null {
  const token = getRequestToken(request);
  const payload = token ? verifyAppToken(token) : null;

  return payload && roles.includes(payload.role) ? payload : null;
}

export function requireAuthenticated(request: Request): AppTokenPayload | null {
  const token = getRequestToken(request);
  return token ? verifyAppToken(token) : null;
}

type AppUserRow = {
  id: string;
  username: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: AppRole;
  school_id: string | null;
  avatar_url?: string | null;
  created_at: string;
  must_change_password?: boolean;
  is_active?: boolean;
  accepted_legal_at?: string | null;
  is_school_director?: boolean;
  staff_type?: string | null;
  position_title?: string | null;
  employment_status?: string | null;
};

export function toPublicUser(user: AppUserRow) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    school_id: user.school_id,
    avatar_url: user.avatar_url ?? null,
    photoURL: user.avatar_url ?? null,
    created_at: user.created_at,
    must_change_password: user.must_change_password ?? false,
    is_active: user.is_active ?? true,
    accepted_legal_at: user.accepted_legal_at ?? null,
    is_school_director: user.is_school_director ?? false,
    staff_type: user.staff_type ?? null,
    position_title: user.position_title ?? null,
    employment_status: user.employment_status ?? null,
  };
}
