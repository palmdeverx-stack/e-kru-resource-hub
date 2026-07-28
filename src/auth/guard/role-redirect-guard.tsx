'use client';

import { useEffect } from 'react';

import { useRouter } from 'src/routes/hooks';

import { SplashScreen } from 'src/components/loading-screen';

import { getHomePathForRole } from '../utils/role-home-path';

// ----------------------------------------------------------------------

type RoleRedirectGuardProps = {
  currentRole?: string;
  allowedRoles: string[];
  children: React.ReactNode;
};

/**
 * Unlike RoleBasedGuard (shows a "Permission denied" page), this sends the
 * user straight to the area that matches their own role — used to keep the
 * master admin / school admin / teacher / student sections fully separate.
 */
export function RoleRedirectGuard({ currentRole, allowedRoles, children }: RoleRedirectGuardProps) {
  const router = useRouter();

  const isAllowed = !!currentRole && allowedRoles.includes(currentRole);

  useEffect(() => {
    if (currentRole && !isAllowed) {
      router.replace(getHomePathForRole(currentRole));
    }
  }, [currentRole, isAllowed, router]);

  if (!isAllowed) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
