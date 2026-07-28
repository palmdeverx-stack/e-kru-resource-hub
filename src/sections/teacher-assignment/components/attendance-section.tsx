'use client';

import type { AttendanceRow, AttendanceStatus } from 'src/sections/attendance/attendance-actions';

import dayjs from 'dayjs';
import dynamic from 'next/dynamic';
import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import InputAdornment from '@mui/material/InputAdornment';
import TablePagination from '@mui/material/TablePagination';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { today } from 'src/utils/format-time';

import { RemixIcon } from 'src/components/remix-icon';

import { getAttendance, saveAttendance } from 'src/sections/attendance/attendance-actions';
import { useSchoolSubscription } from 'src/sections/school-subscription/use-school-subscription';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const AttendanceQrScanDialog = dynamic(
  () => import('./attendance-qr-scan-dialog').then((module) => module.AttendanceQrScanDialog),
  { ssr: false }
);

const STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  color: 'success' | 'error' | 'info' | 'warning';
  icon:
    | 'solar:check-circle-bold'
    | 'solar:close-circle-bold'
    | 'solar:medical-kit-bold'
    | 'solar:clock-circle-bold';
}> = [
  { value: 'present', label: 'มา', color: 'success', icon: 'solar:check-circle-bold' },
  { value: 'absent', label: 'ขาด', color: 'error', icon: 'solar:close-circle-bold' },
  { value: 'leave', label: 'ลา', color: 'info', icon: 'solar:medical-kit-bold' },
  { value: 'late', label: 'สาย', color: 'warning', icon: 'solar:clock-circle-bold' },
];

type AttendanceEdit = { status: AttendanceStatus; note: string };
type Props = { teacherAssignmentId: string };

