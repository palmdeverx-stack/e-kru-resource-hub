'use client';

import { useEffect } from 'react';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { SplashScreen } from 'src/components/loading-screen';

// ----------------------------------------------------------------------

type MustChangePasswordGuardProps = {
  mustChangePassword?: boolean;
  children: React.ReactNode;
};

/**
 * Sends teacher/student accounts with an auto-generated password to the
 * change-password page before they can use the rest of the app.
 */
export function MustChangePasswordGuard({
  mustChangePassword,
  children,
}: MustChangePasswordGuardProps) {
  const router = useRouter();

  useEffect(() => {
    if (mustChangePassword) {
      router.replace(paths.auth.jwt.changePassword);
    }
  }, [mustChangePassword, router]);

  if (mustChangePassword) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
