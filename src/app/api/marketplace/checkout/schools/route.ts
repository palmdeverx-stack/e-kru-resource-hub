import { NextResponse } from 'next/server';

import { requireAuthenticated } from 'src/lib/auth-token';

import { getEligibleLicenseSchools } from 'src/sections/marketplace/checkout/server/school-targets';

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  try {
    return NextResponse.json({ schools: await getEligibleLicenseSchools(caller) });
  } catch {
    return NextResponse.json(
      { message: 'โหลดรายชื่อโรงเรียนไม่สำเร็จ กรุณาลองใหม่' },
      { status: 500 }
    );
  }
}
