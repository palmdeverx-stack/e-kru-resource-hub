import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canManageViaPermission } from 'src/lib/department-permission-access';
import { parseGuardianBody, GUARDIAN_PUBLIC_FIELDS } from 'src/lib/student-guardian';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string; guardianId: string }> };

async function authorize(request: Request, studentId: string) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId || !(await canManageViaPermission(caller, 'students.manage'))) return null;
  const { data } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('id', studentId)
    .eq('school_id', caller.schoolId)
    .eq('role', 'student')
    .maybeSingle();
  return data ? caller : null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id, guardianId } = await params;
  const caller = await authorize(request, id);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  const parsed = parseGuardianBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 });
  if (parsed.data.is_primary) {
    await supabaseAdmin
      .from('student_guardians')
      .update({ is_primary: false })
      .eq('student_id', id)
      .neq('id', guardianId);
  }
  const { data, error } = await supabaseAdmin
    .from('student_guardians')
    .update(parsed.data)
    .eq('id', guardianId)
    .eq('student_id', id)
    .eq('school_id', caller.schoolId!)
    .select(GUARDIAN_PUBLIC_FIELDS)
    .maybeSingle();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'ไม่พบข้อมูลผู้ปกครอง' }, { status: 404 });
  return NextResponse.json({ guardian: data });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id, guardianId } = await params;
  const caller = await authorize(request, id);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  const { error, count } = await supabaseAdmin
    .from('student_guardians')
    .delete({ count: 'exact' })
    .eq('id', guardianId)
    .eq('student_id', id)
    .eq('school_id', caller.schoolId!);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ message: 'ไม่พบข้อมูลผู้ปกครอง' }, { status: 404 });
  return NextResponse.json({ success: true });
}
