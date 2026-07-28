import 'server-only';

import path from 'node:path';
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { Font, Page, Text, View, Document, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

import { supabaseAdmin } from './supabase-admin';

// ----------------------------------------------------------------------

Font.register({
  family: 'LINE Seed Sans TH',
  fonts: [
    {
      src: path.join(process.cwd(), 'public/fonts/LINESeedSansTH-Regular.ttf'),
      fontWeight: 400,
    },
    {
      src: path.join(process.cwd(), 'public/fonts/LINESeedSansTH-Bold.ttf'),
      fontWeight: 700,
    },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

type SubjectResult = {
  code: string | null;
  name: string;
  credits: number;
  score: number;
  grade: string;
  gradePoint: number | null;
};

export type StudentGradeReport = {
  schoolName: string;
  studentName: string;
  studentCode: string | null;
  classroomName: string;
  gradeLevel: string | null;
  semesterName: string;
  academicYear: string | null;
  subjects: SubjectResult[];
  totalCredits: number;
  gradePointAverage: number | null;
  desirableAttributesLevel: number | null;
  readingThinkingWritingLevel: number | null;
  activityResult: 'pass' | 'fail' | 'pending' | null;
  issuedAt: string;
};

function gradeFromScore(score: number) {
  if (score >= 80) return { grade: '4', point: 4 };
  if (score >= 75) return { grade: '3.5', point: 3.5 };
  if (score >= 70) return { grade: '3', point: 3 };
  if (score >= 65) return { grade: '2.5', point: 2.5 };
  if (score >= 60) return { grade: '2', point: 2 };
  if (score >= 55) return { grade: '1.5', point: 1.5 };
  if (score >= 50) return { grade: '1', point: 1 };
  return { grade: '0', point: 0 };
}

export async function loadStudentGradeReport({
  schoolId,
  classroomId,
  semesterId,
  studentId,
}: {
  schoolId: string;
  classroomId: string;
  semesterId: string;
  studentId: string;
}): Promise<StudentGradeReport | null> {
  const [
    { data: school },
    { data: student },
    { data: classroom },
    { data: semester },
    { data: teacherAssignments },
    { data: assessment },
  ] = await Promise.all([
    supabaseAdmin.from('schools').select('name').eq('id', schoolId).maybeSingle(),
    supabaseAdmin
      .from('app_users')
      .select('username, name_prefix, first_name, last_name, student_code')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .eq('role', 'student')
      .maybeSingle(),
    supabaseAdmin
      .from('classrooms')
      .select('name, grade_level, school_id, academic_year:academic_years(year)')
      .eq('id', classroomId)
      .eq('school_id', schoolId)
      .maybeSingle(),
    supabaseAdmin.from('semesters').select('name').eq('id', semesterId).maybeSingle(),
    supabaseAdmin
      .from('teacher_assignments')
      .select(
        `id,
         subject:subjects(name, code, credits),
         review:grade_review_submissions!inner(status)`
      )
      .eq('classroom_id', classroomId)
      .eq('semester_id', semesterId)
      .in('review.status', ['approved', 'locked']),
    supabaseAdmin
      .from('student_term_assessments')
      .select('desirable_attributes_level, reading_thinking_writing_level, activity_result')
      .eq('semester_id', semesterId)
      .eq('student_id', studentId)
      .maybeSingle(),
  ]);

  if (!school || !student || !classroom || !semester || !teacherAssignments?.length) return null;

  const teacherAssignmentIds = teacherAssignments.map((item) => item.id);
  const { data: assignments } = await supabaseAdmin
    .from('assignments')
    .select('id, teacher_assignment_id, full_score')
    .in('teacher_assignment_id', teacherAssignmentIds);
  const assignmentIds = (assignments ?? []).map((item) => item.id);
  const [{ data: scores }, { data: specialResults }] = await Promise.all([
    assignmentIds.length
      ? supabaseAdmin
          .from('scores')
          .select('assignment_id, score')
          .eq('student_id', studentId)
          .in('assignment_id', assignmentIds)
      : Promise.resolve({ data: [] }),
    supabaseAdmin
      .from('teacher_assignment_student_results')
      .select('teacher_assignment_id, special_result')
      .eq('student_id', studentId)
      .in('teacher_assignment_id', teacherAssignmentIds),
  ]);

  const scoreByAssignment = new Map(
    (scores ?? []).map((score) => [score.assignment_id, Number(score.score ?? 0)])
  );
  const specialByTeacherAssignment = new Map(
    (specialResults ?? []).map((result) => [result.teacher_assignment_id, result.special_result])
  );
  const assignmentsByTeacherAssignment = new Map<string, typeof assignments>();
  for (const assignment of assignments ?? []) {
    const values = assignmentsByTeacherAssignment.get(assignment.teacher_assignment_id) ?? [];
    values.push(assignment);
    assignmentsByTeacherAssignment.set(assignment.teacher_assignment_id, values);
  }

  const subjects = teacherAssignments
    .map((teacherAssignment) => {
      const subject = Array.isArray(teacherAssignment.subject)
        ? teacherAssignment.subject[0]
        : teacherAssignment.subject;
      const subjectAssignments = assignmentsByTeacherAssignment.get(teacherAssignment.id) ?? [];
      const fullScore = subjectAssignments.reduce(
        (total, assignment) => total + Number(assignment.full_score ?? 0),
        0
      );
      const earned = subjectAssignments.reduce(
        (total, assignment) => total + (scoreByAssignment.get(assignment.id) ?? 0),
        0
      );
      const normalized = fullScore ? (earned / fullScore) * 100 : 0;
      const specialResult = specialByTeacherAssignment.get(teacherAssignment.id);
      const calculated = gradeFromScore(normalized);
      return {
        code: subject?.code ?? null,
        name: subject?.name ?? '-',
        credits: Number(subject?.credits ?? 0),
        score: normalized,
        grade: specialResult ?? calculated.grade,
        gradePoint: specialResult ? null : calculated.point,
      };
    })
    .sort((left, right) =>
      `${left.code ?? ''}${left.name}`.localeCompare(`${right.code ?? ''}${right.name}`, 'th', {
        numeric: true,
      })
    );

  const gradedSubjects = subjects.filter((subject) => subject.gradePoint !== null);
  const totalCredits = gradedSubjects.reduce((total, subject) => total + subject.credits, 0);
  const gradePointAverage = totalCredits
    ? gradedSubjects.reduce(
        (total, subject) => total + subject.credits * (subject.gradePoint ?? 0),
        0
      ) / totalCredits
    : gradedSubjects.length
      ? gradedSubjects.reduce((total, subject) => total + (subject.gradePoint ?? 0), 0) /
        gradedSubjects.length
      : null;
  const academicYear = classroom.academic_year as unknown as
    | { year: string }
    | Array<{ year: string }>
    | null;
  const year = Array.isArray(academicYear) ? academicYear[0]?.year : academicYear?.year;

  return {
    schoolName: school.name,
    studentName:
      `${student.name_prefix ?? ''}${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() ||
      student.username,
    studentCode: student.student_code,
    classroomName: classroom.name,
    gradeLevel: classroom.grade_level,
    semesterName: semester.name,
    academicYear: year ?? null,
    subjects,
    totalCredits,
    gradePointAverage,
    desirableAttributesLevel: assessment?.desirable_attributes_level ?? null,
    readingThinkingWritingLevel: assessment?.reading_thinking_writing_level ?? null,
    activityResult: assessment?.activity_result ?? null,
    issuedAt: new Date().toISOString(),
  };
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    color: '#111827',
    fontFamily: 'LINE Seed Sans TH',
  },
  title: { fontSize: 18, fontWeight: 700, textAlign: 'center' },
  school: { marginTop: 4, fontSize: 13, fontWeight: 700, textAlign: 'center' },
  subtitle: { marginTop: 4, textAlign: 'center', color: '#4B5563' },
  info: {
    marginTop: 22,
    padding: 12,
    border: '1 solid #CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  infoRow: { marginBottom: 4, display: 'flex', flexDirection: 'row' },
  infoLabel: { width: 95, fontWeight: 700 },
  table: { marginTop: 18, borderTop: '1 solid #334155', borderLeft: '1 solid #334155' },
  row: { display: 'flex', flexDirection: 'row' },
  header: { fontWeight: 700, backgroundColor: '#E2E8F0' },
  cell: {
    minHeight: 27,
    padding: 5,
    justifyContent: 'center',
    borderRight: '1 solid #334155',
    borderBottom: '1 solid #334155',
  },
  no: { width: 34, textAlign: 'center' },
  code: { width: 72 },
  subject: { flex: 1 },
  credits: { width: 55, textAlign: 'center' },
  score: { width: 66, textAlign: 'center' },
  grade: { width: 66, textAlign: 'center' },
  summary: {
    marginTop: 18,
    padding: 12,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    border: '1 solid #CBD5E1',
  },
  summaryValue: { marginTop: 3, fontSize: 14, fontWeight: 700 },
  assessments: { marginTop: 16 },
  footer: {
    position: 'absolute',
    right: 36,
    bottom: 24,
    left: 36,
    fontSize: 8,
    textAlign: 'center',
    color: '#64748B',
  },
});

const ASSESSMENT_LABEL: Record<number, string> = {
  0: 'ต้องปรับปรุง',
  1: 'ผ่าน',
  2: 'ดี',
  3: 'ดีเยี่ยม',
};

function GradeReportDocument({ report }: { report: StudentGradeReport }) {
  return (
    <Document title={`ใบแจ้งผลการเรียน-${report.studentCode ?? report.studentName}`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <Text style={styles.title}>ใบแจ้งผลการเรียน</Text>
        <Text style={styles.school}>{report.schoolName}</Text>
        <Text style={styles.subtitle}>
          ภาคเรียนที่ {report.semesterName} ปีการศึกษา {report.academicYear ?? '-'}
        </Text>

        <View style={styles.info}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ชื่อ–นามสกุล</Text>
            <Text>{report.studentName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>รหัสนักเรียน</Text>
            <Text>{report.studentCode ?? '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ชั้น/ห้อง</Text>
            <Text>
              {report.gradeLevel ?? '-'} {report.classroomName}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.header]}>
            <View style={[styles.cell, styles.no]}>
              <Text>ลำดับ</Text>
            </View>
            <View style={[styles.cell, styles.code]}>
              <Text>รหัสวิชา</Text>
            </View>
            <View style={[styles.cell, styles.subject]}>
              <Text>รายวิชา</Text>
            </View>
            <View style={[styles.cell, styles.credits]}>
              <Text>หน่วยกิต</Text>
            </View>
            <View style={[styles.cell, styles.score]}>
              <Text>คะแนน</Text>
            </View>
            <View style={[styles.cell, styles.grade]}>
              <Text>ผลการเรียน</Text>
            </View>
          </View>
          {report.subjects.map((subject, index) => (
            <View key={`${subject.code ?? subject.name}-${index}`} style={styles.row}>
              <View style={[styles.cell, styles.no]}>
                <Text>{index + 1}</Text>
              </View>
              <View style={[styles.cell, styles.code]}>
                <Text>{subject.code ?? '-'}</Text>
              </View>
              <View style={[styles.cell, styles.subject]}>
                <Text>{subject.name}</Text>
              </View>
              <View style={[styles.cell, styles.credits]}>
                <Text>{subject.credits.toFixed(1)}</Text>
              </View>
              <View style={[styles.cell, styles.score]}>
                <Text>{subject.score.toFixed(2)}</Text>
              </View>
              <View style={[styles.cell, styles.grade]}>
                <Text>{subject.grade}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.summary}>
          <View>
            <Text>จำนวนรายวิชา</Text>
            <Text style={styles.summaryValue}>{report.subjects.length}</Text>
          </View>
          <View>
            <Text>หน่วยกิตรวม</Text>
            <Text style={styles.summaryValue}>{report.totalCredits.toFixed(1)}</Text>
          </View>
          <View>
            <Text>เกรดเฉลี่ย</Text>
            <Text style={styles.summaryValue}>{report.gradePointAverage?.toFixed(2) ?? '-'}</Text>
          </View>
        </View>

        <View style={styles.assessments}>
          <Text>
            คุณลักษณะอันพึงประสงค์:{' '}
            {report.desirableAttributesLevel === null
              ? '-'
              : (ASSESSMENT_LABEL[report.desirableAttributesLevel] ?? '-')}
          </Text>
          <Text>
            การอ่าน คิดวิเคราะห์ และเขียน:{' '}
            {report.readingThinkingWritingLevel === null
              ? '-'
              : (ASSESSMENT_LABEL[report.readingThinkingWritingLevel] ?? '-')}
          </Text>
          <Text>
            กิจกรรมพัฒนาผู้เรียน:{' '}
            {report.activityResult === 'pass'
              ? 'ผ่าน'
              : report.activityResult === 'fail'
                ? 'ไม่ผ่าน'
                : report.activityResult === 'pending'
                  ? 'รอประเมิน'
                  : '-'}
          </Text>
        </View>

        <Text style={styles.footer}>
          เอกสารนี้เป็นใบแจ้งผลการเรียนจากระบบ ไม่ใช่ระเบียนแสดงผลการเรียน ปพ.1
        </Text>
      </Page>
    </Document>
  );
}

export async function renderStudentGradeReportPdf(report: StudentGradeReport) {
  return renderToBuffer(<GradeReportDocument report={report} />);
}

let reportImageFontsPromise: Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> | null = null;

function loadReportImageFonts() {
  if (!reportImageFontsPromise) {
    reportImageFontsPromise = Promise.all([
      readFile(path.join(process.cwd(), 'public/fonts/LINESeedSansTH-Regular.ttf')),
      readFile(path.join(process.cwd(), 'public/fonts/LINESeedSansTH-Bold.ttf')),
    ]).then(([regular, bold]) => ({
      regular: regular.buffer.slice(
        regular.byteOffset,
        regular.byteOffset + regular.byteLength
      ) as ArrayBuffer,
      bold: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength) as ArrayBuffer,
    }));
  }
  return reportImageFontsPromise;
}

const IMAGE_WIDTH = 800;
const IMAGE_ROW_HEIGHT = 34;
const IMAGE_BASE_HEIGHT = 480;

export async function renderStudentGradeReportImage(report: StudentGradeReport) {
  const fonts = await loadReportImageFonts();
  const height = IMAGE_BASE_HEIGHT + report.subjects.length * IMAGE_ROW_HEIGHT;

  const cellStyle = (extra: Record<string, unknown> = {}) => ({
    display: 'flex',
    padding: '6px 8px',
    borderRight: '1px solid #334155',
    borderBottom: '1px solid #334155',
    ...extra,
  });

  const image = new ImageResponse(
    (
      <div
        style={{
          width: IMAGE_WIDTH,
          height,
          display: 'flex',
          flexDirection: 'column',
          padding: 32,
          backgroundColor: '#FFFFFF',
          fontFamily: 'LINE Seed Sans TH',
          color: '#111827',
        }}
      >
        <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, justifyContent: 'center' }}>
          ใบแจ้งผลการเรียน
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 4,
            fontSize: 15,
            fontWeight: 700,
            justifyContent: 'center',
          }}
        >
          {report.schoolName}
        </div>
        <div style={{ display: 'flex', marginTop: 4, fontSize: 12, color: '#4B5563', justifyContent: 'center' }}>
          ภาคเรียนที่ {report.semesterName} ปีการศึกษา {report.academicYear ?? '-'}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 20,
            padding: 12,
            border: '1px solid #CBD5E1',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', marginBottom: 4 }}>
            <div style={{ display: 'flex', width: 110, fontWeight: 700 }}>ชื่อ–นามสกุล</div>
            <div style={{ display: 'flex' }}>{report.studentName}</div>
          </div>
          <div style={{ display: 'flex', marginBottom: 4 }}>
            <div style={{ display: 'flex', width: 110, fontWeight: 700 }}>รหัสนักเรียน</div>
            <div style={{ display: 'flex' }}>{report.studentCode ?? '-'}</div>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', width: 110, fontWeight: 700 }}>ชั้น/ห้อง</div>
            <div style={{ display: 'flex' }}>
              {report.gradeLevel ?? '-'} {report.classroomName}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 16,
            borderTop: '1px solid #334155',
            borderLeft: '1px solid #334155',
          }}
        >
          <div style={{ display: 'flex', backgroundColor: '#E2E8F0', fontWeight: 700, fontSize: 11 }}>
            <div style={cellStyle({ width: 40, justifyContent: 'center' })}>ลำดับ</div>
            <div style={cellStyle({ width: 70 })}>รหัสวิชา</div>
            <div style={cellStyle({ flex: 1 })}>รายวิชา</div>
            <div style={cellStyle({ width: 60, justifyContent: 'center' })}>หน่วยกิต</div>
            <div style={cellStyle({ width: 60, justifyContent: 'center' })}>คะแนน</div>
            <div style={cellStyle({ width: 70, justifyContent: 'center' })}>ผลการเรียน</div>
          </div>
          {report.subjects.map((subject, index) => (
            <div key={`${subject.code ?? subject.name}-${index}`} style={{ display: 'flex', fontSize: 11 }}>
              <div style={cellStyle({ width: 40, justifyContent: 'center' })}>{index + 1}</div>
              <div style={cellStyle({ width: 70 })}>{subject.code ?? '-'}</div>
              <div style={cellStyle({ flex: 1 })}>{subject.name}</div>
              <div style={cellStyle({ width: 60, justifyContent: 'center' })}>
                {subject.credits.toFixed(1)}
              </div>
              <div style={cellStyle({ width: 60, justifyContent: 'center' })}>
                {subject.score.toFixed(2)}
              </div>
              <div style={cellStyle({ width: 70, justifyContent: 'center' })}>{subject.grade}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 16,
            padding: 12,
            justifyContent: 'space-between',
            border: '1px solid #CBD5E1',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 11 }}>จำนวนรายวิชา</div>
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 700 }}>
              {report.subjects.length}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 11 }}>หน่วยกิตรวม</div>
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 700 }}>
              {report.totalCredits.toFixed(1)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 11 }}>เกรดเฉลี่ย</div>
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 700 }}>
              {report.gradePointAverage?.toFixed(2) ?? '-'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14, fontSize: 11 }}>
          <div style={{ display: 'flex' }}>
            คุณลักษณะอันพึงประสงค์:{' '}
            {report.desirableAttributesLevel === null
              ? '-'
              : (ASSESSMENT_LABEL[report.desirableAttributesLevel] ?? '-')}
          </div>
          <div style={{ display: 'flex', marginTop: 2 }}>
            การอ่าน คิดวิเคราะห์ และเขียน:{' '}
            {report.readingThinkingWritingLevel === null
              ? '-'
              : (ASSESSMENT_LABEL[report.readingThinkingWritingLevel] ?? '-')}
          </div>
          <div style={{ display: 'flex', marginTop: 2 }}>
            กิจกรรมพัฒนาผู้เรียน:{' '}
            {report.activityResult === 'pass'
              ? 'ผ่าน'
              : report.activityResult === 'fail'
                ? 'ไม่ผ่าน'
                : report.activityResult === 'pending'
                  ? 'รอประเมิน'
                  : '-'}
          </div>
        </div>

        <div style={{ display: 'flex', marginTop: 'auto', fontSize: 9, color: '#64748B', justifyContent: 'center' }}>
          เอกสารนี้เป็นใบแจ้งผลการเรียนจากระบบ ไม่ใช่ระเบียนแสดงผลการเรียน ปพ.1
        </div>
      </div>
    ),
    {
      width: IMAGE_WIDTH,
      height,
      fonts: [
        { name: 'LINE Seed Sans TH', data: fonts.regular, weight: 400, style: 'normal' },
        { name: 'LINE Seed Sans TH', data: fonts.bold, weight: 700, style: 'normal' },
      ],
    }
  );

  return Buffer.from(await image.arrayBuffer());
}
