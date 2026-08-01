'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { MarketplaceLicenseAuditView } from './license-audit-view';
import { MarketplacePayoutAccessDialog } from './payout-access-dialog';

export function ProtectedMarketplaceLicenseAuditView({ initialAccess }: { initialAccess: boolean }) {
  const router = useRouter();
  const [accessGranted, setAccessGranted] = useState(initialAccess);

  return (
    <>
      {accessGranted && <MarketplaceLicenseAuditView />}
      <MarketplacePayoutAccessDialog
        open={!accessGranted}
        description="กรอก PIN ผู้ดูแลระบบ 4 หลักเพื่อดูผู้ซื้อ สถานะชำระเงิน และรอบจ่ายเงินของ License"
        onClose={() => router.replace('/dashboard')}
        onGranted={() => setAccessGranted(true)}
      />
    </>
  );
}
