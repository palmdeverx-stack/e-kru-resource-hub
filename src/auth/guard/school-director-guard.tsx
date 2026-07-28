'use client';

import { useEffect } from 'react';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { SplashScreen } from 'src/components/loading-screen';

import { useAuthContext } from '../hooks';

// ----------------------------------------------------------------------

/**
 * Viewing the schedule-approval pages requires schedule.approve. The API and
 * detail UI separately require manage level before the approval action.
 */
export function SchoolDirectorGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const router = useRouter();

  const isAllowed =
    user?.role === 'school_admin' ||
    (user?.department_permissions ?? []).includes('schedule.approve');

  useEffect(() => {
    if (user && !isAllowed) {
      router.replace(paths.page404);
    }
  }, [user, isAllowed, router]);

  if (!user || !isAllowed) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
