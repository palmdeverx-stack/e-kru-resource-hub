'use client';

import type { GradeReviewStatus } from '../grade-review-actions';

import * as XLSX from 'xlsx';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDateTime } from 'src/utils/format-time';

import { RemixIcon } from 'src/components/remix-icon';

import { getScoreReport } from 'src/sections/teacher-assignment/score-report-actions';

import { useAuthContext } from 'src/auth/hooks';

import { StudentAssessmentDialog } from '../components/student-assessment-dialog';
import { updateGradeReview, getGradeReviewSubmission } from '../grade-review-actions';

// ----------------------------------------------------------------------

const STATUS: Record<
  GradeReviewStatus,
  { label: string; color: 'default' | 'warning' | 'error' | 'info' | 'success' }
> = {
  draft: { label: 'ยังไม่ส่ง', color: 'default' },
  submitted: { label: 'รอตรวจ', color: 'warning' },
  revision: { label: 'ส่งกลับแก้ไข', color: 'error' },
  reviewed: { label: 'ตรวจสอบแล้ว', color: 'info' },
  approved: { label: 'อนุมัติแล้ว', color: 'success' },
  locked: { label: 'ปิดผลการเรียน', color: 'success' },
};

type ExternalScore = {
  studentCode: string;
  nationalId: string;
  score: number | null;
};

function cell(row: Record<string, unknown>, names: string[]) {
  const key = Object.keys(row).find((item) =>
    names.includes(item.trim().toLocaleLowerCase('th'))
  );
  return key ? row[key] : undefined;
}

