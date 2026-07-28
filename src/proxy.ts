import type { AppRole } from 'src/lib/auth-token';

import { NextResponse, type NextRequest } from 'next/server';

import { paths } from 'src/routes/paths';

import { verifyAppToken, ACCESS_TOKEN_COOKIE } from 'src/lib/auth-token';

// ----------------------------------------------------------------------

const AREA_ROLES: Array<{ prefix: string; roles: AppRole[] }> = [
  {
    prefix: '/dashboard',
    roles: ['master_admin', 'school_admin', 'teacher', 'student', 'marketplace_user'],
  },
  { prefix: '/master', roles: ['master_admin'] },
  { prefix: '/admin', roles: ['school_admin'] },
  { prefix: '/teacher', roles: ['teacher'] },
  { prefix: '/student', roles: ['student'] },
];

function homeForRole(role: AppRole) {
  if (role === 'marketplace_user') return paths.marketplace.dashboard;
  if (role === 'master_admin') return paths.master.root;
  if (role === 'school_admin') return paths.admin.root;
  if (role === 'teacher') return paths.teacher.root;
  return paths.student.root;
}

export function proxy(request: NextRequest) {
  const area = AREA_ROLES.find(
    ({ prefix }) =>
      request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`)
  );
  if (!area) return NextResponse.next();

  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const caller = token ? verifyAppToken(token) : null;
  if (!caller) {
    const signInUrl = new URL(paths.auth.jwt.signIn, request.url);
    signInUrl.searchParams.set('returnTo', request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (!area.roles.includes(caller.role)) {
    return NextResponse.redirect(new URL(homeForRole(caller.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/master/:path*',
    '/admin/:path*',
    '/teacher/:path*',
    '/student/:path*',
  ],
};
