import { NextResponse } from 'next/server';

import { isValidCronSecret } from 'src/lib/cron-auth';

import { processMarketplacePayoutReminder } from 'src/sections/marketplace/admin/server/payout-line-reminder';

export async function GET(request: Request) {
  if (!isValidCronSecret(request)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 401 });
  }

  try {
    return NextResponse.json(await processMarketplacePayoutReminder());
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'แจ้งเตือนรอบโอนไม่สำเร็จ' },
      { status: 500 }
    );
  }
}
