import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { hasTimetableCapability, revertScheduleApprovalOnEdit } from 'src/lib/schedule-access';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 12, 1), 50);
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
  const search = searchParams.get('search')?.trim() || null;
  const classroomId = searchParams.get('classroomId') || null;

  const { data, error } = await supabaseAdmin.rpc('search_teacher_assignments', {
    p_school_id: caller.schoolId,
    p_teacher_id: caller.role === 'teacher' ? caller.sub : null,
    p_classroom_id: classroomId,
    p_search: search,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  type SearchRow = {
    id: string;
    created_at: string;
    teacher: unknown;
    subject: unknown;
    classroom: unknown;
    semester: unknown;
    total_count: number | string;
  };
  const rows: SearchRow[] = data ?? [];
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const teacherIds = Array.from(
    new Set(
      rows.flatMap(({ teacher }) => {
        const teacherId =
          teacher && typeof teacher === 'object' && 'id' in teacher ? teacher.id : null;
        return typeof teacherId === 'string' ? [teacherId] : [];
      })
    )
  );
  const { data: teacherProfiles, error: teacherProfilesError } = teacherIds.length
    ? await supabaseAdmin
        .from('app_users')
        .select('id, avatar_url')
        .in('id', teacherIds)
        .eq('school_id', caller.schoolId)
        .eq('role', 'teacher')
    : { data: [], error: null };

  if (teacherProfilesError) {
    return NextResponse.json({ message: teacherProfilesError.message }, { status: 500 });
  }

  const teacherAvatarById = new Map(
    teacherProfiles.map((teacher) => [teacher.id, teacher.avatar_url])
  );
  const teacherAssignments = rows.map(
    ({ id, created_at, teacher, subject, classroom, semester }) => {
      const teacherRecord =
        teacher && typeof teacher === 'object'
          ? (teacher as Record<string, unknown>)
          : ({} as Record<string, unknown>);
      const teacherId = typeof teacherRecord.id === 'string' ? teacherRecord.id : '';

      return {
        id,
        created_at,
        teacher: {
          ...teacherRecord,
          avatar_url: teacherAvatarById.get(teacherId) ?? null,
        },
        subject,
        classroom,
        semester,
      };
    }
  );

  return NextResponse.json({
    teacherAssignments,
    total,
    hasMore: offset + teacherAssignments.length < total,
  });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const canManageAssignments =
    caller.role === 'school_admin' ||
    (await hasTimetableCapability(caller.sub, caller.schoolId));

  if (!canManageAssignments) {
    return NextResponse.json(
      { message: 'ไม่มีสิทธิ์เพิ่มรายวิชาที่สอน กรุณาติดต่อผู้ดูแลโรงเรียน' },
      { status: 403 }
    );
  }

  const { teacherId, subjectId, classroomId, semesterId } = await request.json();
  const resolvedTeacherId = teacherId || caller.sub;

  if (!resolvedTeacherId || !subjectId || !classroomId || !semesterId) {
    return NextResponse.json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
  }

  const [{ data: teacher }, { data: subject }, { data: classroom }, { data: semester }] =
    await Promise.all([
      supabaseAdmin
        .from('app_users')
        .select('id')
        .eq('id', resolvedTeacherId)
        .eq('role', 'teacher')
        .eq('school_id', caller.schoolId)
        .maybeSingle(),
      supabaseAdmin
        .from('subjects')
        .select('id, academic_year_id')
        .eq('id', subjectId)
        .eq('semester_id', semesterId)
        .eq('school_id', caller.schoolId)
        .maybeSingle(),
      supabaseAdmin
        .from('classrooms')
        .select('id, academic_year_id')
        .eq('id', classroomId)
        .eq('school_id', caller.schoolId)
        .maybeSingle(),
      supabaseAdmin
        .from('semesters')
        .select('id, academic_year_id, academic_years!inner(school_id)')
        .eq('id', semesterId)
        .eq('academic_years.school_id', caller.schoolId)
        .maybeSingle(),
    ]);

  if (!teacher || !subject || !classroom || !semester) {
    return NextResponse.json(
      { message: 'ไม่พบครู วิชา ห้องเรียน หรือภาคเรียนนี้ในโรงเรียนของคุณ' },
      { status: 404 }
    );
  }

  if (
    subject.academic_year_id !== classroom.academic_year_id ||
    subject.academic_year_id !== semester.academic_year_id
  ) {
    return NextResponse.json(
      { message: 'รายวิชา ห้องเรียน และภาคเรียนต้องอยู่ในปีการศึกษาเดียวกัน' },
      { status: 400 }
    );
  }

  const { data: existingAssignment } = await supabaseAdmin
    .from('teacher_assignments')
    .select(
      'teacher:app_users!teacher_assignments_teacher_id_fkey(first_name, last_name, username)'
    )
    .eq('classroom_id', classroomId)
    .eq('subject_id', subjectId)
    .eq('semester_id', semesterId)
    .maybeSingle();

  if (existingAssignment) {
    const existingTeacher = existingAssignment.teacher as unknown as {
      first_name: string | null;
      last_name: string | null;
      username: string;
    };
    const existingTeacherName =
      [existingTeacher.first_name, existingTeacher.last_name].filter(Boolean).join(' ') ||
      existingTeacher.username;

    return NextResponse.json(
      {
        message: `วิชานี้ในห้องนี้มีครูผู้สอนอยู่แล้วคือ "${existingTeacherName}" ห้องเรียนหนึ่งสามารถมีครูสอนวิชาเดียวกันได้เพียง 1 คนต่อภาคเรียน`,
      },
      { status: 409 }
    );
  }

  const { data: assignment, error } = await supabaseAdmin
    .from('teacher_assignments')
    .insert({
      teacher_id: resolvedTeacherId,
      subject_id: subjectId,
      classroom_id: classroomId,
      semester_id: semesterId,
    })
    .select('id, teacher_id, subject_id, classroom_id, semester_id, created_at')
    .single();

  if (error || !assignment) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { message: 'วิชานี้ในห้องนี้มีครูผู้สอนอยู่แล้วในภาคเรียนนี้' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: error?.message ?? 'Failed to create teacher assignment' },
      { status: 500 }
    );
  }

  await revertScheduleApprovalOnEdit(classroomId, semesterId);

  return NextResponse.json({ teacherAssignment: assignment }, { status: 201 });
}
