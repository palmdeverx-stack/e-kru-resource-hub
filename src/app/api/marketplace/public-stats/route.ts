import { NextResponse } from 'next/server';

import { getPublicMarketplaceStats } from 'src/sections/marketplace/catalog/server/public-stats';

export async function GET() {
  try {
    return NextResponse.json(await getPublicMarketplaceStats(), {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json({ message: 'โหลดสถิติไม่สำเร็จ' }, { status: 503 });
  }
}