export function AttendanceSection({ teacherAssignmentId }: Props) {
  const { user } = useAuthContext();
  const subscriptionQuery = useSchoolSubscription(user?.school_id);
  const queryClient = useQueryClient();
  const [sessionDate, setSessionDate] = useState(() => today('YYYY-MM-DD'));
  const [edits, setEdits] = useState<Record<string, AttendanceEdit>>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance', teacherAssignmentId, sessionDate],
    queryFn: () => getAttendance(teacherAssignmentId, sessionDate),
  });

  useEffect(() => {
    if (!data) return;

    setEdits(
      Object.fromEntries(
        data.rows.map((row) => [
          row.student.id,
          { status: row.attendance.status, note: row.attendance.note ?? '' },
        ])
      )
    );
    setPage(0);
  }, [data]);

  const dirtyRows = useMemo(
    () =>
      (data?.rows ?? []).filter((row) => {
        const edit = edits[row.student.id];
        return (
          !!edit &&
          (row.attendance.id === null ||
            edit.status !== row.attendance.status ||
            edit.note.trim() !== (row.attendance.note ?? ''))
        );
      }),
    [data, edits]
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      saveAttendance(
        teacherAssignmentId,
        sessionDate,
        dirtyRows.map((row) => ({
          studentId: row.student.id,
          status: edits[row.student.id].status,
          note: edits[row.student.id].note.trim() || null,
        }))
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['attendance', teacherAssignmentId, sessionDate],
      });
    },
  });

  const summary = Object.values(edits).reduce(
    (acc, edit) => ({ ...acc, [edit.status]: acc[edit.status] + 1 }),
    { present: 0, absent: 0, leave: 0, late: 0 } as Record<AttendanceStatus, number>
  );

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    if (!keyword) return data?.rows ?? [];

    return (data?.rows ?? []).filter((row) =>
      [row.studentNumber, row.student.username, row.student.first_name, row.student.last_name]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword)
    );
  }, [data, search]);

  const visibleRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const updateStatus = (row: AttendanceRow, status: AttendanceStatus) => {
    setEdits((current) => ({
      ...current,
      [row.student.id]: { ...(current[row.student.id] ?? { note: '' }), status },
    }));
  };

  const markEveryonePresent = () => {
    setEdits((current) =>
      Object.fromEntries(
        (data?.rows ?? []).map((row) => [
          row.student.id,
          { ...(current[row.student.id] ?? { note: '' }), status: 'present' },
        ])
      )
    );
  };

  return (
    <Card variant="outlined" sx={{ overflow: 'hidden', borderRadius: { xs: 2, sm: 1 } }}>
      <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Box
          sx={{
            gap: { xs: 1.25, sm: 2 },
            display: 'flex',
            alignItems: { xs: 'stretch', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}>
              เช็คชื่อนักเรียน
            </Typography>
            <Typography
              variant="body2"
              sx={{ display: { xs: 'none', sm: 'block' }, color: 'text.secondary' }}
            >
              แตะสถานะเพียงครั้งเดียว ระบบจะเก็บการแก้ไขไว้จนกว่าจะกดบันทึก
            </Typography>
          </Box>
          <Box
            sx={{
              gap: 0.75,
              width: { xs: 1, md: 'auto' },
              display: { xs: 'grid', sm: 'flex' },
              flexWrap: 'wrap',
              gridTemplateColumns: { xs: '40px minmax(0, 1fr)', sm: 'none' },
            }}
          >
            {user?.role === 'teacher' && (
              <>
                {subscriptionQuery.data?.subscription.enabled_features.includes(
                  'teacher.qr_attendance'
                ) && (
                  <Button
                    variant="contained"
                    onClick={() => setScanDialogOpen(true)}
                    startIcon={<RemixIcon icon="solar:camera-add-bold" />}
                    sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                  >
                    สแกน QR เข้าเรียน
                  </Button>
                )}
                <Button
                  component={RouterLink}
                  href={paths.teacher.assignmentAttendanceHistory(teacherAssignmentId)}
                  variant="outlined"
                  startIcon={<RemixIcon icon="solar:calendar-date-bold" />}
                  aria-label="ประวัติการเข้าเรียน"
                  sx={{
                    gridColumn: { xs: 1, sm: 'auto' },
                    minWidth: { xs: 40, sm: 64 },
                    px: { xs: 1, sm: 2 },
                    '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
                  }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    ประวัติการเข้าเรียน
                  </Box>
                </Button>
              </>
            )}
            <DatePicker
              label="วันที่เรียน"
              value={dayjs(sessionDate)}
              onChange={(value) => {
                if (!value?.isValid()) return;
                setSessionDate(value.format('YYYY-MM-DD'));
                setSearch('');
                setPage(0);
              }}
              format="DD/MM/YYYY"
              disableFuture
              slotProps={{
                textField: { size: 'small', fullWidth: true },
              }}
              sx={{ minWidth: { xs: 0, sm: 190 } }}
            />
          </Box>
        </Box>

        <Box
          sx={{
            gap: { xs: 0.5, sm: 1 },
            mt: { xs: 1.5, sm: 2.5 },
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <Box
              key={option.value}
              sx={{
                gap: { xs: 0.25, sm: 1 },
                p: { xs: 0.5, sm: 1.25 },
                display: 'flex',
                borderRadius: 1.5,
                alignItems: 'center',
                flexDirection: { xs: 'column', sm: 'row' },
                color: `${option.color}.dark`,
                bgcolor: `${option.color}.lighter`,
              }}
            >
              <RemixIcon icon={option.icon} width={18} />
              <Typography
                variant="body2"
                sx={{
                  flex: { sm: 1 },
                  fontSize: { xs: '0.68rem', sm: '0.875rem' },
                  fontWeight: 600,
                }}
              >
                {option.label}
              </Typography>
              <Typography variant="h6" sx={{ fontSize: { xs: '0.9rem', sm: '1.125rem' } }}>
                {summary[option.value]}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Divider />

      <Box
        sx={{
          gap: 1.5,
          p: { xs: 1.5, sm: 2.5 },
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          flexDirection: 'row',
          justifyContent: 'space-between',
          bgcolor: 'background.neutral',
        }}
      >
        <TextField
          size="small"
          value={search}
          placeholder="ค้นหาชื่อ เลขที่ หรือชื่อผู้ใช้"
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
          sx={{ minWidth: 0, width: { xs: 1, sm: 340 } }}
        />
        <Button
          color="success"
          variant="outlined"
          startIcon={<RemixIcon icon="solar:check-circle-bold" />}
          disabled={!data?.rows.length}
          onClick={markEveryonePresent}
          aria-label="ทำเครื่องหมายว่ามาทั้งหมด"
          sx={{
            minWidth: { xs: 40, sm: 64 },
            px: { xs: 1, sm: 2 },
            flexShrink: 0,
            '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            มาทั้งหมด
          </Box>
        </Button>
      </Box>

      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
          sx={{ m: 2.5, mb: 0 }}
        >
          ไม่สามารถโหลดข้อมูลเช็คชื่อได้
        </Alert>
      )}
      {saveMutation.isError && (
        <Alert severity="error" sx={{ m: 2.5, mb: 0 }}>
          {saveMutation.error.message}
        </Alert>
      )}
      {saveMutation.isSuccess && !dirtyRows.length && (
        <Alert severity="success" sx={{ m: 2.5, mb: 0 }}>
          บันทึกการเช็คชื่อเรียบร้อยแล้ว
        </Alert>
      )}

      <Box sx={{ p: { xs: 1, sm: 2.5 }, gap: { xs: 0.75, sm: 1.25 }, display: 'grid' }}>
        {isLoading &&
          [1, 2, 3, 4, 5].map((item) => <Skeleton key={item} variant="rounded" height={112} />)}

        {!isLoading && !filteredRows.length && !isError && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <RemixIcon icon="solar:user-rounded-bold" width={44} sx={{ color: 'text.disabled' }} />
            <Typography variant="subtitle1" sx={{ mt: 1 }}>
              {search ? 'ไม่พบนักเรียนจากคำค้นหา' : 'ยังไม่มีนักเรียนในห้องนี้'}
            </Typography>
          </Box>
        )}

        {visibleRows.map((row) => {
          const studentName =
            `${row.student.first_name ?? ''} ${row.student.last_name ?? ''}`.trim() ||
            row.student.username;
          const edit = edits[row.student.id] ?? { status: 'present', note: '' };

          return (
            <Card
              key={row.student.id}
              variant="outlined"
              sx={{ p: { xs: 1.25, sm: 2 }, borderRadius: { xs: 1.5, sm: 1 } }}
            >
              <Box
                sx={{
                  gap: 2,
                  display: 'grid',
                  alignItems: 'center',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'minmax(210px, 0.8fr) minmax(340px, 1.2fr) minmax(200px, 0.8fr)',
                  },
                }}
              >
                <Box sx={{ gap: 1.25, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                  <Avatar
                    src={row.student.avatar_url ?? undefined}
                    alt={studentName}
                    sx={{ bgcolor: 'primary.lighter', color: 'primary.darker' }}
                  >
                    {studentName.charAt(0)}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>
                      {studentName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      เลขที่ {row.studentNumber ?? '-'} · @{row.student.username}
                    </Typography>
                  </Box>
                </Box>

                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={edit.status}
                  aria-label={`สถานะการมาเรียนของ ${studentName}`}
                  onChange={(_event, value: AttendanceStatus | null) => {
                    if (value) updateStatus(row, value);
                  }}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <ToggleButton
                      key={option.value}
                      value={option.value}
                      color={option.color}
                      aria-label={option.label}
                      sx={{ gap: 0.5, px: { xs: 0.75, sm: 1 } }}
                    >
                      <RemixIcon icon={option.icon} width={17} />
                      {option.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>

                <TextField
                  size="small"
                  fullWidth
                  label="หมายเหตุ"
                  placeholder="ไม่บังคับ"
                  value={edit.note}
                  onChange={(event) =>
                    setEdits((current) => ({
                      ...current,
                      [row.student.id]: { ...edit, note: event.target.value },
                    }))
                  }
                />
              </Box>
            </Card>
          );
        })}
      </Box>

      {!!filteredRows.length && (
        <TablePagination
          component="div"
          count={filteredRows.length}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="แสดงต่อหน้า"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
          onPageChange={(_event, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
      )}

      <Box
        sx={{
          gap: 2,
          p: 2,
          bottom: {
            xs: 'calc(var(--dashboard-bottom-nav-height, 66px) + max(env(safe-area-inset-bottom), 0px))',
            sm: 0,
          },
          zIndex: 2,
          display: 'flex',
          position: 'sticky',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography
          variant="body2"
          sx={{ color: dirtyRows.length ? 'warning.dark' : 'text.secondary' }}
        >
          {dirtyRows.length
            ? `มี ${dirtyRows.length} รายการที่ยังไม่บันทึก`
            : 'ข้อมูลเป็นปัจจุบันแล้ว'}
        </Typography>
        <Button
          variant="contained"
          startIcon={<RemixIcon icon="solar:check-circle-bold" />}
          loading={saveMutation.isPending}
          disabled={isLoading || !dirtyRows.length}
          onClick={() => saveMutation.mutate()}
        >
          บันทึก {dirtyRows.length ? `(${dirtyRows.length})` : ''}
        </Button>
      </Box>

      {scanDialogOpen && (
        <AttendanceQrScanDialog
          open
          teacherAssignmentId={teacherAssignmentId}
          sessionDate={sessionDate}
          onClose={() => setScanDialogOpen(false)}
        />
      )}
    </Card>
  );
}
