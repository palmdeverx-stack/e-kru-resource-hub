import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { createManagedUser } from 'src/lib/create-managed-user';

// ----------------------------------------------------------------------

const MAX_ROWS = 500;

type ImportRow = {
  row: number;
  studentCode?: string;
  nationalId?: string;
  namePrefix?: string;
  firstName?: string;
  lastName?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  nickname?: string;
  gender?: string;
  birthDate?: string;
  nationality?: string;
  ethnicity?: string;
  religion?: string;
  username?: string;
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const caller = requireRole(request, ['master_admin', 'school_admin', 'teacher']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { rows } = (await request.json()) as { rows?: ImportRow[] };

  if (!Array.isArray(rows) || !rows.length) {
    return NextResponse.json({ message: 'ไม่พบข้อมูลนักเรียนที่จะนำเข้า' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { message: `นำเข้าได้ครั้งละไม่เกิน ${MAX_ROWS} รายการ` },
      { status: 400 }
    );
  }

  // Sequential, not parallel: each row's seat-limit and duplicate checks must
  // see the effect of rows already inserted earlier in this same batch.
  const results: Array<{ row: number; success: boolean; studentCode?: string; message?: string }> =
    [];

  for (const row of rows) {
    const result = await createManagedUser(caller, {
      username: row.username ?? '',
      email: row.email,
      firstName: row.firstName ?? '',
      lastName: row.lastName ?? '',
      role: 'student',
      studentCode: row.studentCode,
      nationalId: row.nationalId,
      namePrefix: row.namePrefix,
      firstNameEn: row.firstNameEn,
      lastNameEn: row.lastNameEn,
      nickname: row.nickname,
      gender: row.gender,
      birthDate: row.birthDate,
      nationality: row.nationality,
      ethnicity: row.ethnicity,
      religion: row.religion,
      pendingConfirmation: true,
    });

    results.push(
      result.ok
        ? { row: row.row, success: true, studentCode: row.studentCode }
        : { row: row.row, success: false, studentCode: row.studentCode, message: result.message }
    );
  }

  const successCount = results.filter((result) => result.success).length;

  return NextResponse.json({
    results,
    successCount,
    failureCount: results.length - successCount,
  });
}
