'use client';

import type { HomeroomEnrollment } from '../teacher-students-actions';
import type {
  HomeroomAttendancePeriod,
  HomeroomAttendanceStatus,
} from '../homeroom-attendance-actions';
import type {
  HomeroomAttendanceHistoryRecord,
  HomeroomAttendanceHistoryFilters,
} from '../homeroom-attendance-history-actions';

import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { getMyHomeroomStudents } from '../teacher-students-actions';
import {
  getHomeroomAttendanceHistory,
  getAllHomeroomAttendanceHistory,
} from '../homeroom-attendance-history-actions';

// ----------------------------------------------------------------------

const STATUS_CONFIG: Record<
  HomeroomAttendanceStatus,
  { label: string; color: 'success' | 'error' | 'info' | 'warning' }
> = {
  present: { label: 'มา', color: 'success' },
  absent: { label: 'ขาด', color: 'error' },
  leave: { label: 'ลา', color: 'info' },
  late: { label: 'สาย', color: 'warning' },
};

const PERIOD_LABEL: Record<HomeroomAttendancePeriod, string> = {
  morning: 'ช่วงเช้า',
  evening: 'ช่วงเย็น',
};

const initialStartDate = dayjs().subtract(29, 'day').format('YYYY-MM-DD');
const initialEndDate = dayjs().format('YYYY-MM-DD');

