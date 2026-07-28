'use client';

import { useEffect } from 'react';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { SplashScreen } from 'src/components/loading-screen';

// ----------------------------------------------------------------------

type AcceptLegalGuardProps = {
  acceptedLegalAt?: string | null;
  children: React.ReactNode;
};

/**
 * Blocks every role from using the app until they accept the current terms
 * of service / privacy policy — checked once per session via `accepted_legal_at`
 * on the user record (null means not yet accepted).
 */
export function AcceptLegalGuard({ acceptedLegalAt, children }: AcceptLegalGuardProps) {
  const router = useRouter();
  const hasAccepted = !!acceptedLegalAt;

  useEffect(() => {
    if (!hasAccepted) {
      router.replace(paths.auth.jwt.acceptLegal);
    }
  }, [hasAccepted, router]);

  if (!hasAccepted) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
