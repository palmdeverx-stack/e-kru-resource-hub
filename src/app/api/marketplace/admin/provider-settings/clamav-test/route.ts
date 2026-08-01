import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import {
  isValidClamAvHost,
  isValidClamAvPort,
  testClamAvConnection,
} from 'src/lib/malware-scanner';

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  if (!requireRole(request, ['master_admin', 'marketplace_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ทดสอบการเชื่อมต่อ ClamAV' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const host = String(body?.host ?? '').trim();
  const port = Number(body?.port ?? 3310);
  if (!host || !isValidClamAvHost(host) || !isValidClamAvPort(port)) {
    return NextResponse.json(
      { message: 'กรุณาระบุ CLAMAV_HOST และ CLAMAV_PORT ให้ถูกต้อง' },
      { status: 400 }
    );
  }

  try {
    const response = await testClamAvConnection({ host, port });
    return NextResponse.json({ success: true, response });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ทดสอบ ClamAV ไม่สำเร็จ' },
      { status: 502 }
    );
  }
}
