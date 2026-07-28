import type { StudentPerson } from 'src/lib/student-dashboard-queries';

import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import {
  buildRanking,
  fetchStudent,
  toEnrollments,
  fetchClassmates,
  fetchEnrollments,
  fetchTeachingRows,
  fetchAnnouncements,
  fetchRankingScores,
  pickCurrentEnrollment,
  fetchHomeroomTeachers,
  fetchAssignmentsForRanking,
  filterVisibleAnnouncements,
} from 'src/lib/student-dashboard-queries';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const generatedAt = new Date().toISOString();
  const caller = requireRole(request, ['student']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const [{ data: student, error: studentError }, { data: enrollmentRows, error: enrollmentError }] =
    await Promise.all([fetchStudent(caller.sub), fetchEnrollments(caller.sub)]);

  if (studentError || enrollmentError) {
    return NextResponse.json(
      { message: studentError?.message ?? enrollmentError?.message },
      { status: 500 }
    );
  }

  if (!student) {
    return NextResponse.json({ message: 'ไม่พบข้อมูลนักเรียน' }, { status: 404 });
  }

  const enrollments = toEnrollments(enrollmentRows ?? []);
  const currentEnrollment = pickCurrentEnrollment(enrollments);
  const currentClassroomId = currentEnrollment?.classroom?.id;

  const { data: announcementRows, error: announcementError } = caller.schoolId
    ? await fetchAnnouncements(caller.schoolId)
    : { data: [], error: null };

  if (announcementError) {
    return NextResponse.json({ message: announcementError.message }, { status: 500 });
  }

  const visibleAnnouncements = filterVisibleAnnouncements(announcementRows ?? [], currentClassroomId);

  if (!currentClassroomId) {
    return NextResponse.json({
      generated_at: generatedAt,
      student,
      enrollments,
      class_members: [],
      homeroom_teachers: [],
      ranking: [],
      subject_rankings: [],
      announcements: visibleAnnouncements,
    });
  }

  const { data: teachingRows, error: teachingError } = await fetchTeachingRows([currentClassroomId]);

  if (teachingError) {
    return NextResponse.json({ message: teachingError.message }, { status: 500 });
  }

  const teachingIds = (teachingRows ?? []).map((row) => row.id);

  const [
    { data: assignmentRows, error: assignmentError },
    { data: classmateRows, error: classmateError },
    { data: homeroomRows, error: homeroomError },
  ] = await Promise.all([
    teachingIds.length
      ? fetchAssignmentsForRanking(teachingIds)
      : Promise.resolve({ data: [], error: null }),
    fetchClassmates(currentClassroomId),
    fetchHomeroomTeachers(currentClassroomId),
  ]);

  if (assignmentError || classmateError || homeroomError) {
    return NextResponse.json(
      { message: assignmentError?.message ?? classmateError?.message ?? homeroomError?.message },
      { status: 500 }
    );
  }

  const assignments = assignmentRows ?? [];
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const { data: rankingScoreRows, error: rankingScoreError } = assignmentIds.length
    ? await fetchRankingScores(assignmentIds)
    : { data: [], error: null };

  if (rankingScoreError) {
    return NextResponse.json({ message: rankingScoreError.message }, { status: 500 });
  }

  const classmates = (classmateRows ?? []).map((row) => ({
    student_number: row.student_number,
    student: row.student as unknown as StudentPerson,
  }));
  const classMembers = classmates.map((row) => ({
    student: row.student,
    student_number: row.student_number,
    is_current_student: row.student.id === caller.sub,
  }));
  const homeroomTeachers = (homeroomRows ?? []).map(
    (row) => row.teacher as unknown as StudentPerson
  );
  const rankingScores = rankingScoreRows ?? [];

  const ranking = buildRanking({
    assignments,
    scores: rankingScores,
    classmates,
    currentStudentId: caller.sub,
  });
  const subjectRankings = (teachingRows ?? []).map((teaching) => ({
    id: teaching.id,
    subject: teaching.subject,
    semester: teaching.semester,
    ranking: buildRanking({
      assignments: assignments.filter((assignment) => assignment.teacher_assignment_id === teaching.id),
      scores: rankingScores,
      classmates,
      currentStudentId: caller.sub,
    }),
  }));

  return NextResponse.json({
    generated_at: generatedAt,
    student,
    enrollments,
    class_members: classMembers,
    homeroom_teachers: homeroomTeachers,
    ranking,
    subject_rankings: subjectRankings,
    announcements: visibleAnnouncements,
  });
}
