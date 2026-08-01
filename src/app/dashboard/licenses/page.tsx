import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  verifyAppToken,
  verifyPayoutAccess,
  ACCESS_TOKEN_COOKIE,
  PAYOUT_ACCESS_COOKIE,
} from 'src/lib/auth-token';

import { MarketplaceSchoolLicensesView } from 'src/sections/marketplace/account/view/school-licenses-view';
import { ProtectedMarketplaceLicenseAuditView } from 'src/sections/marketplace/admin/view/protected-license-audit-view';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const caller = token ? verifyAppToken(token) : null;
  if (caller?.role === 'master_admin') {
    const payoutToken = cookieStore.get(PAYOUT_ACCESS_COOKIE)?.value;
    const initialAccess = Boolean(payoutToken && verifyPayoutAccess(payoutToken, caller.sub));
    return <ProtectedMarketplaceLicenseAuditView initialAccess={initialAccess} />;
  }
  if (caller?.role !== 'school_admin') redirect('/dashboard');
  return <MarketplaceSchoolLicensesView />;
}
