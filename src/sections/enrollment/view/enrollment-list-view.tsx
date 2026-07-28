'use client';

import type { Enrollment } from '../enrollment-actions';
import type { StudentStatus } from 'src/sections/user/user-actions';
import type { EnrollmentFormValues } from '../components/enrollment-form-dialog';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
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
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import { listClassrooms } from 'src/sections/classroom/classroom-actions';
import { listUsers, updateStudentStatus } from 'src/sections/user/user-actions';

import { useAuthContext } from 'src/auth/hooks';

import { BulkPromoteDialog } from '../components/bulk-promote-dialog';
import { EnrollmentFormDialog } from '../components/enrollment-form-dialog';
import { StudentProgressDialog } from '../components/student-progress-dialog';
import { DeleteEnrollmentDialog } from '../components/delete-enrollment-dialog';
import {
  listEnrollments,
  updateEnrollment,
  deleteEnrollment,
  createEnrollments,
} from '../enrollment-actions';

// ----------------------------------------------------------------------

const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  studying: 'กำลังศึกษา',
  graduated: 'สำเร็จการศึกษา',
  transferred: 'ย้ายโรงเรียน',
  withdrawn: 'ลาออก',
  dismissed: 'พ้นสภาพ',
};

const STUDENT_STATUS_COLOR: Record<StudentStatus, 'success' | 'info' | 'warning' | 'error'> = {
  studying: 'success',
  graduated: 'info',
  transferred: 'warning',
  withdrawn: 'warning',
  dismissed: 'error',
};

type Props = {
  initialClassroomId?: string;
  classroomMode?: boolean;
};

