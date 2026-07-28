'use client';

import type { RosterRow } from '../teacher-assignment-actions';
import type {
  SubjectAttendanceStatus,
  SubjectAttendanceSource,
  SubjectAttendanceHistoryRecord,
  SubjectAttendanceHistoryFilters,
} from '../subject-attendance-history-actions';

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

import { getRoster } from '../teacher-assignment-actions';
import {
  getSubjectAttendanceHistory,
  getAllSubjectAttendanceHistory,
} from '../subject-attendance-history-actions';

// ----------------------------------------------------------------------

const STATUS_CONFIG: Record<
  SubjectAttendanceStatus,
  { label: string; color: 'success' | 'error' | 'info' | 'warning' }
> = {
  present: { label: 'มา', color: 'success' },
  absent: { label: 'ขาด', color: 'error' },
  leave: { label: 'ลา', color: 'info' },
  late: { label: 'สาย', color: 'warning' },
};

const SOURCE_LABEL: Record<SubjectAttendanceSource, string> = {
  daily: 'เช็คชื่อรายวัน',
  qr: 'สแกน QR รายคาบ',
};

const initialStartDate = dayjs().subtract(29, 'day').format('YYYY-MM-DD');
const initialEndDate = dayjs().format('YYYY-MM-DD');

export function TeacherAssignmentAttendanceHistoryView({
  teacherAssignmentId,
}: {
  teacherAssignmentId: string;
}) {
  const [studentId, setStudentId] = useState('');
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [status, setStatus] = useState<SubjectAttendanceStatus | ''>('');
  const [source, setSource] = useState<SubjectAttendanceSource | ''>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);
  const [exportError, setExportError] = useState('');

  const rosterQuery = useQuery({
    queryKey: ['roster', teacherAssignmentId],
    queryFn: () => getRoster(teacherAssignmentId),
  });
  const filters = useMemo<SubjectAttendanceHistoryFilters>(
    () => ({
      studentId: studentId || undefined,
      startDate,
      endDate,
      status: status || undefined,
      source: source || undefined,
      page: page + 1,
      pageSize: rowsPerPage,
    }),
    [endDate, page, rowsPerPage, source, startDate, status, studentId]
  );
  const validDateRange = startDate <= endDate;
  const historyQuery = useQuery({
    queryKey: ['subject-attendance-history', teacherAssignmentId, filters],
    queryFn: () => getSubjectAttendanceHistory(teacherAssignmentId, filters),
    enabled: validDateRange,
  });

  const selectedStudent =
    rosterQuery.data?.roster.find((row) => row.student.id === studentId) ?? null;
  const resetPage = () => setPage(0);
  const resetFilters = () => {
    setStudentId('');
    setStartDate(initialStartDate);
    setEndDate(initialEndDate);
    setStatus('');
    setSource('');
    setPage(0);
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    setExporting(format);
    setExportError('');
    try {
      const records = await getAllSubjectAttendanceHistory(teacherAssignmentId, {
        studentId: studentId || undefined,
        startDate,
        endDate,
        status: status || undefined,
        source: source || undefined,
      });
      const filename = `subject-attendance-${startDate}-${endDate}`;
      if (format === 'csv') exportCsv(records, filename);
      else exportExcel(records, filename);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'ไม่สามารถส่งออกข้อมูลได้');
    } finally {
      setExporting(null);
    }
  };

  const isLoading = rosterQuery.isLoading || historyQuery.isLoading;

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
            href={`${paths.teacher.assignmentDetail(teacherAssignmentId)}?tab=attendance`}
            color="inherit"
            size="small"
            startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
            sx={{ mb: 1, ml: -1 }}
          >
            กลับไปเช็คชื่อ
          </Button>
          <Typography component="h1" variant="h3">
            ประวัติการเข้าเรียน
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            {rosterQuery.data
              ? `${rosterQuery.data.subjectCode ? `${rosterQuery.data.subjectCode} · ` : ''}${rosterQuery.data.subjectName} · ห้อง ${rosterQuery.data.classroomName}`
              : 'ตรวจสอบ กรอง และส่งออกข้อมูลการเข้าเรียนรายวิชา'}
          </Typography>
        </Box>
        <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            disabled={!validDateRange || exporting !== null}
            loading={exporting === 'csv'}
            onClick={() => void handleExport('csv')}
            startIcon={<RemixIcon icon="solar:download-bold" />}
          >
            CSV
          </Button>
          <Button
            color="success"
            variant="contained"
            disabled={!validDateRange || exporting !== null}
            loading={exporting === 'excel'}
            onClick={() => void handleExport('excel')}
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
      {(rosterQuery.isError || historyQuery.isError) && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                rosterQuery.refetch();
                historyQuery.refetch();
              }}
            >
              ลองอีกครั้ง
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {historyQuery.error?.message ?? 'ไม่สามารถโหลดประวัติการเข้าเรียนได้'}
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
              lg: 'repeat(5, minmax(0, 1fr))',
            },
          }}
        >
          <Autocomplete
            size="small"
            options={rosterQuery.data?.roster ?? []}
            value={selectedStudent}
            loading={rosterQuery.isLoading}
            getOptionKey={(option) => option.student.id}
            isOptionEqualToValue={(option, value) => option.student.id === value.student.id}
            getOptionLabel={studentName}
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
            label="วิธีบันทึก"
            value={source}
            onChange={(event) => {
              setSource(event.target.value as SubjectAttendanceSource | '');
              resetPage();
            }}
          >
            <MenuItem value="">ทุกวิธี</MenuItem>
            <MenuItem value="daily">{SOURCE_LABEL.daily}</MenuItem>
            <MenuItem value="qr">{SOURCE_LABEL.qr}</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="สถานะ"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as SubjectAttendanceStatus | '');
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
            <Typography variant="h6">รายการเข้าเรียน</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {isLoading ? 'กำลังโหลด...' : `${historyQuery.data?.total ?? 0} รายการ`}
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
                <TableCell>วันที่</TableCell>
                <TableCell>นักเรียน</TableCell>
                <TableCell>วิธีบันทึก / คาบ</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell>หมายเหตุ</TableCell>
                <TableCell>แก้ไขล่าสุด</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }, (_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={6} sx={{ py: 2.5, color: 'text.secondary' }}>
                      กำลังโหลดข้อมูล...
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && !historyQuery.data?.records.length && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 8, textAlign: 'center' }}>
                    <RemixIcon
                      icon="solar:calendar-date-bold"
                      width={42}
                      sx={{ color: 'text.disabled' }}
                    />
                    <Typography variant="subtitle1" sx={{ mt: 1 }}>
                      ยังไม่มีประวัติการเข้าเรียนตามตัวกรอง
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      ลองเปลี่ยนช่วงวันที่ นักเรียน หรือสถานะ
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

