import type { Metadata } from 'next';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  verifyAppToken,
  verifyPayoutAccess,
  ACCESS_TOKEN_COOKIE,
  PAYOUT_ACCESS_COOKIE,
} from 'src/lib/auth-token';

import { ProtectedMarketplacePayoutManagementView } from 'src/sections/marketplace/admin/view/protected-payout-management-view';

export const metadata: Metadata = { title: 'โอนเงินผู้ขาย | E-KRU Marketplace' };

export default async function Page() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const caller = accessToken ? verifyAppToken(accessToken) : null;
  if (!caller || caller.role !== 'master_admin') redirect('/dashboard');

  const payoutToken = cookieStore.get(PAYOUT_ACCESS_COOKIE)?.value;
  const initialAccess = Boolean(payoutToken && verifyPayoutAccess(payoutToken, caller.sub));

  return <ProtectedMarketplacePayoutManagementView initialAccess={initialAccess} />;
}
