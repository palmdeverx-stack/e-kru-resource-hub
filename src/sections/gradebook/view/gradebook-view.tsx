'use client';

import type { GradebookRow, SubmissionStatus } from '../gradebook-actions';

import { useMemo, useState } from 'react';
import { varAlpha } from 'minimal-shared/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { saveScore, getGradebook } from '../gradebook-actions';

// ----------------------------------------------------------------------

const STATUS_CONFIG: Record<
  SubmissionStatus,
  { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default' }
> = {
  submitted: { label: 'ส่งแล้ว', color: 'success' },
  late: { label: 'ส่งช้า', color: 'warning' },
  not_submitted: { label: 'ยังไม่ส่ง', color: 'error' },
  absent: { label: 'ขาดสอบ', color: 'error' },
  sick_leave: { label: 'ลาป่วย', color: 'info' },
  pending_review: { label: 'รอตรวจ', color: 'default' },
};

const STATUS_ORDER: SubmissionStatus[] = [
  'submitted',
  'late',
  'pending_review',
  'not_submitted',
  'absent',
  'sick_leave',
];

type Props = { assignmentId: string };

export function GradebookView({ assignmentId }: Props) {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | SubmissionStatus>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['gradebook', assignmentId],
    queryFn: () => getGradebook(assignmentId),
  });

  const summary = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0])) as Record<
      SubmissionStatus,
      number
    >;
    let graded = 0;
    let percentageTotal = 0;

    data?.rows.forEach((row) => {
      counts[row.score.status] += 1;
      if (row.score.score !== null) {
        graded += 1;
        percentageTotal += data.assignment.full_score
          ? (row.score.score / data.assignment.full_score) * 100
          : 0;
      }
    });

    return {
      counts,
      graded,
      pending: (data?.rows.length ?? 0) - graded,
      average: graded ? percentageTotal / graded : 0,
    };
  }, [data]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    return (data?.rows ?? []).filter((row) => {
      if (filter !== 'all' && row.score.status !== filter) return false;
      if (!keyword) return true;
      return [
        row.studentNumber,
        row.student.username,
        row.student.first_name,
        row.student.last_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword);
    });
  }, [data, filter, search]);

  const assignmentDetailPath = data
    ? user?.role === 'teacher'
      ? paths.teacher.assignmentDetail(data.assignment.teacher_assignment_id)
      : paths.admin.teacherAssignment.detail(data.assignment.teacher_assignment_id)
    : user?.role === 'teacher'
      ? paths.teacher.assignments
      : paths.admin.teacherAssignment.root;

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Button
        component={RouterLink}
        href={assignmentDetailPath}
        color="inherit"
        startIcon={<RemixIcon icon="solar:reply-bold" />}
        sx={{ mb: 2 }}
      >
        กลับหน้ารายวิชา
      </Button>

      <Card
        sx={{
          mb: 3,
          p: { xs: 2.5, md: 4 },
          color: 'common.white',
          overflow: 'hidden',
          position: 'relative',
          background: (theme) =>
            `linear-gradient(135deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.main} 68%, ${theme.vars.palette.primary.light} 100%)`,
          '&::after': {
            right: -70,
            bottom: -150,
            width: 240,
            height: 240,
            content: '""',
            borderRadius: '50%',
            position: 'absolute',
            bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.1),
          },
        }}
      >
        <Box
          sx={{
            zIndex: 1,
            gap: 3,
            display: 'flex',
            position: 'relative',
            alignItems: { xs: 'flex-start', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ opacity: 0.76, letterSpacing: 1 }}>
              สมุดคะแนน
            </Typography>
            <Typography component="h1" variant="h3" sx={{ overflowWrap: 'anywhere' }}>
              {isLoading ? <Skeleton width={280} /> : (data?.assignment.title ?? 'กรอกคะแนน')}
            </Typography>
            <Box sx={{ gap: 1, mt: 1.5, display: 'flex', flexWrap: 'wrap' }}>
              <HeroChip
                label={`${data?.assignment.subject_code ? `${data.assignment.subject_code} · ` : ''}${data?.assignment.subject_name ?? 'รายวิชา'}`}
              />
              <HeroChip label={`ห้อง ${data?.assignment.classroom_name ?? '-'}`} />
              <HeroChip label={data?.assignment.semester_name ?? 'ไม่ระบุภาคเรียน'} />
            </Box>
          </Box>

          <Box
            sx={(theme) => ({
              px: 2.5,
              py: 1.75,
              minWidth: 150,
              textAlign: 'center',
              borderRadius: 2,
              bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.14),
              border: `1px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.2)}`,
            })}
          >
            <Typography variant="h3">{data?.assignment.full_score ?? '–'}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.76 }}>
              คะแนนเต็ม
            </Typography>
          </Box>
        </Box>
      </Card>

      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
          sx={{ mb: 3 }}
        >
          ไม่สามารถโหลดข้อมูลคะแนนได้
        </Alert>
      )}

      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        }}
      >
        <SummaryCard
          icon="solar:users-group-rounded-bold"
          label="นักเรียนทั้งหมด"
          value={data?.rows.length ?? 0}
          color="primary"
          loading={isLoading}
        />
        <SummaryCard
          icon="solar:check-circle-bold"
          label="ตรวจแล้ว"
          value={summary.graded}
          color="success"
          loading={isLoading}
        />
        <SummaryCard
          icon="solar:clock-circle-bold"
          label="รอตรวจ"
          value={summary.pending}
          color="warning"
          loading={isLoading}
        />
        <SummaryCard
          icon="solar:wad-of-money-bold"
          label="คะแนนเฉลี่ย"
          value={`${Math.round(summary.average)}%`}
          color="info"
          loading={isLoading}
        />
      </Box>

      <Card variant="outlined" sx={{ mb: 2.5, overflow: 'hidden' }}>
        <Box
          sx={{
            gap: 2,
            p: 2.5,
            display: 'flex',
            alignItems: { xs: 'stretch', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography component="h2" variant="h6">
              รายชื่อนักเรียน
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              กรอกคะแนน เลือกสถานะ และเพิ่มความคิดเห็นรายคน
            </Typography>
          </Box>
          <TextField
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาชื่อ เลขที่ หรือชื่อผู้ใช้"
            aria-label="ค้นหานักเรียน"
            sx={{ width: { xs: 1, md: 320 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <RemixIcon icon="eva:search-fill" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        <Tabs
          value={filter}
          onChange={(_event, value) => setFilter(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="กรองตามสถานะการส่งงาน"
          sx={{ px: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Tab label={`ทั้งหมด (${data?.rows.length ?? 0})`} value="all" />
          {STATUS_ORDER.map((status) => (
            <Tab
              key={status}
              label={`${STATUS_CONFIG[status].label} (${summary.counts[status]})`}
              value={status}
            />
          ))}
        </Tabs>
      </Card>

      {isLoading ? (
        <Box sx={{ gap: 1.5, display: 'grid' }}>
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} variant="rounded" height={148} />
          ))}
        </Box>
      ) : filteredRows.length ? (
        <Box sx={{ gap: 1.5, display: 'grid' }}>
          {filteredRows.map((row) => (
            <GradeEntry
              key={row.student.id}
              row={row}
              assignmentId={assignmentId}
              fullScore={data!.assignment.full_score}
              onSaved={() =>
                queryClient.invalidateQueries({ queryKey: ['gradebook', assignmentId] })
              }
            />
          ))}
        </Box>
      ) : !isError ? (
        <Card variant="outlined" sx={{ py: 7, px: 3, textAlign: 'center' }}>
          <RemixIcon icon="solar:user-rounded-bold" width={48} sx={{ color: 'text.disabled' }} />
          <Typography variant="h6" sx={{ mt: 1.5 }}>
            ไม่พบนักเรียน
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ
          </Typography>
        </Card>
      ) : null}
    </Container>
  );
}

function HeroChip({ label }: { label: string }) {
  return (
    <Chip
      size="small"
      label={label}
      sx={(theme) => ({
        color: 'common.white',
        bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
      })}
    />
  );
}

type SummaryColor = 'primary' | 'success' | 'warning' | 'info';

function SummaryCard({
  icon,
  label,
  value,
  color,
  loading,
}: {
  icon:
    | 'solar:users-group-rounded-bold'
    | 'solar:check-circle-bold'
    | 'solar:clock-circle-bold'
    | 'solar:wad-of-money-bold';
  label: string;
  value: string | number;
  color: SummaryColor;
  loading: boolean;
}) {
  return (
    <Card variant="outlined" sx={{ p: { xs: 1.75, sm: 2.25 } }}>
      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
        <Avatar variant="rounded" sx={{ color: `${color}.main`, bgcolor: `${color}.lighter` }}>
          <RemixIcon icon={icon} width={22} />
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5">{loading ? <Skeleton width={36} /> : value}</Typography>
          <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
            {label}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}

type GradeEntryProps = {
  row: GradebookRow;
  assignmentId: string;
  fullScore: number;
  onSaved: () => void;
};

function GradeEntry({ row, assignmentId, fullScore, onSaved }: GradeEntryProps) {
  const [status, setStatus] = useState<SubmissionStatus>(row.score.status);
  const [score, setScore] = useState(row.score.score?.toString() ?? '');
  const [feedback, setFeedback] = useState(row.score.feedback ?? '');
  const numericScore = score === '' ? null : Number(score);
  const scoreError =
    numericScore !== null &&
    (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > fullScore);
  const dirty =
    status !== row.score.status ||
    score !== (row.score.score?.toString() ?? '') ||
    feedback !== (row.score.feedback ?? '');

  const saveMutation = useMutation({
    mutationFn: () =>
      saveScore(assignmentId, {
        studentId: row.student.id,
        score: numericScore,
        feedback: feedback.trim() || undefined,
        status,
      }),
    onSuccess: onSaved,
  });

  const studentName =
    `${row.student.first_name ?? ''} ${row.student.last_name ?? ''}`.trim() || row.student.username;

  const updateScore = (value: string) => {
    setScore(value);
    if (value !== '' && ['not_submitted', 'pending_review'].includes(status)) {
      setStatus('submitted');
    }
  };

  return (
    <Card variant="outlined" sx={{ p: { xs: 2, md: 2.25 }, borderRadius: 2.5 }}>
      <Box
        sx={{
          gap: 2,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'minmax(0, 1fr) minmax(180px, 0.8fr)',
            lg: 'minmax(220px, 1fr) 170px 170px minmax(210px, 1fr) 112px',
          },
        }}
      >
        <Box sx={{ gap: 1.25, minWidth: 0, display: 'flex', alignItems: 'center' }}>
          <Avatar
            src={row.student.avatar_url ?? undefined}
            alt={studentName}
            sx={{ width: 46, height: 46, bgcolor: 'primary.lighter', color: 'primary.darker' }}
          >
            {studentName.charAt(0)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>
              {studentName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              เลขที่ {row.studentNumber ?? '-'} · @{row.student.username}
            </Typography>
          </Box>
        </Box>

        <TextField
          select
          size="small"
          fullWidth
          label="สถานะ"
          value={status}
          onChange={(event) => setStatus(event.target.value as SubmissionStatus)}
        >
          {STATUS_ORDER.map((option) => (
            <MenuItem key={option} value={option}>
              <Label color={STATUS_CONFIG[option].color} variant="soft">
                {STATUS_CONFIG[option].label}
              </Label>
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          type="number"
          label="คะแนน"
          value={score}
          error={scoreError}
          helperText={scoreError ? `0–${fullScore} เท่านั้น` : `เต็ม ${fullScore}`}
          onChange={(event) => updateScore(event.target.value)}
          slotProps={{
            htmlInput: { min: 0, max: fullScore, step: 0.5, inputMode: 'decimal' },
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => updateScore(String(fullScore))}
                    sx={{ minWidth: 0, px: 0.75 }}
                  >
                    เต็ม
                  </Button>
                </InputAdornment>
              ),
            },
          }}
        />

        <TextField
          size="small"
          fullWidth
          label="ความคิดเห็นถึงนักเรียน"
          placeholder="ไม่บังคับ"
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
        />

        <Button
          variant={dirty ? 'contained' : 'outlined'}
          loading={saveMutation.isPending}
          disabled={!dirty || scoreError}
          startIcon={<RemixIcon icon="solar:check-circle-bold" />}
          onClick={() => saveMutation.mutate()}
          sx={{ minHeight: 40 }}
        >
          {saveMutation.isSuccess && !dirty ? 'บันทึกแล้ว' : 'บันทึก'}
        </Button>
      </Box>

      {saveMutation.error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {saveMutation.error.message}
        </Alert>
      )}
    </Card>
  );
}
