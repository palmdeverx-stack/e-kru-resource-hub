import type { Metadata } from 'next';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  verifyAppToken,
  verifyPayoutAccess,
  ACCESS_TOKEN_COOKIE,
  PAYOUT_ACCESS_COOKIE,
} from 'src/lib/auth-token';

import { ProtectedMarketplaceFinanceSettingsView } from 'src/sections/marketplace/admin/view/protected-finance-settings-view';

export const metadata: Metadata = { title: 'ตั้งค่าการเงิน | E-KRU Marketplace' };

export default async function Page() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const caller = accessToken ? verifyAppToken(accessToken) : null;
  if (!caller || caller.role !== 'master_admin') redirect('/dashboard');

  const payoutToken = cookieStore.get(PAYOUT_ACCESS_COOKIE)?.value;
  const initialAccess = Boolean(payoutToken && verifyPayoutAccess(payoutToken, caller.sub));

  return <ProtectedMarketplaceFinanceSettingsView initialAccess={initialAccess} />;
}