export function EnrollmentListView({ initialClassroomId, classroomMode = false }: Props = {}) {
  const { user } = useAuthContext();
  const isTeacher = user?.role === 'teacher';
  const router = useRouter();
  const table = useTable({ defaultRowsPerPage: 10 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [progressEnrollmentId, setProgressEnrollmentId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classroomFilter, setClassroomFilter] = useState(initialClassroomId ?? 'all');
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [deletingEnrollment, setDeletingEnrollment] = useState<Enrollment | null>(null);
  const [dialogClassroomId, setDialogClassroomId] = useState('');
  const queryClient = useQueryClient();

  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['enrollments', classroomMode ? { classroomId: initialClassroomId } : 'all'],
    queryFn: () =>
      listEnrollments(
        classroomMode && initialClassroomId ? { classroomId: initialClassroomId } : undefined
      ),
  });
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['users', 'student'],
    queryFn: () => listUsers('student'),
  });
  const { data: classrooms = [], isLoading: classroomsLoading } = useQuery({
    queryKey: ['classrooms'],
    queryFn: () => listClassrooms(),
  });

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');

    return rows.filter((row) => {
      const name = `${row.student.first_name ?? ''} ${row.student.last_name ?? ''}`;
      const matchesSearch =
        !keyword ||
        [name, row.student.username, row.classroom.name, row.student_number]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('th')
          .includes(keyword);
      const matchesClassroom = classroomFilter === 'all' || row.classroom.id === classroomFilter;

      return matchesSearch && matchesClassroom;
    });
  }, [classroomFilter, rows, search]);

  const visibleRows = rowInPage(filteredRows, table.page, table.rowsPerPage);

  const summary = useMemo(
    () => ({
      enrollments: rows.length,
      students: new Set(rows.map((row) => row.student.id)).size,
      classrooms: new Set(rows.map((row) => row.classroom.id)).size,
    }),
    [rows]
  );
  const selectedFilterClassroom =
    classrooms.find((classroom) => classroom.id === classroomFilter) ?? null;
  const { data: academicYearEnrollments = [] } = useQuery({
    queryKey: [
      'enrollments',
      { academicYearId: selectedFilterClassroom?.academic_year_id ?? null },
    ],
    queryFn: () => listEnrollments({ academicYearId: selectedFilterClassroom!.academic_year_id }),
    enabled: classroomMode && !!selectedFilterClassroom?.academic_year_id,
  });

  const createMutation = useMutation({
    mutationFn: createEnrollments,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      setDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      classroomId: nextClassroomId,
      studentNumber,
    }: {
      id: string;
      classroomId: string;
      studentNumber?: string;
    }) => updateEnrollment(id, { classroomId: nextClassroomId, studentNumber }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      setDialogOpen(false);
      setEditingEnrollment(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEnrollment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      setDeletingEnrollment(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ studentId: id, status }: { studentId: string; status: StudentStatus }) =>
      updateStudentStatus(id, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['enrollments'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ]);
    },
  });

  const closeDialog = () => {
    if (createMutation.isPending || updateMutation.isPending) return;
    setDialogOpen(false);
    setEditingEnrollment(null);
    createMutation.reset();
    updateMutation.reset();
  };

  const onSubmit = (data: EnrollmentFormValues) => {
    if (editingEnrollment) {
      updateMutation.mutate({
        id: editingEnrollment.id,
        classroomId: data.classroomId,
        studentNumber: data.studentNumber.trim() || undefined,
      });
      return;
    }

    createMutation.mutate({
      studentIds: data.studentIds,
      classroomId: data.classroomId,
    });
  };

  const openEditDialog = (enrollment: Enrollment) => {
    createMutation.reset();
    updateMutation.reset();
    setEditingEnrollment(enrollment);
    setDialogClassroomId(enrollment.classroom.id);
    setDialogOpen(true);
  };

  const openCreateDialog = (targetClassroomId?: string) => {
    setDialogClassroomId(targetClassroomId ?? (classroomFilter !== 'all' ? classroomFilter : ''));
    createMutation.reset();
    setEditingEnrollment(null);
    setDialogOpen(true);
  };

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Box
        sx={{
          mb: 4,
          gap: 2,
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
        }}
      >
        <Box>
          {classroomMode && (
            <Button
              color="inherit"
              size="small"
              onClick={() =>
                router.push(
                  isTeacher ? paths.teacher.departmentEnrollment.root : paths.admin.enrollment.root
                )
              }
              startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
              sx={{ mb: 1.25, color: 'text.secondary' }}
            >
              กลับไปเลือกชั้นเรียน
            </Button>
          )}
          <Typography component="h1" variant="h3">
            {classroomMode
              ? selectedFilterClassroom?.name
                ? `รายชื่อนักเรียน · ${selectedFilterClassroom.name}`
                : 'รายชื่อนักเรียนประจำชั้น'
              : 'ลงทะเบียนนักเรียน'}
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            {classroomMode
              ? selectedFilterClassroom?.academic_years?.year
                ? `ปีการศึกษา ${selectedFilterClassroom.academic_years.year} · จัดการรายชื่อและเพิ่มนักเรียนเข้าชั้นนี้`
                : 'จัดการรายชื่อและเพิ่มนักเรียนเข้าชั้นนี้'
              : 'เลือกชั้นเรียนเพื่อดูและจัดการรายชื่อนักเรียน'}
          </Typography>
        </Box>
        <Box sx={{ gap: 1.5, display: 'flex' }}>
          {!classroomMode && (
            <Button
              variant="outlined"
              onClick={() => setPromoteDialogOpen(true)}
              startIcon={<RemixIcon icon="solar:double-alt-arrow-up-bold-duotone" />}
            >
              เลื่อนชั้นยกชุด
            </Button>
          )}
          <Button
            variant="contained"
            onClick={() => openCreateDialog()}
            disabled={classroomMode && !selectedFilterClassroom}
            startIcon={<RemixIcon icon="solar:user-plus-bold" />}
          >
            {selectedFilterClassroom
              ? `เพิ่มเข้า ${selectedFilterClassroom.name}`
              : 'เพิ่มนักเรียน'}
          </Button>
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
          ไม่สามารถโหลดรายการลงทะเบียนได้
        </Alert>
      )}
      {(statusMutation.error || deleteMutation.error) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {statusMutation.error?.message ?? deleteMutation.error?.message}
        </Alert>
      )}
      {classroomMode && initialClassroomId && !classroomsLoading && !selectedFilterClassroom && (
        <Alert severity="error" sx={{ mb: 3 }}>
          ไม่พบชั้นเรียนนี้ หรือชั้นเรียนไม่ได้อยู่ในโรงเรียนของคุณ
        </Alert>
      )}

      {!classroomMode && (
        <Box
          sx={{
            mb: 3,
            gap: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          }}
        >
          <SummaryCard
            icon="solar:user-plus-bold"
            label="การลงทะเบียนทั้งหมด"
            value={summary.enrollments}
            color="success.main"
            bgcolor="success.lighter"
          />
          <SummaryCard
            icon="solar:user-rounded-bold"
            label="นักเรียน"
            value={summary.students}
            color="primary.main"
            bgcolor="primary.lighter"
          />
          <SummaryCard
            icon="solar:users-group-rounded-bold"
            label="ห้องเรียน"
            value={summary.classrooms}
            color="warning.main"
            bgcolor="warning.lighter"
          />
        </Box>
      )}

      {!classroomMode && (
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              mb: 1.5,
              gap: 1,
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography component="h2" variant="h6">
                เลือกชั้นเรียน
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                คลิกชั้นเรียนเพื่อดูรายชื่อ แล้วกดเพิ่มนักเรียนเข้าชั้นนั้นได้ทันที
              </Typography>
            </Box>
            {selectedFilterClassroom && (
              <Button
                size="small"
                variant="contained"
                onClick={() => openCreateDialog(selectedFilterClassroom.id)}
                startIcon={<RemixIcon icon="solar:user-plus-bold" />}
              >
                เพิ่มเข้า {selectedFilterClassroom.name}
              </Button>
            )}
          </Box>

          <Box
            sx={{
              gap: 1.5,
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(4, minmax(0, 1fr))',
              },
            }}
          >
            <ClassroomFilterCard
              active={classroomFilter === 'all'}
              name="ทุกชั้นเรียน"
              detail={`${summary.classrooms} ห้องเรียน`}
              studentCount={rows.length}
              onClick={() => {
                setClassroomFilter('all');
                table.onResetPage();
              }}
            />
            {classrooms.map((classroom) => {
              const studentCount = rows.filter((row) => row.classroom.id === classroom.id).length;

              return (
                <ClassroomFilterCard
                  key={classroom.id}
                  active={classroomFilter === classroom.id}
                  name={classroom.name}
                  detail={
                    classroom.academic_years?.year
                      ? `ปีการศึกษา ${classroom.academic_years.year}`
                      : 'ยังไม่ระบุปีการศึกษา'
                  }
                  studentCount={studentCount}
                  onClick={() =>
                    router.push(
                      isTeacher
                        ? paths.teacher.departmentEnrollment.classroom(classroom.id)
                        : paths.admin.enrollment.classroom(classroom.id)
                    )
                  }
                />
              );
            })}
          </Box>
        </Box>
      )}

      <Card variant="outlined">
        <Box
          sx={{
            gap: 2,
            px: 3,
            py: 2.5,
            display: 'flex',
            alignItems: { xs: 'stretch', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            borderBottom: '1px solid',
            borderColor: 'divider',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography component="h2" variant="h6">
              {selectedFilterClassroom ? `รายชื่อนักเรียน` : 'รายชื่อนักเรียนทั้งหมด'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {isLoading ? 'กำลังโหลด...' : `พบ ${filteredRows.length} รายการ`}
            </Typography>
          </Box>
          <Box sx={{ gap: 1.5, display: 'flex', flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField
              size="small"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                table.onResetPage();
              }}
              placeholder="ค้นหานักเรียนหรือเลขที่"
              aria-label="ค้นหารายการลงทะเบียน"
              sx={{ width: { xs: 1, sm: 270 } }}
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
            {!classroomMode && (
              <TextField
                select
                size="small"
                label="ห้องเรียน"
                value={classroomFilter}
                onChange={(event) => {
                  setClassroomFilter(event.target.value);
                  table.onResetPage();
                }}
                sx={{ minWidth: { xs: 1, sm: 180 } }}
              >
                <MenuItem value="all">ทุกห้องเรียน</MenuItem>
                {classrooms.map((classroom) => (
                  <MenuItem key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Box>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>นักเรียน</TableCell>
                <TableCell>ชื่อผู้ใช้งาน</TableCell>
                <TableCell>ห้องเรียน</TableCell>
                <TableCell>เลขที่</TableCell>
                <TableCell width={180}>สถานะการเรียน</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6}>กำลังโหลด...</TableCell>
                </TableRow>
              )}
              {!isLoading && !filteredRows.length && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                  >
                    {rows.length ? 'ไม่พบรายการที่ตรงกับการค้นหา' : 'ยังไม่มีนักเรียนในห้อง'}
                  </TableCell>
                </TableRow>
              )}
              {visibleRows.map((row) => {
                const studentName =
                  `${row.student.first_name ?? ''} ${row.student.last_name ?? ''}`.trim() ||
                  row.student.username;

                return (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: 'primary.lighter',
                            color: 'primary.main',
                            typography: 'subtitle2',
                          }}
                        >
                          {studentName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="subtitle2">{studentName}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        @{row.student.username}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="soft"
                        color="primary"
                        label={row.classroom.name}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2">{row.student_number ?? '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        fullWidth
                        value={row.student.student_status ?? 'studying'}
                        disabled={
                          statusMutation.isPending &&
                          statusMutation.variables?.studentId === row.student.id
                        }
                        onChange={(event) =>
                          statusMutation.mutate({
                            studentId: row.student.id,
                            status: event.target.value as StudentStatus,
                          })
                        }
                        slotProps={{
                          select: {
                            renderValue: (value) => (
                              <Label
                                variant="soft"
                                color={STUDENT_STATUS_COLOR[value as StudentStatus]}
                              >
                                {STUDENT_STATUS_LABEL[value as StudentStatus]}
                              </Label>
                            ),
                          },
                        }}
                      >
                        {(Object.keys(STUDENT_STATUS_LABEL) as StudentStatus[]).map((status) => (
                          <MenuItem key={status} value={status}>
                            {STUDENT_STATUS_LABEL[status]}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ gap: 0.5, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setProgressEnrollmentId(row.id)}
                          startIcon={<RemixIcon icon="solar:list-bold" />}
                        >
                          ผลการเรียน
                        </Button>
                        <IconButton
                          size="small"
                          onClick={() => openEditDialog(row)}
                          aria-label={`แก้ไขการลงทะเบียนของ ${studentName}`}
                        >
                          <RemixIcon icon="solar:pen-bold" width={18} />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            deleteMutation.reset();
                            setDeletingEnrollment(row);
                          }}
                          aria-label={`ลบการลงทะเบียนของ ${studentName}`}
                        >
                          <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePaginationCustom
          page={table.page}
          count={filteredRows.length}
          rowsPerPage={table.rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          onPageChange={table.onChangePage}
          onRowsPerPageChange={table.onChangeRowsPerPage}
          labelRowsPerPage="แสดงต่อหน้า"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
          getItemAriaLabel={(type) => {
            if (type === 'first') return 'หน้าแรก';
            if (type === 'last') return 'หน้าสุดท้าย';
            if (type === 'next') return 'หน้าถัดไป';
            return 'หน้าก่อนหน้า';
          }}
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
      </Card>

      <EnrollmentFormDialog
        open={dialogOpen}
        enrollment={editingEnrollment}
        initialClassroomId={dialogClassroomId}
        lockClassroom={classroomMode}
        students={students}
        classrooms={classrooms}
        enrollments={classroomMode ? academicYearEnrollments : rows}
        studentsLoading={studentsLoading}
        classroomsLoading={classroomsLoading}
        pending={createMutation.isPending || updateMutation.isPending}
        error={createMutation.error ?? updateMutation.error}
        onClose={closeDialog}
        onSubmit={onSubmit}
      />

      <DeleteEnrollmentDialog
        enrollment={deletingEnrollment}
        pending={deleteMutation.isPending}
        error={deleteMutation.error}
        onClose={() => setDeletingEnrollment(null)}
        onConfirm={(id) => deleteMutation.mutate(id)}
      />

      <StudentProgressDialog
        enrollmentId={progressEnrollmentId}
        onClose={() => setProgressEnrollmentId(null)}
      />

      <BulkPromoteDialog
        open={promoteDialogOpen}
        onClose={() => setPromoteDialogOpen(false)}
        initialClassroomId={classroomFilter !== 'all' ? classroomFilter : undefined}
      />
    </Container>
  );
}

// ----------------------------------------------------------------------

// ----------------------------------------------------------------------

type ClassroomFilterCardProps = {
  active: boolean;
  name: string;
  detail: string;
  studentCount: number;
  onClick: () => void;
};

function ClassroomFilterCard({
  active,
  name,
  detail,
  studentCount,
  onClick,
}: ClassroomFilterCardProps) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={active}
      sx={{
        p: 2,
        gap: 1.5,
        minWidth: 0,
        display: 'flex',
        cursor: 'pointer',
        textAlign: 'left',
        borderRadius: 2,
        alignItems: 'center',
        font: 'inherit',
        color: 'text.primary',
        bgcolor: active ? 'primary.lighter' : 'background.paper',
        border: '1px solid',
        borderColor: active ? 'primary.main' : 'divider',
        boxShadow: active ? (theme) => `0 0 0 1px ${theme.palette.primary.main}` : 'none',
        transition: (theme) =>
          theme.transitions.create(['border-color', 'background-color', 'box-shadow']),
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: active ? 'primary.lighter' : 'action.hover',
        },
      }}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          flexShrink: 0,
          display: 'grid',
          borderRadius: 1.5,
          color: active ? 'common.white' : 'primary.main',
          placeItems: 'center',
          bgcolor: active ? 'primary.main' : 'primary.lighter',
        }}
      >
        <RemixIcon icon="solar:users-group-rounded-bold" width={23} />
      </Box>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="subtitle2" noWrap>
          {name}
        </Typography>
        <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary' }}>
          {detail}
        </Typography>
      </Box>
      <Label color={active ? 'primary' : 'default'} variant="soft">
        {studentCount} คน
      </Label>
    </Box>
  );
}

// ----------------------------------------------------------------------

type SummaryCardProps = {
  icon: 'solar:user-plus-bold' | 'solar:user-rounded-bold' | 'solar:users-group-rounded-bold';
  label: string;
  value: number;
  color: string;
  bgcolor: string;
};

function SummaryCard({ icon, label, value, color, bgcolor }: SummaryCardProps) {
  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            display: 'grid',
            borderRadius: 1.5,
            color,
            placeItems: 'center',
            bgcolor,
          }}
        >
          <RemixIcon icon={icon} width={25} />
        </Box>
        <Box>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {label}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}
