'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { MarketplacePayoutAccessDialog } from './payout-access-dialog';
import { MarketplaceFinanceSettingsView } from './finance-settings-view';

type Props = {
  initialAccess: boolean;
};

export function ProtectedMarketplaceFinanceSettingsView({ initialAccess }: Props) {
  const router = useRouter();
  const [accessGranted, setAccessGranted] = useState(initialAccess);
  const handleAccessExpired = useCallback(() => setAccessGranted(false), []);

  return (
    <>
      <MarketplaceFinanceSettingsView
        accessGranted={accessGranted}
        onAccessExpired={handleAccessExpired}
      />
      <MarketplacePayoutAccessDialog
        open={!accessGranted}
        description="กรอก PIN ผู้ดูแลระบบ 4 หลักเพื่อดูยอดเงิน Stripe บัญชีธนาคาร และตั้งค่าการเงิน"
        onClose={() => router.replace('/dashboard')}
        onGranted={() => setAccessGranted(true)}
      />
    </>
  );
}
