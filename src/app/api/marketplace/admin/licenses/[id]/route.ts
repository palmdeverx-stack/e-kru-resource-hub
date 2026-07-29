import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';

import { revokeSchoolLicense } from 'src/sections/marketplace/checkout/server/license-lifecycle';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'เฉพาะผู้ดูแล Marketplace เท่านั้น' }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const reason = String(body?.reason ?? '').trim();
  if (body?.action !== 'revoke' || reason.length < 3) {
    return NextResponse.json({ message: 'กรุณาระบุเหตุผลการยกเลิก License' }, { status: 400 });
  }

  try {
    const license = await revokeSchoolLicense(id, 'revoked', reason);
    if (!license) {
      return NextResponse.json({ message: 'ไม่พบ License ที่กำลังใช้งาน' }, { status: 404 });
    }
    return NextResponse.json({ license: { ...license, status: 'revoked' } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ยกเลิก License ไม่สำเร็จ' },
      { status: 500 }
    );
  }
}
