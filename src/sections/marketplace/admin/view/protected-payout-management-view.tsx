'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { MarketplacePayoutAccessDialog } from './payout-access-dialog';
import { MarketplacePayoutManagementView } from './payout-management-view';

type Props = {
  initialAccess: boolean;
};

export function ProtectedMarketplacePayoutManagementView({ initialAccess }: Props) {
  const router = useRouter();
  const [accessGranted, setAccessGranted] = useState(initialAccess);

  return (
    <>
      <MarketplacePayoutManagementView accessGranted={accessGranted} />
      <MarketplacePayoutAccessDialog
        open={!accessGranted}
        onClose={() => router.replace('/dashboard')}
        onGranted={() => setAccessGranted(true)}
      />
    </>
  );
}
