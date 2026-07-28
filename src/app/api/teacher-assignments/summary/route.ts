import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  let query = supabaseAdmin
    .from('teacher_assignments')
    .select(
      `subject_id, classroom_id, semester_id,
       teacher:app_users!teacher_assignments_teacher_id_fkey!inner(school_id),
       subject:subjects!inner(school_id),
       classroom:classrooms!inner(id, name, school_id)`
    )
    .eq('teacher.school_id', caller.schoolId)
    .eq('subject.school_id', caller.schoolId)
    .eq('classroom.school_id', caller.schoolId);

  if (caller.role === 'teacher') {
    query = query.eq('teacher_id', caller.sub);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const classroomOptions = new Map(
    rows.map((row) => [
      (row.classroom as unknown as { id: string; name: string }).id,
      (row.classroom as unknown as { id: string; name: string }).name,
    ])
  );

  return NextResponse.json({
    classes: rows.length,
    subjects: new Set(rows.map((row) => row.subject_id)).size,
    classrooms: classroomOptions.size,
    semesters: new Set(rows.map((row) => row.semester_id)).size,
    classroomOptions: Array.from(classroomOptions, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'th')
    ),
  });
}
