import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canViewViaPermission } from 'src/lib/department-permission-access';
import {
  loadTeacherAssignment,
  canAccessTeacherAssignment,
} from 'src/lib/teacher-assignment-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

const CATEGORY_ORDER = ['assignment', 'quiz', 'midterm', 'final', 'other'];

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const teacherAssignment = await loadTeacherAssignment(id);
  const canReviewGrades =
    (await canViewViaPermission(caller, 'grades.review')) ||
    (await canViewViaPermission(caller, 'grades.approve'));
  const assignmentSchoolId = (
    teacherAssignment?.classrooms as unknown as { school_id: string } | null
  )?.school_id;
  if (
    (!canAccessTeacherAssignment(caller, teacherAssignment) && !canReviewGrades) ||
    assignmentSchoolId !== caller.schoolId
  ) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึงรายวิชานี้' }, { status: 403 });
  }

  const [{ data: assignments, error: assignmentError }, { data: enrollments, error: rosterError }] =
    await Promise.all([
      supabaseAdmin
        .from('assignments')
        .select('id, title, full_score, category, created_at')
        .eq('teacher_assignment_id', id)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('enrollments')
        .select(
          `id, student_number,
           student:app_users!enrollments_student_id_fkey!inner(
             id, username, first_name, last_name, nickname, student_code, national_id, school_id, role
           )`
        )
        .eq('classroom_id', teacherAssignment!.classroom_id)
        .eq('student.school_id', caller.schoolId)
        .eq('student.role', 'student')
        .order('student_number', { ascending: true, nullsFirst: false }),
    ]);

  if (assignmentError || rosterError) {
    return NextResponse.json(
      { message: assignmentError?.message ?? rosterError?.message },
      { status: 500 }
    );
  }

  const sortedAssignments = [...(assignments ?? [])].sort((left, right) => {
    const categoryDifference =
      CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
    if (categoryDifference) return categoryDifference;
    return left.created_at.localeCompare(right.created_at);
  });
  const assignmentIds = sortedAssignments.map((assignment) => assignment.id);
  const { data: scores, error: scoreError } = assignmentIds.length
    ? await supabaseAdmin
        .from('scores')
        .select('assignment_id, student_id, score, status')
        .in('assignment_id', assignmentIds)
    : { data: [], error: null };

  if (scoreError) {
    return NextResponse.json({ message: scoreError.message }, { status: 500 });
  }

  const studentIds = (enrollments ?? []).flatMap((enrollment) => {
    const student = Array.isArray(enrollment.student) ? enrollment.student[0] : enrollment.student;
    return student?.id ? [student.id] : [];
  });
  const [{ data: specialResults }, { data: termAssessments }] = studentIds.length
    ? await Promise.all([
        supabaseAdmin
          .from('teacher_assignment_student_results')
          .select('student_id, special_result')
          .eq('teacher_assignment_id', id)
          .in('student_id', studentIds),
        supabaseAdmin
          .from('student_term_assessments')
          .select(
            'student_id, desirable_attributes_level, reading_thinking_writing_level, activity_result'
          )
          .eq('semester_id', teacherAssignment!.semester_id)
          .in('student_id', studentIds),
      ])
    : [{ data: [] }, { data: [] }];
  const specialResultByStudent = new Map(
    (specialResults ?? []).map((item) => [item.student_id, item.special_result])
  );
  const assessmentByStudent = new Map(
    (termAssessments ?? []).map((item) => [item.student_id, item])
  );

  const scoreByStudent = new Map<string, Map<string, (typeof scores)[number]>>();
  (scores ?? []).forEach((score) => {
    const studentScores = scoreByStudent.get(score.student_id) ?? new Map();
    studentScores.set(score.assignment_id, score);
    scoreByStudent.set(score.student_id, studentScores);
  });

  const students = (enrollments ?? []).flatMap((enrollment) => {
    const student = Array.isArray(enrollment.student) ? enrollment.student[0] : enrollment.student;
    if (!student) return [];

    const studentScores = scoreByStudent.get(student.id);
    const assessment = assessmentByStudent.get(student.id);
    return [
      {
        id: student.id,
        studentNumber: enrollment.student_number,
        studentCode: student.student_code,
        nationalId: student.national_id,
        username: student.username,
        firstName: student.first_name,
        lastName: student.last_name,
        nickname: student.nickname,
        specialResult: specialResultByStudent.get(student.id) ?? null,
        desirableAttributesLevel: assessment?.desirable_attributes_level ?? null,
        readingThinkingWritingLevel: assessment?.reading_thinking_writing_level ?? null,
        activityResult: assessment?.activity_result ?? null,
        scores: Object.fromEntries(
          sortedAssignments.map((assignment) => {
            const score = studentScores?.get(assignment.id);
            return [
              assignment.id,
              {
                score: score?.score ?? null,
                status: score?.status ?? 'not_submitted',
              },
            ];
          })
        ),
      },
    ];
  });

  const classroom = teacherAssignment!.classrooms as unknown as {
    name: string;
    grade_level: string | null;
    academic_years: { year: string } | null;
  };
  const subject = teacherAssignment!.subjects as unknown as {
    name: string;
    code: string | null;
    credits: number | string | null;
  };
  const semester = teacherAssignment!.semesters as unknown as { name: string };
  const teacher = teacherAssignment!.teacher as unknown as {
    first_name: string | null;
    last_name: string | null;
    username: string;
  };
  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('name, logo_url')
    .eq('id', caller.schoolId)
    .maybeSingle();

  return NextResponse.json({
    report: {
      teacherAssignmentId: id,
      semesterId: teacherAssignment!.semester_id,
      schoolName: school?.name ?? '',
      schoolLogoUrl: school?.logo_url ?? null,
      teacher: {
        firstName: teacher?.first_name ?? null,
        lastName: teacher?.last_name ?? null,
        username: teacher?.username ?? '',
      },
      subject: {
        name: subject?.name ?? '',
        code: subject?.code ?? null,
        credits: Number(subject?.credits ?? 0),
      },
      classroom: {
        id: teacherAssignment!.classroom_id,
        name: classroom?.name ?? '',
        gradeLevel: classroom?.grade_level ?? null,
        academicYear: classroom?.academic_years?.year ?? null,
      },
      semesterName: semester?.name ?? null,
      assignments: sortedAssignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        category: assignment.category,
        fullScore: Number(assignment.full_score),
      })),
      students,
    },
  });
}
