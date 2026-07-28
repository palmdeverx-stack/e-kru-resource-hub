import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  parseGuardianBody,
  GUARDIAN_PUBLIC_FIELDS,
  authorizeGuardianAccess,
} from 'src/lib/student-guardian';

// ----------------------------------------------------------------------

type RouteParams = {
  params: Promise<{ id: string; studentId: string; guardianId: string }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id, studentId, guardianId } = await params;
  const access = await authorizeGuardianAccess(request, id, studentId);
  if (!access) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const parsed = parseGuardianBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 });

  if (parsed.data.is_primary) {
    await supabaseAdmin
      .from('student_guardians')
      .update({ is_primary: false })
      .eq('student_id', studentId)
      .neq('id', guardianId);
  }

  const { data, error } = await supabaseAdmin
    .from('student_guardians')
    .update(parsed.data)
    .eq('id', guardianId)
    .eq('student_id', studentId)
    .eq('school_id', access.schoolId)
    .select(GUARDIAN_PUBLIC_FIELDS)
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'ไม่พบข้อมูลผู้ปกครอง' }, { status: 404 });
  return NextResponse.json({ guardian: data });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id, studentId, guardianId } = await params;
  const access = await authorizeGuardianAccess(request, id, studentId);
  if (!access) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { error, count } = await supabaseAdmin
    .from('student_guardians')
    .delete({ count: 'exact' })
    .eq('id', guardianId)
    .eq('student_id', studentId)
    .eq('school_id', access.schoolId);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ message: 'ไม่พบข้อมูลผู้ปกครอง' }, { status: 404 });
  return NextResponse.json({ success: true });
}
