'use client';

import type { RemixIconName } from 'src/components/remix-icon/icon-map';
import type { AttendanceStatus, StudentAttendanceRecord } from '../attendance-actions';

import { useMemo, useState } from 'react';
import { varAlpha } from 'minimal-shared/utils';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import TablePagination from '@mui/material/TablePagination';

import { RemixIcon } from 'src/components/remix-icon';

import { getMyAttendance } from '../attendance-actions';

// ----------------------------------------------------------------------

type AttendanceFilter = AttendanceStatus | 'all';

const STATUS_CONFIG: Record<
  AttendanceStatus,
  {
    label: string;
    color: 'success' | 'warning' | 'error' | 'info';
    icon: RemixIconName;
  }
> = {
  present: {
    label: 'มาเรียน',
    color: 'success',
    icon: 'solar:check-circle-bold',
  },
  absent: {
    label: 'ขาดเรียน',
    color: 'error',
    icon: 'solar:close-circle-bold',
  },
  leave: {
    label: 'ลา',
    color: 'info',
    icon: 'solar:medical-kit-bold',
  },
  late: {
    label: 'มาสาย',
    color: 'warning',
    icon: 'solar:clock-circle-bold',
  },
};

const FILTERS: Array<{ value: AttendanceFilter; label: string }> = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'present', label: 'มาเรียน' },
  { value: 'late', label: 'มาสาย' },
  { value: 'leave', label: 'ลา' },
  { value: 'absent', label: 'ขาดเรียน' },
];

export function StudentAttendanceView() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AttendanceFilter>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const {
    data: records,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['student-attendance'],
    queryFn: getMyAttendance,
  });

  const summary = useMemo(
    () =>
      (records ?? []).reduce(
        (acc, record) => ({ ...acc, [record.status]: acc[record.status] + 1 }),
        { present: 0, absent: 0, leave: 0, late: 0 } as Record<AttendanceStatus, number>
      ),
    [records]
  );

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    return (records ?? []).filter((record) => {
      if (filter !== 'all' && record.status !== filter) return false;
      if (!keyword) return true;
      return [
        record.teacher_assignment?.subjects?.code,
        record.teacher_assignment?.subjects?.name,
        record.teacher_assignment?.classrooms?.name,
        record.note,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword);
    });
  }, [filter, records, search]);

  if (isLoading) return <AttendanceSkeleton />;

  if (isError || !records) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 7 } }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          ไม่สามารถโหลดข้อมูลการเข้าเรียนได้ กรุณาลองใหม่อีกครั้ง
        </Alert>
      </Container>
    );
  }

  const attended = summary.present + summary.late;
  const attendanceRate = records.length ? (attended / records.length) * 100 : 0;
  const visibleRecords = filteredRecords.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Container maxWidth="lg" sx={{ pt: { xs: 2, md: 3 }, pb: { xs: 4, md: 6 } }}>
      <Card
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          mb: { xs: 2, md: 3 },
          color: 'common.white',
          overflow: 'hidden',
          position: 'relative',
          borderRadius: { xs: 2.5, md: 4 },
          background: (theme) =>
            `linear-gradient(135deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.main} 62%, ${theme.vars.palette.primary.light} 100%)`,
          boxShadow: (theme) => theme.customShadows.primary,
          '&::after': {
            content: '""',
            top: -80,
            right: -50,
            width: 220,
            height: 220,
            borderRadius: '50%',
            position: 'absolute',
            bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.08),
          },
        }}
      >
        <Stack
          spacing={2.5}
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          sx={{ position: 'relative', zIndex: 1 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <RemixIcon icon="solar:calendar-date-bold" width={24} />
              <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: 1 }}>
                การเข้าเรียนของฉัน
              </Typography>
            </Stack>
            <Typography component="h1" variant="h3" sx={{ mt: 0.5, fontSize: { xs: 28, sm: 36 } }}>
              ประวัติการเข้าเรียน
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.82 }}>
              ตรวจสอบการมาเรียน ขาด ลา และมาสายของแต่ละรายวิชา
            </Typography>
          </Box>

          <Box
            sx={(theme) => ({
              p: 2,
              width: { xs: 1, sm: 230 },
              flexShrink: 0,
              borderRadius: 2.5,
              bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.12),
              border: `1px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.2)}`,
            })}
          >
            <Stack direction="row" alignItems="flex-end" justifyContent="space-between">
              <Typography variant="body2" sx={{ opacity: 0.82 }}>
                อัตราเข้าเรียน
              </Typography>
              <Typography variant="h4">{Math.round(attendanceRate)}%</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={attendanceRate}
              color="inherit"
              sx={{ mt: 1.25, height: 7, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.2)' }}
            />
            <Typography variant="caption" sx={{ mt: 0.75, display: 'block', opacity: 0.76 }}>
              เข้าเรียน {attended} จาก {records.length} ครั้ง
            </Typography>
          </Box>
        </Stack>
      </Card>

      <Box
        sx={{
          mb: { xs: 2, md: 3 },
          gap: { xs: 1, sm: 1.5 },
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, 1fr)' },
        }}
      >
        {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((status) => (
          <AttendanceSummaryCard key={status} status={status} value={summary[status]} />
        ))}
      </Box>

      <Card variant="outlined" sx={{ overflow: 'hidden', borderRadius: 3 }}>
        <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack
            spacing={2}
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ md: 'center' }}
            justifyContent="space-between"
          >
            <Box>
              <Typography component="h2" variant="h6">
                รายการเช็คชื่อ
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                เรียงจากวันที่ล่าสุด · {filteredRecords.length} รายการ
              </Typography>
            </Box>
            <TextField
              size="small"
              value={search}
              placeholder="ค้นหาวิชา ห้อง หรือหมายเหตุ"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <RemixIcon icon="eva:search-fill" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ width: { xs: 1, md: 320 } }}
            />
          </Stack>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
            {FILTERS.map((option) => (
              <Chip
                clickable
                key={option.value}
                label={
                  option.value === 'all'
                    ? `${option.label} (${records.length})`
                    : `${option.label} (${summary[option.value]})`
                }
                color={filter === option.value ? 'primary' : 'default'}
                variant={filter === option.value ? 'filled' : 'outlined'}
                onClick={() => {
                  setFilter(option.value);
                  setPage(0);
                }}
              />
            ))}
          </Stack>
        </Box>

        {visibleRecords.length ? (
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            {visibleRecords.map((record) => (
              <AttendanceRecord key={record.id} record={record} />
            ))}
          </Box>
        ) : (
          <Box
            sx={{
              py: 7,
              px: 2,
              textAlign: 'center',
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <RemixIcon icon="solar:calendar-date-bold" width={42} sx={{ color: 'text.disabled' }} />
            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              {records.length ? 'ไม่พบรายการตามตัวกรอง' : 'ยังไม่มีข้อมูลการเช็คชื่อ'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {records.length ? 'ลองเปลี่ยนคำค้นหาหรือสถานะ' : 'ข้อมูลจะแสดงหลังจากครูเช็คชื่อ'}
            </Typography>
          </Box>
        )}

        {!!filteredRecords.length && (
          <TablePagination
            component="div"
            count={filteredRecords.length}
            page={page}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage="แสดงต่อหน้า"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
            onPageChange={(_event, value) => setPage(value)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setPage(0);
            }}
            sx={{ borderTop: '1px solid', borderColor: 'divider' }}
          />
        )}
      </Card>
    </Container>
  );
}

