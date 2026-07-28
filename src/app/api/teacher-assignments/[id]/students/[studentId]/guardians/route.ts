import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  parseGuardianBody,
  GUARDIAN_PUBLIC_FIELDS,
  authorizeGuardianAccess,
} from 'src/lib/student-guardian';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string; studentId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id, studentId } = await params;
  const access = await authorizeGuardianAccess(request, id, studentId);
  if (!access) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('student_guardians')
    .select(GUARDIAN_PUBLIC_FIELDS)
    .eq('student_id', studentId)
    .eq('school_id', access.schoolId)
    .order('is_primary', { ascending: false })
    .order('created_at');

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ guardians: data });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id, studentId } = await params;
  const access = await authorizeGuardianAccess(request, id, studentId);
  if (!access) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const parsed = parseGuardianBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 });

  if (parsed.data.is_primary) {
    await supabaseAdmin
      .from('student_guardians')
      .update({ is_primary: false })
      .eq('student_id', studentId);
  }

  const { data, error } = await supabaseAdmin
    .from('student_guardians')
    .insert({ ...parsed.data, student_id: studentId, school_id: access.schoolId })
    .select(GUARDIAN_PUBLIC_FIELDS)
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ guardian: data }, { status: 201 });
}
