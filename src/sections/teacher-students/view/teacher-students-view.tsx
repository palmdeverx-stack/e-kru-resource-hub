'use client';

import type { UserRow } from 'src/sections/user/user-actions';
import type { HomeroomEnrollment } from '../teacher-students-actions';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';

import { listUsers } from 'src/sections/user/user-actions';
import { useSchoolSubscription } from 'src/sections/school-subscription/use-school-subscription';

import { useAuthContext } from 'src/auth/hooks';

import { HomeroomAttendanceSection } from '../components/homeroom-attendance-section';
import {
  getMyHomeroomStudents,
  addMyHomeroomStudents,
  updateMyHomeroomStudent,
  removeMyHomeroomStudent,
} from '../teacher-students-actions';

// ----------------------------------------------------------------------

const StudentQrDialog = dynamic(
  () => import('../components/student-qr-dialog').then((module) => module.StudentQrDialog),
  { ssr: false }
);

const GuardianLineMessageDialog = dynamic(
  () =>
    import('../components/guardian-line-message-dialog').then(
      (module) => module.GuardianLineMessageDialog
    ),
  { ssr: false }
);

const STATUS_LABEL = {
  studying: 'กำลังศึกษา',
  graduated: 'สำเร็จการศึกษา',
  transferred: 'ย้ายโรงเรียน',
  withdrawn: 'ลาออก',
  dismissed: 'พ้นสภาพ',
} as const;

function StudentMeta({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0, textAlign: 'center' }}>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }} noWrap>
        {value}
      </Typography>
    </Box>
  );
}

