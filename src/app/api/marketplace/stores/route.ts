import { NextResponse } from 'next/server';

import { getPublicStoreDirectory } from 'src/sections/marketplace/seller/server/public-store-directory';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get('q')?.trim().slice(0, 120) ?? '';
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    48,
    Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '24', 10) || 24)
  );
  try {
    return NextResponse.json(await getPublicStoreDirectory(search, page, limit));
  } catch {
    return NextResponse.json({ message: 'โหลดรายการร้านค้าไม่สำเร็จ' }, { status: 500 });
  }
}
