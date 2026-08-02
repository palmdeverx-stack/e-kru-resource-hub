import type { Metadata } from 'next';

import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { verifyAppToken, ACCESS_TOKEN_COOKIE } from 'src/lib/auth-token';

import { getMarketplaceShippingConfig } from 'src/sections/marketplace/shipping/server/config';
import { SellerShippingView } from 'src/sections/marketplace/shipping/view/seller-shipping-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'การจัดส่ง | E-KRU Marketplace' };

export default async function Page() {
  const config = await getMarketplaceShippingConfig();
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const caller = token ? verifyAppToken(token) : null;
  const officialAccess = caller?.role === 'master_admin' && config.officialAccessEnabled;
  if (!config.enabled && !officialAccess) notFound();

  return <SellerShippingView />;
}
