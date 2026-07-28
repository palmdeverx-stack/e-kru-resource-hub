import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { parseGuardianBody, GUARDIAN_PUBLIC_FIELDS } from 'src/lib/student-guardian';
import { canViewViaPermission, canManageViaPermission } from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

async function authorize(
  request: Request,
  studentId: string,
  check: typeof canViewViaPermission
) {
  const caller = requireRole(request, ['school_admin', 'teacher']);
  if (!caller?.schoolId || !(await check(caller, 'students.manage'))) return null;
  const { data } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('id', studentId)
    .eq('school_id', caller.schoolId)
    .eq('role', 'student')
    .maybeSingle();
  return data ? caller : null;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const caller = await authorize(request, id, canViewViaPermission);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('student_guardians')
    .select(GUARDIAN_PUBLIC_FIELDS)
    .eq('student_id', id)
    .eq('school_id', caller.schoolId!)
    .order('is_primary', { ascending: false })
    .order('created_at');
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ guardians: data });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const caller = await authorize(request, id, canManageViaPermission);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const parsed = parseGuardianBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 });
  if (parsed.data.is_primary) {
    await supabaseAdmin
      .from('student_guardians')
      .update({ is_primary: false })
      .eq('student_id', id);
  }
  const { data, error } = await supabaseAdmin
    .from('student_guardians')
    .insert({ ...parsed.data, student_id: id, school_id: caller.schoolId! })
    .select(GUARDIAN_PUBLIC_FIELDS)
    .single();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ guardian: data }, { status: 201 });
}