function HistoryRow({ record }: { record: SubjectAttendanceHistoryRecord }) {
  const config = STATUS_CONFIG[record.status];
  const name =
    `${record.student.firstName ?? ''} ${record.student.lastName ?? ''}`.trim() ||
    record.student.username;
  const source: SubjectAttendanceSource = record.periodKey === 'daily' ? 'daily' : 'qr';

  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="subtitle2">
          {dayjs(record.attendanceDate).format('DD/MM/YYYY')}
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
        <Typography variant="body2">{SOURCE_LABEL[source]}</Typography>
        {source === 'qr' && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {record.note?.replace(/^QR · /, '') || 'คาบเรียน'}
          </Typography>
        )}
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

function studentName(row: RosterRow) {
  return (
    `${row.student.first_name ?? ''} ${row.student.last_name ?? ''}`.trim() || row.student.username
  );
}

function exportRows(records: SubjectAttendanceHistoryRecord[]) {
  return records.map((record) => {
    const source: SubjectAttendanceSource = record.periodKey === 'daily' ? 'daily' : 'qr';
    return {
      วันที่: dayjs(record.attendanceDate).format('DD/MM/YYYY'),
      รหัสนักเรียน: record.student.studentCode ?? '',
      ชื่อนักเรียน:
        `${record.student.firstName ?? ''} ${record.student.lastName ?? ''}`.trim() ||
        record.student.username,
      วิธีบันทึก: SOURCE_LABEL[source],
      คาบเรียน: source === 'qr' ? record.note?.replace(/^QR · /, '') || 'คาบเรียน' : '',
      สถานะ: STATUS_CONFIG[record.status].label,
      หมายเหตุ: record.note ?? '',
      แก้ไขล่าสุด: dayjs(record.updatedAt).format('DD/MM/YYYY HH:mm'),
    };
  });
}

const exportRowsPlaceholder = {
  วันที่: '',
  รหัสนักเรียน: '',
  ชื่อนักเรียน: '',
  วิธีบันทึก: '',
  คาบเรียน: '',
  สถานะ: '',
  หมายเหตุ: '',
  แก้ไขล่าสุด: '',
};

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

function exportCsv(records: SubjectAttendanceHistoryRecord[], filename: string) {
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

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function exportExcel(records: SubjectAttendanceHistoryRecord[], filename: string) {
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
