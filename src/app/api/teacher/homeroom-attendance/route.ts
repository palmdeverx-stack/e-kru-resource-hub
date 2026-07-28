import { after, NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  queueAttendanceNotifications,
  processPendingLineNotifications,
} from 'src/lib/line-notifications';

const PERIODS = ['morning', 'evening'] as const;
const STATUSES = ['present', 'absent', 'leave', 'late'] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type AttendancePeriod = (typeof PERIODS)[number];
type AttendanceStatus = (typeof STATUSES)[number];
type NormalizedRecord = {
  studentId: string;
  status: AttendanceStatus | null;
  note: string;
};

async function getOwnedClassroom(classroomId: string, teacherId: string, schoolId: string) {
  const { data } = await supabaseAdmin
    .from('classroom_homeroom_teachers')
    .select('classroom:classrooms!inner(id, name, school_id)')
    .eq('classroom_id', classroomId)
    .eq('teacher_id', teacherId)
    .eq('classroom.school_id', schoolId)
    .maybeSingle();

  const classroom = data?.classroom;
  return Array.isArray(classroom) ? (classroom[0] ?? null) : (classroom ?? null);
}

function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    DATE_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

function validPeriod(value: unknown): value is AttendancePeriod {
  return typeof value === 'string' && PERIODS.includes(value as AttendancePeriod);
}

function validStatus(value: unknown): value is AttendanceStatus {
  return typeof value === 'string' && STATUSES.includes(value as AttendanceStatus);
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classroomId = searchParams.get('classroomId') ?? '';
  const attendanceDate = searchParams.get('date');
  const period = searchParams.get('period');

  if (!classroomId || !validDate(attendanceDate) || !validPeriod(period)) {
    return NextResponse.json(
      { message: 'ข้อมูลวันที่ ห้องเรียน หรือช่วงเวลาไม่ถูกต้อง' },
      { status: 400 }
    );
  }

  const classroom = await getOwnedClassroom(classroomId, caller.sub, caller.schoolId);
  if (!classroom) {
    return NextResponse.json({ message: 'คุณไม่ใช่ครูประจำชั้นของห้องเรียนนี้' }, { status: 403 });
  }

  const [{ data: enrollments, error: enrollmentError }, { data: records, error: recordError }] =
    await Promise.all([
      supabaseAdmin
        .from('enrollments')
        .select(
          `student_number,
           student:app_users!enrollments_student_id_fkey!inner(
             id, username, first_name, last_name, avatar_url, student_code,
             school_id, role, is_active, student_status
           )`
        )
        .eq('classroom_id', classroomId)
        .eq('student.school_id', caller.schoolId)
        .eq('student.role', 'student')
        .order('student_number', { ascending: true, nullsFirst: false }),
      supabaseAdmin
        .from('homeroom_assembly_attendance')
        .select('id, student_id, status, note, recorded_by, updated_at')
        .eq('classroom_id', classroomId)
        .eq('attendance_date', attendanceDate)
        .eq('period', period),
    ]);

  if (enrollmentError || recordError) {
    return NextResponse.json(
      { message: enrollmentError?.message ?? recordError?.message },
      { status: 500 }
    );
  }

  const recordByStudent = new Map((records ?? []).map((record) => [record.student_id, record]));
  const rows = (enrollments ?? []).map((enrollment) => {
    const student = Array.isArray(enrollment.student) ? enrollment.student[0] : enrollment.student;
    const attendance = student ? recordByStudent.get(student.id) : null;

    return {
      student,
      studentNumber: enrollment.student_number,
      attendance: attendance ?? {
        id: null,
        status: 'present',
        note: null,
        recorded_by: null,
        updated_at: null,
      },
    };
  });

  return NextResponse.json({
    classroom: { id: classroom.id, name: classroom.name },
    attendanceDate,
    period,
    rows,
  });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const classroomId = typeof body?.classroomId === 'string' ? body.classroomId : '';
  const attendanceDate = body?.date;
  const period = body?.period;
  const records: unknown[] = Array.isArray(body?.records) ? body.records : [];

  if (
    !classroomId ||
    !validDate(attendanceDate) ||
    !validPeriod(period) ||
    !records.length ||
    records.length > 200
  ) {
    return NextResponse.json({ message: 'ข้อมูลเช็คชื่อไม่ถูกต้อง' }, { status: 400 });
  }

  const normalizedRecords: NormalizedRecord[] = records.map((record) => {
    const value =
      typeof record === 'object' && record !== null ? (record as Record<string, unknown>) : {};

    return {
      studentId: typeof value.studentId === 'string' ? value.studentId : '',
      status: validStatus(value.status) ? value.status : null,
      note: typeof value.note === 'string' ? value.note.trim() : '',
    };
  });
  const studentIds = normalizedRecords.map((record) => record.studentId);

  if (
    new Set(studentIds).size !== studentIds.length ||
    normalizedRecords.some(
      (record) => !record.studentId || !record.status || record.note.length > 500
    )
  ) {
    return NextResponse.json({ message: 'สถานะหรือหมายเหตุไม่ถูกต้อง' }, { status: 400 });
  }

  const classroom = await getOwnedClassroom(classroomId, caller.sub, caller.schoolId);
  if (!classroom) {
    return NextResponse.json({ message: 'คุณไม่ใช่ครูประจำชั้นของห้องเรียนนี้' }, { status: 403 });
  }

  const { data: enrolled } = await supabaseAdmin
    .from('enrollments')
    .select('student:app_users!enrollments_student_id_fkey!inner(id, school_id, role)')
    .eq('classroom_id', classroomId)
    .in('student_id', studentIds)
    .eq('student.school_id', caller.schoolId)
    .eq('student.role', 'student');

  const enrolledIds = new Set(
    (enrolled ?? []).flatMap((row) => {
      const student = Array.isArray(row.student) ? row.student[0] : row.student;
      return student ? [student.id] : [];
    })
  );
  if (studentIds.some((studentId) => !enrolledIds.has(studentId))) {
    return NextResponse.json({ message: 'มีนักเรียนที่ไม่ได้อยู่ในห้องนี้' }, { status: 404 });
  }

  const validRecords = normalizedRecords as Array<NormalizedRecord & { status: AttendanceStatus }>;
  const { data, error } = await supabaseAdmin
    .from('homeroom_assembly_attendance')
    .upsert(
      validRecords.map((record) => ({
        classroom_id: classroomId,
        student_id: record.studentId,
        attendance_date: attendanceDate,
        period,
        status: record.status,
        note: record.note || null,
        recorded_by: caller.sub,
      })),
      { onConflict: 'classroom_id,student_id,attendance_date,period' }
    )
    .select('id, student_id, status, note, recorded_by, updated_at');

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  after(async () => {
    const deliveryIds = await queueAttendanceNotifications({
      schoolId: caller.schoolId!,
      sourceType: 'homeroom_attendance',
      attendanceDate,
      contextLabel: period === 'morning' ? 'เข้าแถวตอนเช้า' : 'เข้าแถวตอนเย็น',
      records: (data ?? []).map((savedRecord) => {
        const input = validRecords.find((record) => record.studentId === savedRecord.student_id);
        return {
          sourceRecordId: savedRecord.id,
          studentId: savedRecord.student_id,
          status: savedRecord.status,
          note: input?.note || null,
        };
      }),
    });
    if (deliveryIds.length) {
      await processPendingLineNotifications(caller.schoolId!);
    }
  });

  return NextResponse.json({ records: data });
}