export function TeacherStudentsView() {
  const { user } = useAuthContext();
  const subscriptionQuery = useSchoolSubscription(user?.school_id);
  const queryClient = useQueryClient();
  const [classroomId, setClassroomId] = useState('');
  const [section, setSection] = useState<'students' | 'attendance'>('students');
  const [search, setSearch] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<UserRow[]>([]);
  const [editingRow, setEditingRow] = useState<HomeroomEnrollment | null>(null);
  const [studentNumber, setStudentNumber] = useState('');
  const [deletingRow, setDeletingRow] = useState<HomeroomEnrollment | null>(null);
  const [qrRow, setQrRow] = useState<HomeroomEnrollment | null>(null);
  const [lineMessageRow, setLineMessageRow] = useState<HomeroomEnrollment | null>(null);
  const canUseQr =
    subscriptionQuery.data?.subscription.enabled_features.includes('teacher.qr_attendance') ??
    false;
  const canSendLine =
    subscriptionQuery.data?.subscription.enabled_features.includes('admin.line_notifications') ??
    false;

  const {
    data = { classrooms: [], enrollments: [] },
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['teacher-homeroom-students', user?.school_id, user?.id],
    queryFn: getMyHomeroomStudents,
    enabled: !!user?.school_id && !!user?.id,
  });
  const { data: schoolStudents = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['users', 'student', user?.school_id],
    queryFn: () => listUsers('student'),
    enabled: addDialogOpen && !!user?.school_id,
  });

  const selectedClassroom =
    data.classrooms.find((classroom) => classroom.id === classroomId) ?? data.classrooms[0] ?? null;
  const resolvedClassroomId = selectedClassroom?.id ?? '';
  const roster = data.enrollments.filter(
    (enrollment) => enrollment.classroom_id === resolvedClassroomId
  );
  const filteredRoster = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    if (!keyword) return roster;
    return roster.filter((row) =>
      [
        row.student.student_code,
        row.student.username,
        row.student.first_name,
        row.student.last_name,
        row.student.nickname,
        row.student_number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword)
    );
  }, [roster, search]);

  const existingStudentIds = new Set(data.enrollments.map((row) => row.student.id));
  const availableStudents = schoolStudents.filter(
    (student) =>
      !existingStudentIds.has(student.id) &&
      student.is_active !== false &&
      (student.student_status ?? 'studying') === 'studying'
  );

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ['teacher-homeroom-students', user?.school_id, user?.id],
    });

  const addMutation = useMutation({
    mutationFn: () =>
      addMyHomeroomStudents(
        resolvedClassroomId,
        selectedStudents.map((student) => student.id)
      ),
    onSuccess: async () => {
      await refresh();
      setAddDialogOpen(false);
      setSelectedStudents([]);
    },
  });
  const updateMutation = useMutation({
    mutationFn: () => updateMyHomeroomStudent(editingRow!.id, studentNumber),
    onSuccess: async () => {
      await refresh();
      setEditingRow(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: removeMyHomeroomStudent,
    onSuccess: async () => {
      await refresh();
      setDeletingRow(null);
    },
  });

  const openEdit = (row: HomeroomEnrollment) => {
    updateMutation.reset();
    setEditingRow(row);
    setStudentNumber(row.student_number ?? '');
  };

  return (
    <Container maxWidth={false} sx={{ px: { xs: 1.5, sm: 3 }, pb: { xs: 3, sm: 5 } }}>
      <Box
        sx={{
          mb: { xs: 2.5, sm: 4 },
          gap: { xs: 1.5, sm: 2 },
          display: { xs: 'grid', sm: 'flex' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', sm: 'none' },
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h1"
            variant="h3"
            sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' } }}
          >
            นักเรียนของฉัน
          </Typography>
          <Typography
            variant="body2"
            sx={{
              mt: { xs: 0.25, sm: 1 },
              color: 'text.secondary',
              fontSize: { xs: '0.78rem', sm: '0.875rem' },
            }}
          >
            รายชื่อนักเรียนในชั้นที่คุณเป็นครูประจำชั้น
          </Typography>
        </Box>
        <Box
          sx={{
            gap: 1,
            mt: { xs: 0.25, sm: 0 },
            width: 'auto',
            display: { xs: 'grid', sm: 'flex' },
            flexWrap: 'wrap',
            justifyContent: { xs: 'end', sm: 'initial' },
            gridTemplateColumns: { xs: '44px', sm: 'none' },
          }}
        >
          <Button
            component={RouterLink}
            href={paths.teacher.attendanceHistory}
            variant="outlined"
            startIcon={<RemixIcon icon="solar:calendar-date-bold" />}
            aria-label="ประวัติการเข้าแถว"
            sx={{
              minWidth: { xs: 44, sm: 64 },
              minHeight: { xs: 44, sm: 'auto' },
              gridColumn: { xs: 1, sm: 'auto' },
              gridRow: { xs: 1, sm: 'auto' },
              '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              ประวัติการเข้าแถว
            </Box>
          </Button>
          {canUseQr && (
            <Button
              component={RouterLink}
              href={paths.teacher.attendanceScan}
              variant="outlined"
              startIcon={<RemixIcon icon="solar:camera-add-bold" />}
              aria-label="สแกน QR"
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                minWidth: { xs: 44, sm: 64 },
                minHeight: { xs: 44, sm: 'auto' },
                '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                สแกน QR
              </Box>
            </Button>
          )}
          {section === 'students' && (
            <Button
              variant="contained"
              disabled={!selectedClassroom}
              onClick={() => {
                addMutation.reset();
                setSelectedStudents([]);
                setAddDialogOpen(true);
              }}
              startIcon={<RemixIcon icon="solar:user-plus-bold" />}
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                minHeight: { xs: 44, sm: 'auto' },
                gridColumn: { xs: 1, sm: 'auto' },
                gridRow: { xs: 1, sm: 'auto' },
              }}
            >
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                เพิ่มนักเรียน
              </Box>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                เพิ่มนักเรียนเข้าชั้น
              </Box>
            </Button>
          )}
        </Box>
      </Box>

      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
          sx={{ mb: 3 }}
        >
          ไม่สามารถโหลดรายชื่อนักเรียนได้
        </Alert>
      )}

      {!isLoading && !data.classrooms.length && (
        <Alert severity="info">
          คุณยังไม่ได้รับมอบหมายเป็นครูประจำชั้น กรุณาติดต่อผู้ดูแลโรงเรียน
        </Alert>
      )}

      {!!data.classrooms.length && (
        <>
          <Box
            sx={{
              mb: { xs: 2, sm: 3 },
              gap: { xs: 1.25, sm: 2 },
              display: 'flex',
              alignItems: { xs: 'stretch', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
            }}
          >
            <TextField
              select
              size="small"
              label="ชั้นเรียน"
              value={resolvedClassroomId}
              onChange={(event) => {
                setClassroomId(event.target.value);
                setSearch('');
              }}
              sx={{ width: { xs: 1, sm: 320 } }}
            >
              {data.classrooms.map((classroom) => {
                const studentCount = data.enrollments.filter(
                  (row) => row.classroom_id === classroom.id
                ).length;
                return (
                  <MenuItem key={classroom.id} value={classroom.id}>
                    {classroom.name} · ปี {classroom.academic_years?.year ?? '-'} · {studentCount}{' '}
                    คน
                  </MenuItem>
                );
              })}
            </TextField>

            <Box
              sx={{
                p: 0.5,
                gap: 0.5,
                width: { xs: 1, sm: 'auto' },
                display: 'flex',
                borderRadius: 1.5,
                bgcolor: 'background.neutral',
              }}
            >
              <Button
                size="small"
                variant={section === 'students' ? 'contained' : 'text'}
                color={section === 'students' ? 'primary' : 'inherit'}
                onClick={() => setSection('students')}
                startIcon={<RemixIcon icon="solar:users-group-rounded-bold" />}
                sx={{
                  flex: 1,
                  px: { xs: 1, sm: 2 },
                  fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                  whiteSpace: 'nowrap',
                }}
              >
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  รายชื่อ ({roster.length})
                </Box>
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  รายชื่อนักเรียน ({roster.length})
                </Box>
              </Button>
              <Button
                size="small"
                variant={section === 'attendance' ? 'contained' : 'text'}
                color={section === 'attendance' ? 'primary' : 'inherit'}
                onClick={() => setSection('attendance')}
                startIcon={<RemixIcon icon="solar:check-circle-bold" />}
                sx={{
                  flex: 1,
                  px: { xs: 1, sm: 2 },
                  fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                  whiteSpace: 'nowrap',
                }}
              >
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  เช็คชื่อ
                </Box>
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  เช็คชื่อเข้าแถว
                </Box>
              </Button>
            </Box>
          </Box>

          {section === 'students' && (
            <Card variant="outlined" sx={{ borderRadius: { xs: 2, sm: 2.5 } }}>
              <Box
                sx={{
                  p: { xs: 1.25, sm: 2.5 },
                  gap: { xs: 1, sm: 2 },
                  display: 'flex',
                  alignItems: { xs: 'stretch', sm: 'center' },
                  flexDirection: { xs: 'column', sm: 'row' },
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}>
                    {selectedClassroom?.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {filteredRoster.length} คน
                  </Typography>
                </Box>
                <TextField
                  size="small"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ค้นหารหัส ชื่อ หรือเลขที่"
                  sx={{ width: { xs: 1, sm: 300 } }}
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

              <Box
                sx={{
                  p: 1,
                  gap: 1,
                  display: { xs: 'flex', sm: 'none' },
                  flexDirection: 'column',
                }}
              >
                {isLoading && (
                  <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                    กำลังโหลด...
                  </Typography>
                )}

                {!isLoading && !filteredRoster.length && (
                  <Box sx={{ py: 5, textAlign: 'center' }}>
                    <RemixIcon
                      icon="solar:users-group-rounded-bold"
                      width={38}
                      sx={{ mb: 1, color: 'text.disabled' }}
                    />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {search ? 'ไม่พบนักเรียนจากคำค้นหา' : 'ยังไม่มีนักเรียนในชั้นนี้'}
                    </Typography>
                  </Box>
                )}

                {filteredRoster.map((row) => {
                  const name =
                    `${row.student.first_name ?? ''} ${row.student.last_name ?? ''}`.trim() ||
                    row.student.username;
                  const status = row.student.student_status ?? 'studying';

                  return (
                    <Box
                      key={row.id}
                      sx={{
                        p: 1.25,
                        border: '1px solid',
                        borderRadius: 1.75,
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
                        <Avatar
                          src={row.student.avatar_url ?? undefined}
                          sx={{ width: 42, height: 42 }}
                        >
                          {name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="subtitle2" noWrap>
                            {name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                            {row.student.nickname ? `ชื่อเล่น ${row.student.nickname} · ` : ''}@
                            {row.student.username}
                          </Typography>
                        </Box>
                        <Label variant="soft" color={status === 'studying' ? 'success' : 'warning'}>
                          {STATUS_LABEL[status]}
                        </Label>
                      </Box>

                      <Box
                        sx={{
                          my: 1,
                          py: 0.75,
                          px: 1,
                          gap: 1,
                          display: 'grid',
                          borderRadius: 1.25,
                          bgcolor: 'background.neutral',
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        }}
                      >
                        <StudentMeta label="รหัส" value={row.student.student_code ?? '-'} />
                        <StudentMeta label="เลขที่" value={row.student_number ?? '-'} />
                      </Box>

                      <Box
                        sx={{
                          gap: 0.5,
                          display: 'flex',
                          justifyContent: 'flex-end',
                        }}
                      >
                        {canUseQr && (
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={!row.student.is_active || status !== 'studying'}
                            onClick={() => setQrRow(row)}
                            aria-label={`ดู QR ของ ${name}`}
                            sx={{ bgcolor: 'primary.lighter' }}
                          >
                            <RemixIcon icon="solar:user-id-bold" width={18} />
                          </IconButton>
                        )}
                        {canSendLine && (
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => setLineMessageRow(row)}
                            aria-label={`ส่งข้อความ LINE ถึงผู้ปกครองของ ${name}`}
                            sx={{ bgcolor: 'success.lighter' }}
                          >
                            <RemixIcon icon="solar:chat-round-dots-bold" width={18} />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          color="inherit"
                          onClick={() => openEdit(row)}
                          aria-label={`แก้ไขเลขที่ของ ${name}`}
                          sx={{ bgcolor: 'background.neutral' }}
                        >
                          <RemixIcon icon="solar:pen-bold" width={18} />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            deleteMutation.reset();
                            setDeletingRow(row);
                          }}
                          aria-label={`นำ ${name} ออกจากชั้น`}
                          sx={{ bgcolor: 'error.lighter' }}
                        >
                          <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
                        </IconButton>
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              <TableContainer sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Table sx={{ minWidth: 900 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>นักเรียน</TableCell>
                      <TableCell>รหัสนักเรียน</TableCell>
                      <TableCell>ชื่อผู้ใช้งาน</TableCell>
                      <TableCell>เลขที่</TableCell>
                      <TableCell>สถานะ</TableCell>
                      <TableCell align="right">จัดการ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={6}>กำลังโหลด...</TableCell>
                      </TableRow>
                    )}
                    {!isLoading && !filteredRoster.length && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                        >
                          ยังไม่มีนักเรียนในชั้นนี้
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredRoster.map((row) => {
                      const name =
                        `${row.student.first_name ?? ''} ${row.student.last_name ?? ''}`.trim() ||
                        row.student.username;
                      const status = row.student.student_status ?? 'studying';
                      return (
                        <TableRow key={row.id} hover>
                          <TableCell>
                            <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
                              <Avatar src={row.student.avatar_url ?? undefined}>
                                {name.charAt(0).toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2">{name}</Typography>
                                {row.student.nickname && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    ชื่อเล่น {row.student.nickname}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>{row.student.student_code ?? '-'}</TableCell>
                          <TableCell>@{row.student.username}</TableCell>
                          <TableCell>{row.student_number ?? '-'}</TableCell>
                          <TableCell>
                            <Label
                              variant="soft"
                              color={status === 'studying' ? 'success' : 'warning'}
                            >
                              {STATUS_LABEL[status]}
                            </Label>
                          </TableCell>
                          <TableCell align="right">
                            {canUseQr && (
                              <IconButton
                                size="small"
                                color="primary"
                                disabled={!row.student.is_active || status !== 'studying'}
                                onClick={() => setQrRow(row)}
                                aria-label={`ดู QR ของ ${name}`}
                              >
                                <RemixIcon icon="solar:user-id-bold" width={18} />
                              </IconButton>
                            )}
                            {canSendLine && (
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => setLineMessageRow(row)}
                                aria-label={`ส่งข้อความ LINE ถึงผู้ปกครองของ ${name}`}
                              >
                                <RemixIcon icon="solar:chat-round-dots-bold" width={18} />
                              </IconButton>
                            )}
                            <IconButton
                              size="small"
                              onClick={() => openEdit(row)}
                              aria-label={`แก้ไขเลขที่ของ ${name}`}
                            >
                              <RemixIcon icon="solar:pen-bold" width={18} />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                deleteMutation.reset();
                                setDeletingRow(row);
                              }}
                              aria-label={`นำ ${name} ออกจากชั้น`}
                            >
                              <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}

          {section === 'attendance' && selectedClassroom && (
            <HomeroomAttendanceSection
              key={selectedClassroom.id}
              classroomId={selectedClassroom.id}
              classroomName={selectedClassroom.name}
            />
          )}
        </>
      )}

      {qrRow && (
        <StudentQrDialog
          open
          student={qrRow.student}
          classroomName={selectedClassroom?.name}
          academicYear={selectedClassroom?.academic_years?.year}
          onClose={() => setQrRow(null)}
        />
      )}

      {lineMessageRow && (
        <GuardianLineMessageDialog
          studentId={lineMessageRow.student.id}
          studentName={
            `${lineMessageRow.student.first_name ?? ''} ${lineMessageRow.student.last_name ?? ''}`.trim() ||
            lineMessageRow.student.username
          }
          onClose={() => setLineMessageRow(null)}
        />
      )}

      <Dialog
        open={addDialogOpen}
        onClose={() => !addMutation.isPending && setAddDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>เพิ่มนักเรียนเข้า {selectedClassroom?.name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {addMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {addMutation.error.message}
            </Alert>
          )}
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={availableStudents}
            value={selectedStudents}
            loading={studentsLoading}
            getOptionLabel={(option) =>
              `${option.first_name ?? ''} ${option.last_name ?? ''}`.trim() || option.username
            }
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, value) => setSelectedStudents(value)}
            noOptionsText="ไม่พบนักเรียนที่สามารถเพิ่มได้"
            renderInput={(params) => (
              <TextField
                {...params}
                label="นักเรียน"
                placeholder={selectedStudents.length ? '' : 'เลือกนักเรียนหลายคน'}
                helperText={`เลือกแล้ว ${selectedStudents.length} คน`}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            disabled={addMutation.isPending}
            onClick={() => setAddDialogOpen(false)}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            disabled={!selectedStudents.length}
            loading={addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            เพิ่ม {selectedStudents.length} คน
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!editingRow}
        onClose={() => !updateMutation.isPending && setEditingRow(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>แก้ไขเลขที่</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {updateMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {updateMutation.error.message}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            label="เลขที่"
            value={studentNumber}
            onChange={(event) => setStudentNumber(event.target.value)}
            error={!!studentNumber && !/^\d+$/.test(studentNumber)}
            helperText="กรอกตัวเลข หรือเว้นว่างหากยังไม่กำหนด"
            slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            disabled={updateMutation.isPending}
            onClick={() => setEditingRow(null)}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            loading={updateMutation.isPending}
            disabled={!!studentNumber && !/^\d+$/.test(studentNumber)}
            onClick={() => updateMutation.mutate()}
          >
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!deletingRow}
        onClose={() => !deleteMutation.isPending && setDeletingRow(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>นำนักเรียนออกจากชั้น</DialogTitle>
        <DialogContent>
          {deleteMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteMutation.error.message}
            </Alert>
          )}
          <Typography>
            ยืนยันนำนักเรียนออกจาก {selectedClassroom?.name} การดำเนินการนี้จะลบการลงทะเบียนในชั้น
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            disabled={deleteMutation.isPending}
            onClick={() => setDeletingRow(null)}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={deleteMutation.isPending}
            onClick={() => deletingRow && deleteMutation.mutate(deletingRow.id)}
          >
            นำออกจากชั้น
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