export function HomeroomAttendanceHistoryView() {
  const { user } = useAuthContext();
  const [classroomId, setClassroomId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [period, setPeriod] = useState<HomeroomAttendancePeriod | ''>('');
  const [status, setStatus] = useState<HomeroomAttendanceStatus | ''>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);
  const [exportError, setExportError] = useState('');

  const homeroomQuery = useQuery({
    queryKey: ['teacher-homeroom-students', user?.school_id, user?.id],
    queryFn: getMyHomeroomStudents,
    enabled: !!user?.school_id && !!user?.id,
  });

  const students = useMemo(() => {
    const rows = (homeroomQuery.data?.enrollments ?? []).filter(
      (enrollment) => !classroomId || enrollment.classroom_id === classroomId
    );
    return Array.from(new Map(rows.map((row) => [row.student.id, row])).values());
  }, [classroomId, homeroomQuery.data?.enrollments]);

  const filters = useMemo<HomeroomAttendanceHistoryFilters>(
    () => ({
      classroomId: classroomId || undefined,
      studentId: studentId || undefined,
      startDate,
      endDate,
      period: period || undefined,
      status: status || undefined,
      page: page + 1,
      pageSize: rowsPerPage,
    }),
    [classroomId, endDate, page, period, rowsPerPage, startDate, status, studentId]
  );
  const validDateRange = startDate <= endDate;

  const historyQuery = useQuery({
    queryKey: ['homeroom-attendance-history', filters],
    queryFn: () => getHomeroomAttendanceHistory(filters),
    enabled: !!user?.school_id && validDateRange,
  });

  const resetPage = () => setPage(0);
  const resetFilters = () => {
    setClassroomId('');
    setStudentId('');
    setStartDate(initialStartDate);
    setEndDate(initialEndDate);
    setPeriod('');
    setStatus('');
    setPage(0);
  };

  const exportFilters: Omit<HomeroomAttendanceHistoryFilters, 'page' | 'pageSize'> = {
    classroomId: classroomId || undefined,
    studentId: studentId || undefined,
    startDate,
    endDate,
    period: period || undefined,
    status: status || undefined,
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    setExporting(format);
    setExportError('');
    try {
      const records = await getAllHomeroomAttendanceHistory(exportFilters);
      const filename = `homeroom-attendance-${startDate}-${endDate}`;
      if (format === 'csv') exportCsv(records, filename);
      else exportExcel(records, filename);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'ไม่สามารถส่งออกข้อมูลได้');
    } finally {
      setExporting(null);
    }
  };

  const selectedStudent =
    students.find((enrollment) => enrollment.student.id === studentId) ?? null;

  return (
    <Container maxWidth="xl" sx={{ pb: 5 }}>
      <Box
        sx={{
          mb: 4,
          gap: 2,
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Button
            component={RouterLink}
            href={paths.teacher.students}
            color="inherit"
            size="small"
            startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
            sx={{ mb: 1, ml: -1 }}
          >
            นักเรียนของฉัน
          </Button>
          <Typography component="h1" variant="h3">
            ประวัติการเข้าแถว
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            ตรวจสอบย้อนหลัง กรองข้อมูล และส่งออกรายงานของชั้นที่คุณเป็นครูประจำชั้น
          </Typography>
        </Box>
        <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            disabled={!validDateRange || exporting !== null}
            loading={exporting === 'csv'}
            onClick={() => handleExport('csv')}
            startIcon={<RemixIcon icon="solar:download-bold" />}
          >
            CSV
          </Button>
          <Button
            color="success"
            variant="contained"
            disabled={!validDateRange || exporting !== null}
            loading={exporting === 'excel'}
            onClick={() => handleExport('excel')}
            startIcon={<RemixIcon icon="solar:file-text-bold" />}
          >
            Excel
          </Button>
        </Box>
      </Box>

      {!validDateRange && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด
        </Alert>
      )}
      {exportError && (
        <Alert severity="error" onClose={() => setExportError('')} sx={{ mb: 2 }}>
          {exportError}
        </Alert>
      )}
      {(homeroomQuery.isError || historyQuery.isError) && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                homeroomQuery.refetch();
                historyQuery.refetch();
              }}
            >
              ลองอีกครั้ง
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {historyQuery.error?.message ?? 'ไม่สามารถโหลดประวัติการเข้าแถวได้'}
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 3, p: { xs: 2, md: 2.5 } }}>
        <Box
          sx={{
            gap: 2,
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(6, minmax(0, 1fr))',
            },
          }}
        >
          <TextField
            select
            size="small"
            label="ชั้นเรียน"
            value={classroomId}
            onChange={(event) => {
              setClassroomId(event.target.value);
              setStudentId('');
              resetPage();
            }}
          >
            <MenuItem value="">ทุกชั้นเรียน</MenuItem>
            {(homeroomQuery.data?.classrooms ?? []).map((classroom) => (
              <MenuItem key={classroom.id} value={classroom.id}>
                {classroom.name}
              </MenuItem>
            ))}
          </TextField>

          <Autocomplete
            size="small"
            options={students}
            value={selectedStudent}
            loading={homeroomQuery.isLoading}
            getOptionKey={(option) => option.student.id}
            isOptionEqualToValue={(option, value) => option.student.id === value.student.id}
            getOptionLabel={(option) => studentName(option)}
            onChange={(_event, value) => {
              setStudentId(value?.student.id ?? '');
              resetPage();
            }}
            renderInput={(params) => <TextField {...params} label="นักเรียน" />}
          />

          <DatePicker
            label="ตั้งแต่วันที่"
            value={dayjs(startDate)}
            onChange={(value) => {
              if (!value?.isValid()) return;
              setStartDate(value.format('YYYY-MM-DD'));
              resetPage();
            }}
            format="DD/MM/YYYY"
            disableFuture
            slotProps={{ textField: { size: 'small' } }}
          />
          <DatePicker
            label="ถึงวันที่"
            value={dayjs(endDate)}
            onChange={(value) => {
              if (!value?.isValid()) return;
              setEndDate(value.format('YYYY-MM-DD'));
              resetPage();
            }}
            format="DD/MM/YYYY"
            disableFuture
            slotProps={{ textField: { size: 'small' } }}
          />

          <TextField
            select
            size="small"
            label="ช่วงเวลา"
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value as HomeroomAttendancePeriod | '');
              resetPage();
            }}
          >
            <MenuItem value="">ทุกช่วงเวลา</MenuItem>
            <MenuItem value="morning">ช่วงเช้า</MenuItem>
            <MenuItem value="evening">ช่วงเย็น</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            label="สถานะ"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as HomeroomAttendanceStatus | '');
              resetPage();
            }}
          >
            <MenuItem value="">ทุกสถานะ</MenuItem>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <MenuItem key={value} value={value}>
                {config.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="small"
            color="inherit"
            onClick={resetFilters}
            startIcon={<RemixIcon icon="solar:restart-bold" />}
          >
            ล้างตัวกรอง
          </Button>
        </Box>
      </Card>

      <Card variant="outlined">
        <Box
          sx={{
            px: 2.5,
            py: 2,
            gap: 1,
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="h6">รายการเข้าแถว</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {historyQuery.isLoading ? 'กำลังโหลด...' : `${historyQuery.data?.total ?? 0} รายการ`}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {dayjs(startDate).format('DD/MM/YYYY')} – {dayjs(endDate).format('DD/MM/YYYY')}
          </Typography>
        </Box>

        <TableContainer>
          <Table sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow>
                <TableCell>วันที่ / ช่วงเวลา</TableCell>
                <TableCell>นักเรียน</TableCell>
                <TableCell>ชั้นเรียน</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell>หมายเหตุ</TableCell>
                <TableCell>แก้ไขล่าสุด</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {historyQuery.isLoading &&
                Array.from({ length: 5 }, (_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={6} sx={{ py: 2.5, color: 'text.secondary' }}>
                      กำลังโหลดข้อมูล...
                    </TableCell>
                  </TableRow>
                ))}
              {!historyQuery.isLoading && !historyQuery.data?.records.length && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 8, textAlign: 'center' }}>
                    <RemixIcon
                      icon="solar:calendar-date-bold"
                      width={42}
                      sx={{ color: 'text.disabled' }}
                    />
                    <Typography variant="subtitle1" sx={{ mt: 1 }}>
                      ยังไม่มีประวัติการเข้าแถวตามตัวกรอง
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      ลองเปลี่ยนช่วงวันที่ ชั้นเรียน หรือสถานะ
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {(historyQuery.data?.records ?? []).map((record) => (
                <HistoryRow key={record.id} record={record} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={historyQuery.data?.total ?? 0}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="แสดงต่อหน้า"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
          onPageChange={(_event, value) => setPage(value)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
      </Card>
    </Container>
  );
}

// ----------------------------------------------------------------------

function HistoryRow({ record }: { record: HomeroomAttendanceHistoryRecord }) {
  const config = STATUS_CONFIG[record.status];
  const name =
    `${record.student.firstName ?? ''} ${record.student.lastName ?? ''}`.trim() ||
    record.student.username;

  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="subtitle2">
          {dayjs(record.attendanceDate).format('DD/MM/YYYY')}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {PERIOD_LABEL[record.period]}
        </Typography>
      </TableCell>
      <TableCell>
        <Box sx={{ gap: 1.25, display: 'flex', alignItems: 'center' }}>
          <Avatar src={record.student.avatarUrl ?? undefined} sx={{ width: 36, height: 36 }}>
            {name.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="subtitle2">{name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {record.student.studentCode ?? `@${record.student.username}`}
            </Typography>
          </Box>
        </Box>
      </TableCell>
      <TableCell>
        <Typography variant="body2">{record.classroom.name}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          ปี {record.classroom.academic_years?.year ?? '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <Label variant="soft" color={config.color}>
          {config.label}
        </Label>
      </TableCell>
      <TableCell sx={{ maxWidth: 260 }}>
        <Typography variant="body2" sx={{ whiteSpace: 'normal' }}>
          {record.note || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {dayjs(record.updatedAt).format('DD/MM/YYYY HH:mm')}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

function studentName(enrollment: HomeroomEnrollment) {
  return (
    `${enrollment.student.first_name ?? ''} ${enrollment.student.last_name ?? ''}`.trim() ||
    enrollment.student.username
  );
}

function exportRows(records: HomeroomAttendanceHistoryRecord[]) {
  return records.map((record) => ({
    วันที่: dayjs(record.attendanceDate).format('DD/MM/YYYY'),
    ช่วงเวลา: PERIOD_LABEL[record.period],
    รหัสนักเรียน: record.student.studentCode ?? '',
    ชื่อนักเรียน:
      `${record.student.firstName ?? ''} ${record.student.lastName ?? ''}`.trim() ||
      record.student.username,
    ชั้นเรียน: record.classroom.name,
    ปีการศึกษา: record.classroom.academic_years?.year ?? '',
    สถานะ: STATUS_CONFIG[record.status].label,
    หมายเหตุ: record.note ?? '',
    แก้ไขล่าสุด: dayjs(record.updatedAt).format('DD/MM/YYYY HH:mm'),
  }));
}

function downloadFile(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function exportCsv(records: HomeroomAttendanceHistoryRecord[], filename: string) {
  const rows = exportRows(records);
  const headers = Object.keys(rows[0] ?? exportRowsPlaceholder);
  const content = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) =>
      headers.map((header) => escapeCsv(row[header as keyof typeof row])).join(',')
    ),
  ].join('\r\n');
  downloadFile(`\uFEFF${content}`, 'text/csv;charset=utf-8', `${filename}.csv`);
}

const exportRowsPlaceholder = {
  วันที่: '',
  ช่วงเวลา: '',
  รหัสนักเรียน: '',
  ชื่อนักเรียน: '',
  ชั้นเรียน: '',
  ปีการศึกษา: '',
  สถานะ: '',
  หมายเหตุ: '',
  แก้ไขล่าสุด: '',
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function exportExcel(records: HomeroomAttendanceHistoryRecord[], filename: string) {
  const rows = exportRows(records);
  const headers = Object.keys(rows[0] ?? exportRowsPlaceholder);
  const table = `
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${headers
                .map((header) => `<td>${escapeHtml(row[header as keyof typeof row])}</td>`)
                .join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table>`;
  const workbook = `\uFEFF<html xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="UTF-8"></head><body>${table}</body></html>`;
  downloadFile(workbook, 'application/vnd.ms-excel;charset=utf-8', `${filename}.xls`);
}
