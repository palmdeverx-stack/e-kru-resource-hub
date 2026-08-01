import type { AppRole } from 'src/lib/auth-token';

import { NextResponse, type NextRequest } from 'next/server';

import { paths } from 'src/routes/paths';

import {
  signAppToken,
  verifyAppToken,
  ACCESS_TOKEN_COOKIE,
  isActiveTokenAccount,
  accessTokenCookieOptions,
} from 'src/lib/auth-token';

// ----------------------------------------------------------------------

const AREA_ROLES: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: '/dashboard/master', roles: ['master_admin'] },
  { prefix: '/dashboard/seller-approvals', roles: ['master_admin', 'marketplace_admin'] },
  { prefix: '/dashboard/product-approvals', roles: ['master_admin'] },
  { prefix: '/dashboard/payment-reviews', roles: ['master_admin'] },
  { prefix: '/dashboard/receipts', roles: ['master_admin'] },
  { prefix: '/dashboard/payouts', roles: ['master_admin'] },
  {
    prefix: '/dashboard/settings/platform',
    roles: ['master_admin', 'marketplace_admin'],
  },
  {
    prefix: '/dashboard/settings/storage',
    roles: ['master_admin', 'marketplace_admin'],
  },
  {
    prefix: '/dashboard/settings/seller-badges',
    roles: ['master_admin', 'marketplace_admin'],
  },
  { prefix: '/dashboard/settings', roles: ['master_admin'] },
  { prefix: '/dashboard/licenses', roles: ['master_admin', 'school_admin'] },
  {
    prefix: '/dashboard/school-entitlements',
    roles: ['teacher', 'marketplace_user'],
  },
  {
    prefix: '/dashboard',
    roles: [
      'master_admin',
      'marketplace_admin',
      'school_admin',
      'teacher',
      'student',
      'marketplace_user',
    ],
  },
  {
    prefix: '/checkout',
    roles: [
      'master_admin',
      'marketplace_admin',
      'school_admin',
      'teacher',
      'student',
      'marketplace_user',
    ],
  },
  { prefix: '/master', roles: ['master_admin'] },
  { prefix: '/admin', roles: ['school_admin'] },
  { prefix: '/teacher', roles: ['teacher'] },
  { prefix: '/student', roles: ['student'] },
];

function homeForRole() {
  return paths.marketplace.dashboard;
}

function noIndex(response: NextResponse) {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  return response;
}

function nextWithSlidingSession(caller: ReturnType<typeof verifyAppToken>) {
  const response = NextResponse.next();
  const expiresAt = (caller as (typeof caller & { exp?: number }) | null)?.exp;
  if (caller && expiresAt && expiresAt - Math.floor(Date.now() / 1000) <= 10 * 60) {
    response.cookies.set(
      ACCESS_TOKEN_COOKIE,
      signAppToken({
        sub: caller.sub,
        username: caller.username,
        role: caller.role,
        schoolId: caller.schoolId,
        sessionVersion: caller.sessionVersion,
      }),
      accessTokenCookieOptions
    );
  }
  return noIndex(response);
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const caller = token ? verifyAppToken(token) : null;
  if (caller && !(await isActiveTokenAccount(caller))) {
    const response = request.nextUrl.pathname.startsWith('/api/')
      ? NextResponse.json({ message: 'Session หมดอายุหรือถูกเพิกถอน' }, { status: 401 })
      : NextResponse.redirect(new URL(paths.auth.jwt.signIn, request.url));
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    return noIndex(response);
  }
  const isAuthPage =
    request.nextUrl.pathname === '/auth' || request.nextUrl.pathname.startsWith('/auth/');

  if (isAuthPage && caller) {
    return noIndex(NextResponse.redirect(new URL(homeForRole(), request.url)));
  }

  const area = AREA_ROLES.find(
    ({ prefix }) =>
      request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`)
  );
  if (!area) return nextWithSlidingSession(caller);

  if (!caller) {
    const signInUrl = new URL(paths.auth.jwt.signIn, request.url);
    signInUrl.searchParams.set('returnTo', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return noIndex(NextResponse.redirect(signInUrl));
  }

  if (!area.roles.includes(caller.role)) {
    return noIndex(NextResponse.redirect(new URL(homeForRole(), request.url)));
  }

  return nextWithSlidingSession(caller);
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/checkout/:path*',
    '/auth/:path*',
    '/master/:path*',
    '/admin/:path*',
    '/teacher/:path*',
    '/student/:path*',
    '/api/:path*',
  ],
};
