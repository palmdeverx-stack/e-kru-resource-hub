'use client';

import type {
  HomeroomAttendanceRow,
  HomeroomAttendancePeriod,
  HomeroomAttendanceStatus,
} from '../homeroom-attendance-actions';

import dayjs from 'dayjs';
import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { RemixIcon } from 'src/components/remix-icon';

import { getHomeroomAttendance, saveHomeroomAttendance } from '../homeroom-attendance-actions';

const STATUS_OPTIONS: Array<{
  value: HomeroomAttendanceStatus;
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

type AttendanceEdit = { status: HomeroomAttendanceStatus; note: string };
type Props = { classroomId: string; classroomName: string };

export function HomeroomAttendanceSection({ classroomId, classroomName }: Props) {
  const queryClient = useQueryClient();
  const [attendanceDate, setAttendanceDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [period, setPeriod] = useState<HomeroomAttendancePeriod>('morning');
  const [edits, setEdits] = useState<Record<string, AttendanceEdit>>({});
  const [search, setSearch] = useState('');

  const queryKey = ['homeroom-attendance', classroomId, attendanceDate, period] as const;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => getHomeroomAttendance(classroomId, attendanceDate, period),
    enabled: !!classroomId,
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
  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    if (!keyword) return data?.rows ?? [];
    return (data?.rows ?? []).filter((row) =>
      [
        row.studentNumber,
        row.student.student_code,
        row.student.username,
        row.student.first_name,
        row.student.last_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword)
    );
  }, [data, search]);
  const summary = Object.values(edits).reduce(
    (result, edit) => ({ ...result, [edit.status]: result[edit.status] + 1 }),
    { present: 0, absent: 0, leave: 0, late: 0 } as Record<HomeroomAttendanceStatus, number>
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      saveHomeroomAttendance(
        classroomId,
        attendanceDate,
        period,
        dirtyRows.map((row) => ({
          studentId: row.student.id,
          status: edits[row.student.id].status,
          note: edits[row.student.id].note.trim() || null,
        }))
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateStatus = (row: HomeroomAttendanceRow, status: HomeroomAttendanceStatus) => {
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
  const changePeriod = (nextPeriod: HomeroomAttendancePeriod) => {
    setPeriod(nextPeriod);
    setSearch('');
    saveMutation.reset();
  };

  return (
    <Box>
      <Box
        sx={{
          gap: 2,
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontSize: { xs: '1.1rem', sm: '1.5rem' } }}>
            เช็คชื่อเข้าแถว
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
            {classroomName} · บันทึกแยกช่วงเช้าและเย็นในแต่ละวัน
          </Typography>
        </Box>
        <Box
          sx={{
            gap: { xs: 1, sm: 1.5 },
            display: { xs: 'grid', sm: 'flex' },
            width: { xs: 1, sm: 'auto' },
            flexDirection: { xs: 'column', sm: 'row' },
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'none' },
          }}
        >
          <DatePicker
            label="วันที่"
            value={dayjs(attendanceDate)}
            onChange={(value) => {
              if (!value?.isValid()) return;
              setAttendanceDate(value.format('YYYY-MM-DD'));
              setSearch('');
              saveMutation.reset();
            }}
            format="DD/MM/YYYY"
            disableFuture
            slotProps={{ textField: { size: 'small' } }}
            sx={{ minWidth: { xs: 1, sm: 190 } }}
          />
          <TextField
            select
            size="small"
            label="ช่วงเวลา"
            value={period}
            onChange={(event) => changePeriod(event.target.value as HomeroomAttendancePeriod)}
            sx={{ minWidth: { xs: 1, sm: 180 } }}
          >
            <MenuItem value="morning">ช่วงเช้า</MenuItem>
            <MenuItem value="evening">ช่วงเย็น</MenuItem>
          </TextField>
        </Box>
      </Box>

      <Box
        sx={{
          gap: { xs: 0.75, sm: 3 },
          py: { xs: 1.5, sm: 2 },
          display: { xs: 'grid', sm: 'flex' },
          flexWrap: 'wrap',
          alignItems: 'center',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'none' },
        }}
      >
        {STATUS_OPTIONS.map((option) => (
          <Box
            key={option.value}
            sx={{
              gap: { xs: 0.75, sm: 1 },
              p: { xs: 0.75, sm: 0 },
              display: 'flex',
              borderRadius: { xs: 1.25, sm: 0 },
              alignItems: 'center',
              bgcolor: { xs: 'background.neutral', sm: 'transparent' },
            }}
          >
            <Box
              sx={{
                width: { xs: 26, sm: 30 },
                height: { xs: 26, sm: 30 },
                display: 'grid',
                borderRadius: '50%',
                placeItems: 'center',
                color: `${option.color}.dark`,
                bgcolor: `${option.color}.lighter`,
              }}
            >
              <RemixIcon icon={option.icon} width={17} />
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {option.label}
            </Typography>
            <Typography variant="subtitle1">{summary[option.value]}</Typography>
          </Box>
        ))}
      </Box>

      <Divider />

      <Box
        sx={{
          gap: 1.5,
          py: 2,
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          flexDirection: { xs: 'row', sm: 'row' },
          justifyContent: 'space-between',
        }}
      >
        <TextField
          size="small"
          value={search}
          placeholder="ค้นหาชื่อ รหัส หรือเลขที่"
          onChange={(event) => setSearch(event.target.value)}
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
          variant="text"
          disabled={!data?.rows.length}
          onClick={markEveryonePresent}
          startIcon={<RemixIcon icon="solar:check-circle-bold" />}
          aria-label="ทำเครื่องหมายว่ามาทั้งหมด"
          sx={{
            flexShrink: 0,
            minWidth: { xs: 42, sm: 64 },
            px: { xs: 1, sm: 2 },
            whiteSpace: 'nowrap',
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
          sx={{ mb: 2 }}
        >
          ไม่สามารถโหลดข้อมูลเช็คชื่อเข้าแถวได้
        </Alert>
      )}
      {saveMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {saveMutation.error.message}
        </Alert>
      )}
      {saveMutation.isSuccess && !dirtyRows.length && (
        <Alert severity="success" sx={{ mb: 2 }}>
          บันทึกเช็คชื่อ{period === 'morning' ? 'ช่วงเช้า' : 'ช่วงเย็น'}เรียบร้อยแล้ว
        </Alert>
      )}

      <Box
        sx={{
          gap: 1,
          display: { xs: 'flex', sm: 'none' },
          flexDirection: 'column',
        }}
      >
        {isLoading &&
          [1, 2, 3].map((item) => (
            <Skeleton key={item} variant="rounded" height={170} sx={{ borderRadius: 2 }} />
          ))}

        {!isLoading && !filteredRows.length && !isError && (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <RemixIcon icon="solar:user-rounded-bold" width={38} sx={{ color: 'text.disabled' }} />
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              {search ? 'ไม่พบนักเรียนจากคำค้นหา' : 'ยังไม่มีนักเรียนในห้องนี้'}
            </Typography>
          </Box>
        )}

        {filteredRows.map((row) => {
          const name =
            `${row.student.first_name ?? ''} ${row.student.last_name ?? ''}`.trim() ||
            row.student.username;
          const edit = edits[row.student.id] ?? { status: 'present', note: '' };

          return (
            <Box
              key={row.student.id}
              sx={{
                p: 1.25,
                border: '1px solid',
                borderRadius: 1.75,
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Box sx={{ gap: 1, mb: 1.25, display: 'flex', alignItems: 'center' }}>
                <Avatar src={row.student.avatar_url ?? undefined} sx={{ width: 40, height: 40 }}>
                  {name.charAt(0)}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2" noWrap>
                    {name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                    {row.student.student_code ?? '-'} · เลขที่ {row.studentNumber ?? '-'}
                  </Typography>
                </Box>
              </Box>

              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={edit.status}
                onChange={(_event, status: HomeroomAttendanceStatus | null) => {
                  if (status) updateStatus(row, status);
                }}
                sx={{ mb: 1 }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <ToggleButton
                    key={option.value}
                    value={option.value}
                    color={option.color}
                    sx={{ minWidth: 0, px: 0.5, fontSize: '0.75rem' }}
                  >
                    {option.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <TextField
                size="small"
                fullWidth
                placeholder="หมายเหตุ (ถ้ามี)"
                value={edit.note}
                onChange={(event) =>
                  setEdits((current) => ({
                    ...current,
                    [row.student.id]: { ...edit, note: event.target.value },
                  }))
                }
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
            </Box>
          );
        })}
      </Box>

      <TableContainer sx={{ display: { xs: 'none', sm: 'block' } }}>
        <Table sx={{ minWidth: 920 }}>
          <TableHead>
            <TableRow>
              <TableCell>นักเรียน</TableCell>
              <TableCell>รหัส / เลขที่</TableCell>
              <TableCell>สถานะเข้าแถว</TableCell>
              <TableCell>หมายเหตุ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading &&
              [1, 2, 3, 4, 5].map((item) => (
                <TableRow key={item}>
                  <TableCell colSpan={4}>
                    <Skeleton height={48} />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && !filteredRows.length && !isError && (
              <TableRow>
                <TableCell colSpan={4} sx={{ py: 7, textAlign: 'center' }}>
                  <RemixIcon
                    icon="solar:user-rounded-bold"
                    width={40}
                    sx={{ color: 'text.disabled' }}
                  />
                  <Typography variant="subtitle1" sx={{ mt: 1 }}>
                    {search ? 'ไม่พบนักเรียนจากคำค้นหา' : 'ยังไม่มีนักเรียนในห้องนี้'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {filteredRows.map((row) => {
              const name =
                `${row.student.first_name ?? ''} ${row.student.last_name ?? ''}`.trim() ||
                row.student.username;
              const edit = edits[row.student.id] ?? { status: 'present', note: '' };

              return (
                <TableRow key={row.student.id} hover>
                  <TableCell>
                    <Box sx={{ gap: 1.25, display: 'flex', alignItems: 'center' }}>
                      <Avatar
                        src={row.student.avatar_url ?? undefined}
                        sx={{ width: 38, height: 38 }}
                      >
                        {name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">{name}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          @{row.student.username}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.student.student_code ?? '-'}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      เลขที่ {row.studentNumber ?? '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={edit.status}
                      onChange={(_event, status: HomeroomAttendanceStatus | null) => {
                        if (status) updateStatus(row, status);
                      }}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <ToggleButton
                          key={option.value}
                          value={option.value}
                          color={option.color}
                          sx={{ px: 1.5 }}
                        >
                          {option.label}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="เพิ่มหมายเหตุ"
                      value={edit.note}
                      onChange={(event) =>
                        setEdits((current) => ({
                          ...current,
                          [row.student.id]: { ...edit, note: event.target.value },
                        }))
                      }
                      slotProps={{ htmlInput: { maxLength: 500 } }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        sx={{
          pt: { xs: 1.5, sm: 2 },
          mt: { xs: 1, sm: 0 },
          pb: { xs: 1, sm: 0 },
          px: { xs: 1, sm: 0 },
          gap: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          position: { xs: 'sticky', sm: 'static' },
          bottom: {
            xs: 'calc(var(--dashboard-bottom-nav-height, 66px) + max(env(safe-area-inset-bottom), 0px))',
            sm: 'auto',
          },
          zIndex: { xs: 2, sm: 'auto' },
        }}
      >
        <Typography variant="body2" sx={{ mr: 'auto', color: 'text.secondary' }}>
          {dirtyRows.length ? `มีการแก้ไข ${dirtyRows.length} คน` : 'ยังไม่มีการแก้ไข'}
        </Typography>
        <Button
          variant="contained"
          loading={saveMutation.isPending}
          disabled={!dirtyRows.length}
          onClick={() => saveMutation.mutate()}
          startIcon={<RemixIcon icon="solar:check-circle-bold" />}
        >
          บันทึก
        </Button>
      </Box>
    </Box>
  );
}