// ----------------------------------------------------------------------

function AttendanceSummaryCard({ status, value }: { status: AttendanceStatus; value: number }) {
  const config = STATUS_CONFIG[status];
  return (
    <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2.5 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box
          sx={{
            width: { xs: 38, sm: 44 },
            height: { xs: 38, sm: 44 },
            flexShrink: 0,
            display: 'grid',
            borderRadius: 1.5,
            placeItems: 'center',
            color: `${config.color}.main`,
            bgcolor: `${config.color}.lighter`,
          }}
        >
          <RemixIcon icon={config.icon} width={22} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
            {value}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {config.label}
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
}

function AttendanceRecord({ record }: { record: StudentAttendanceRecord }) {
  const config = STATUS_CONFIG[record.status];
  const subject = record.teacher_assignment?.subjects;
  const classroom = record.teacher_assignment?.classrooms;
  const date = formatAttendanceDate(record.session_date);

  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2.25 },
        gap: { xs: 1.25, sm: 2 },
        display: 'grid',
        alignItems: 'center',
        gridTemplateColumns: { xs: '52px minmax(0, 1fr)', sm: '60px minmax(0, 1fr) auto' },
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': { borderBottom: 0 },
        '&:hover': { bgcolor: 'background.neutral' },
      }}
    >
      <Box
        aria-label={date.full}
        sx={{
          py: 0.75,
          textAlign: 'center',
          borderRadius: 1.5,
          color: `${config.color}.darker`,
          bgcolor: `${config.color}.lighter`,
        }}
      >
        <Typography variant="h6" sx={{ lineHeight: 1 }}>
          {date.day}
        </Typography>
        <Typography variant="caption" sx={{ color: 'inherit' }}>
          {date.month}
        </Typography>
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
          {subject?.name ?? 'ไม่ระบุวิชา'}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          {subject?.code && `${subject.code} · `}
          {classroom?.name ? `ห้อง ${classroom.name}` : 'ไม่ระบุห้อง'} · {date.year}
        </Typography>
        {record.note && (
          <Typography
            variant="caption"
            sx={{ mt: 0.5, display: 'block', color: 'text.secondary', overflowWrap: 'anywhere' }}
          >
            หมายเหตุ: {record.note}
          </Typography>
        )}
      </Box>

      <Chip
        size="small"
        icon={<RemixIcon icon={config.icon} />}
        label={config.label}
        color={config.color}
        variant="outlined"
        sx={{
          fontWeight: 700,
          justifySelf: { xs: 'start', sm: 'end' },
          gridColumn: { xs: '2', sm: 'auto' },
        }}
      />
    </Box>
  );
}

function formatAttendanceDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return {
    day: new Intl.DateTimeFormat('th-TH', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('th-TH', { month: 'short' }).format(date),
    year: new Intl.DateTimeFormat('th-TH', { year: 'numeric' }).format(date),
    full: new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' }).format(date),
  };
}

function AttendanceSkeleton() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <Skeleton variant="rounded" height={210} sx={{ borderRadius: 3 }} />
      <Box
        sx={{
          mt: 2,
          mb: 3,
          gap: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        }}
      >
        {[1, 2, 3, 4].map((key) => (
          <Skeleton key={key} variant="rounded" height={84} sx={{ borderRadius: 2 }} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={440} sx={{ borderRadius: 3 }} />
    </Container>
  );
}