function fullName(person: { first_name: string | null; last_name: string | null } | null) {
  return `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim() || '-';
}

export function GradeReviewDetailView({
  teacherAssignmentId,
  backPath = paths.admin.gradeReviews,
}: {
  teacherAssignmentId: string;
  backPath?: string;
}) {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [externalScores, setExternalScores] = useState<ExternalScore[]>([]);
  const [importError, setImportError] = useState('');
  const [assessmentStudentId, setAssessmentStudentId] = useState<string | null>(null);

  const reportQuery = useQuery({
    queryKey: ['score-report', teacherAssignmentId],
    queryFn: () => getScoreReport(teacherAssignmentId),
  });
  const submissionQuery = useQuery({
    queryKey: ['grade-review', teacherAssignmentId],
    queryFn: () => getGradeReviewSubmission(teacherAssignmentId),
  });
  const mutation = useMutation({
    mutationFn: (action: 'revision' | 'review' | 'approve' | 'lock') =>
      updateGradeReview(teacherAssignmentId, action, note),
    onSuccess: async () => {
      setNote('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['grade-review', teacherAssignmentId] }),
        queryClient.invalidateQueries({ queryKey: ['grade-reviews'] }),
      ]);
    },
  });

  const report = reportQuery.data;
  const submission = submissionQuery.data;
  const status = submission?.status ?? 'draft';
  const canReview =
    user?.role === 'school_admin' || (user?.manage_permissions ?? []).includes('grades.review');
  const canApprove =
    user?.role === 'school_admin' || (user?.manage_permissions ?? []).includes('grades.approve');
  const assessmentStudent = report?.students.find(
    (student) => student.id === assessmentStudentId
  );
  const rows = useMemo(() => {
    if (!report) return [];
    const totalFullScore = report.assignments.reduce((total, item) => total + item.fullScore, 0);
    return report.students.map((student) => {
      const total = report.assignments.reduce(
        (sum, assignment) => sum + (student.scores[assignment.id]?.score ?? 0),
        0
      );
      const normalized = totalFullScore ? (total / totalFullScore) * 100 : 0;
      const external = externalScores.find(
        (item) =>
          (!!student.studentCode && item.studentCode === student.studentCode) ||
          (!!student.nationalId && item.nationalId === student.nationalId)
      );
      const difference =
        external?.score === null || external?.score === undefined
          ? null
          : normalized - external.score;
      return { student, total, normalized, external, difference };
    });
  }, [externalScores, report]);

  const comparisonSummary = useMemo(
    () => ({
      matched: rows.filter((row) => row.external && Math.abs(row.difference ?? 0) < 0.01).length,
      different: rows.filter((row) => row.external && Math.abs(row.difference ?? 0) >= 0.01).length,
      missing: rows.filter((row) => !row.external).length,
    }),
    [rows]
  );

  const importFile = async (file: File) => {
    setImportError('');
    try {
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const parsed = raw
        .map((item) => {
          const scoreValue = cell(item, ['คะแนน', 'score', 'คะแนนรวม']);
          const numericScore = Number(scoreValue);
          return {
            studentCode: String(
              cell(item, ['รหัสนักเรียน', 'student_code', 'student code']) ?? ''
            ).trim(),
            nationalId: String(
              cell(item, ['เลขประจำตัวประชาชน', 'national_id', 'citizen id']) ?? ''
            ).trim(),
            score:
              scoreValue === '' || scoreValue === undefined || Number.isNaN(numericScore)
                ? null
                : numericScore,
          };
        })
        .filter((item) => item.studentCode || item.nationalId);
      if (!parsed.length) {
        throw new Error('ไม่พบคอลัมน์รหัสนักเรียนหรือเลขประจำตัวประชาชน');
      }
      setExternalScores(parsed);
    } catch (error) {
      setExternalScores([]);
      setImportError(error instanceof Error ? error.message : 'อ่านไฟล์ไม่สำเร็จ');
    }
  };

  if (reportQuery.isLoading || submissionQuery.isLoading) {
    return (
      <Box sx={{ py: 12, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!report || reportQuery.isError || submissionQuery.isError) {
    return (
      <Container maxWidth="md">
        <Alert severity="error">ไม่สามารถโหลดข้อมูลผลการเรียนได้</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ pb: 6 }}>
      <Button
        component={RouterLink}
        href={backPath}
        color="inherit"
        startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        sx={{ mb: 2 }}
      >
        กลับหน้าตรวจสอบผลการเรียน
      </Button>

      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            {report.subject.name}
          </Typography>
          <Typography sx={{ mt: 0.75, color: 'text.secondary' }}>
            {report.subject.code || 'ไม่มีรหัสวิชา'} · ห้อง {report.classroom.name} · ปีการศึกษา{' '}
            {report.classroom.academicYear}/{report.semesterName}
          </Typography>
        </Box>
        <Chip variant="soft" color={STATUS[status].color} label={STATUS[status].label} />
      </Box>

      {(mutation.error || importError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {mutation.error?.message || importError}
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
        <Box
          sx={{
            p: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="h6">คะแนนในระบบ</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              คะแนนรวมปรับเป็นฐาน 100 เพื่อใช้เปรียบเทียบข้อมูลภายนอก
            </Typography>
          </Box>
          <Chip label={`${report.students.length} คน · ${report.assignments.length} รายการคะแนน`} />
        </Box>
        <TableContainer>
          <Table sx={{ minWidth: 850 }}>
            <TableHead>
              <TableRow>
                <TableCell>รหัสนักเรียน</TableCell>
                <TableCell>ชื่อ-นามสกุล</TableCell>
                <TableCell align="right">คะแนนในระบบ</TableCell>
                <TableCell align="right">คะแนน สพฐ.</TableCell>
                <TableCell align="right">ผลต่าง</TableCell>
                <TableCell>ผลตรวจ</TableCell>
                <TableCell align="center">ผลประเมิน</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(({ student, total, normalized, external, difference }) => (
                <TableRow key={student.id}>
                  <TableCell>{student.studentCode || student.studentNumber || '-'}</TableCell>
                  <TableCell>
                    {`${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() ||
                      student.username}
                  </TableCell>
                  <TableCell align="right">
                    {total.toFixed(2)} ({normalized.toFixed(2)})
                  </TableCell>
                  <TableCell align="right">{external?.score?.toFixed(2) ?? '-'}</TableCell>
                  <TableCell align="right">
                    {difference === null ? '-' : difference.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="soft"
                      color={
                        !external
                          ? 'default'
                          : Math.abs(difference ?? 0) < 0.01
                            ? 'success'
                            : 'error'
                      }
                      label={
                        !external
                          ? 'ไม่พบข้อมูล'
                          : Math.abs(difference ?? 0) < 0.01
                            ? 'ตรงกัน'
                            : 'ไม่ตรงกัน'
                      }
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setAssessmentStudentId(student.id)}
                    >
                      {student.specialResult ||
                        (student.desirableAttributesLevel !== null ||
                        student.readingThinkingWritingLevel !== null ||
                        student.activityResult
                          ? 'ดู / แก้ไข'
                          : 'ระบุผล')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Card variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Box
          sx={{
            gap: 2,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="h6">เทียบข้อมูล สพฐ.</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              รองรับ Excel/CSV โดยมีคอลัมน์ รหัสนักเรียนหรือเลขประจำตัวประชาชน และคะแนน
            </Typography>
          </Box>
          <Button
            component="label"
            variant="outlined"
            startIcon={<RemixIcon icon="solar:upload-bold" />}
          >
            นำเข้าไฟล์ สพฐ.
            <Box
              component="input"
              type="file"
              hidden
              accept=".xlsx,.xls,.csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
                event.target.value = '';
              }}
            />
          </Button>
        </Box>
        {!!externalScores.length && (
          <Box sx={{ mt: 2, gap: 1, display: 'flex', flexWrap: 'wrap' }}>
            <Chip color="success" label={`ตรงกัน ${comparisonSummary.matched}`} />
            <Chip color="error" label={`ไม่ตรงกัน ${comparisonSummary.different}`} />
            <Chip label={`ไม่พบข้อมูล ${comparisonSummary.missing}`} />
          </Box>
        )}
      </Card>

      <Card variant="outlined">
        <Box sx={{ p: 2.5 }}>
          <Typography variant="h6">การตรวจและรับรอง</Typography>
          <TextField
            fullWidth
            multiline
            minRows={2}
            disabled={!canReview}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            label="หมายเหตุถึงครูผู้สอน"
            sx={{ mt: 2 }}
          />
          <Box sx={{ mt: 2, gap: 1, display: 'flex', flexWrap: 'wrap' }}>
            {['approved', 'locked'].includes(status) && (
              <Button
                component={RouterLink}
                href={
                  backPath.startsWith('/teacher')
                    ? paths.teacher.gradeResultDetail(teacherAssignmentId)
                    : paths.admin.gradeResultDetail(teacherAssignmentId)
                }
                color="success"
                variant="outlined"
                disabled={!canReview}
                title={
                  canReview
                    ? 'ไปหน้าส่งใบแจ้งผลการเรียนรวมทุกวิชา'
                    : 'ต้องได้รับสิทธิ์จัดการผลการเรียนจึงจะส่งได้'
                }
                startIcon={<RemixIcon icon="ri:line-fill" />}
              >
                ส่งทุกวิชาเป็น PDF ทาง LINE
              </Button>
            )}
            {status === 'submitted' && canReview && (
              <>
                <Button
                  color="error"
                  variant="outlined"
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate('revision')}
                >
                  ส่งกลับแก้ไข
                </Button>
                <Button
                  variant="contained"
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate('review')}
                >
                  ตรวจสอบแล้ว
                </Button>
              </>
            )}
            {status === 'reviewed' && canApprove && (
              <Button
                color="success"
                variant="contained"
                loading={mutation.isPending}
                onClick={() => mutation.mutate('approve')}
              >
                อนุมัติผลการเรียน
              </Button>
            )}
            {status === 'approved' && canReview && (
              <Button
                color="success"
                variant="contained"
                loading={mutation.isPending}
                onClick={() => mutation.mutate('lock')}
              >
                ปิดผลการเรียน
              </Button>
            )}
            {((status === 'submitted' && !canReview) ||
              (status === 'reviewed' && !canApprove) ||
              (status === 'approved' && !canReview) ||
              !['submitted', 'reviewed', 'approved'].includes(status)) && (
              <Alert severity="info" sx={{ width: 1 }}>
                {(status === 'reviewed' && !canApprove) ||
                (status === 'submitted' && !canReview) ||
                (status === 'approved' && !canReview)
                  ? status === 'reviewed'
                    ? 'รอผู้บริหารอนุมัติผลการเรียน'
                    : 'คุณมีสิทธิ์ดูข้อมูล แต่ไม่ได้รับสิทธิ์ดำเนินการในขั้นตอนนี้'
                  : status === 'draft'
                    ? 'รอครูผู้สอนส่งผลการเรียน'
                    : STATUS[status].label}
              </Alert>
            )}
          </Box>
        </Box>

        {!!submission?.events?.length && (
          <>
            <Divider />
            <Box sx={{ p: 2.5 }}>
              <Typography variant="subtitle1">ประวัติการดำเนินการ</Typography>
              {[...submission.events]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map((event) => (
                  <Box
                    key={event.id}
                    sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between' }}
                  >
                    <Box>
                      <Typography variant="subtitle2">
                        {STATUS[event.status].label} · {fullName(event.acted_by)}
                      </Typography>
                      {event.note && <Typography variant="body2">{event.note}</Typography>}
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {fDateTime(event.created_at, 'DD/MM/YYYY HH:mm')}
                    </Typography>
                  </Box>
                ))}
            </Box>
          </>
        )}
      </Card>

      {assessmentStudent && (
        <StudentAssessmentDialog
          open
          teacherAssignmentId={teacherAssignmentId}
          student={assessmentStudent}
          canEditSpecial={canReview}
          canManageAssessment={canReview}
          onClose={() => setAssessmentStudentId(null)}
        />
      )}
    </Container>
  );
}
