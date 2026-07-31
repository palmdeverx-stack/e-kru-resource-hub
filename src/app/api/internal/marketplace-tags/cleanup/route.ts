import { NextResponse } from 'next/server';

import { isValidCronSecret } from 'src/lib/cron-auth';

import { cleanupUnusedSellerTags } from 'src/sections/marketplace/seller/server/seller-tags';

export async function GET(request: Request) {
  if (!isValidCronSecret(request)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 401 });
  }

  const result = await cleanupUnusedSellerTags();
  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ deleted: result.deleted });
}
