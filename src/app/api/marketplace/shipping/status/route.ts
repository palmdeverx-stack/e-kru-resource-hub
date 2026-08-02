import { NextResponse } from 'next/server';

import { getMarketplaceShippingConfig } from 'src/sections/marketplace/shipping/server/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await getMarketplaceShippingConfig();
  return NextResponse.json({
    enabled: config.enabled,
    officialAccessEnabled: config.officialAccessEnabled,
    officialEnabled: config.officialEnabled,
  });
}
