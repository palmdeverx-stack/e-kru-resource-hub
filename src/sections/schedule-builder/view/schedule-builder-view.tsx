'use client';

import type { ClassroomScheduleSlot, ClassroomScheduleAssignment } from '../schedule-builder-actions';

import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { RemixIcon } from 'src/components/remix-icon';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import { listUsers } from 'src/sections/user/user-actions';
import { listSubjects } from 'src/sections/subject/subject-actions';
import { listClassrooms } from 'src/sections/classroom/classroom-actions';
import { listSemesters, listAcademicYears } from 'src/sections/academic-year/academic-year-actions';
import {
  createTeacherAssignment,
  deleteTeacherAssignment,
} from 'src/sections/teacher-assignment/teacher-assignment-actions';

import { useAuthContext } from 'src/auth/hooks';

import { ScheduleGrid } from '../components/schedule-grid';
import { listSchedulePeriods } from '../schedule-period-actions';
import { AssignmentFormDialog } from '../components/assignment-form-dialog';
import { SchedulePeriodsDialog } from '../components/schedule-periods-dialog';
import { ScheduleSlotFormDialog } from '../components/schedule-slot-form-dialog';
import { getScheduleMode, updateScheduleMode } from '../schedule-settings-actions';
import {
  addScheduleSlot,
  deleteScheduleSlot,
  updateScheduleSlot,
  getScheduleApproval,
  getClassroomSchedule,
  cancelScheduleSubmission,
} from '../schedule-builder-actions';

// ----------------------------------------------------------------------

export function ScheduleBuilderView() {
  const router = useRouter();
  const classroomTable = useTable({ defaultRowsPerPage: 10 });
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const [academicYearId, setAcademicYearId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [classroomSearch, setClassroomSearch] = useState('');
  const [periodsDialogOpen, setPeriodsDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ClassroomScheduleSlot | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<ClassroomScheduleSlot | null>(null);
  const [addAssignmentDialogOpen, setAddAssignmentDialogOpen] = useState(false);
  const [deletingAssignment, setDeletingAssignment] =
    useState<ClassroomScheduleAssignment | null>(null);

  const academicYearsQuery = useQuery({
    queryKey: ['schedule-builder-academic-years'],
    queryFn: listAcademicYears,
  });

  useEffect(() => {
    if (academicYearId || !academicYearsQuery.data?.length) return;
    const active = academicYearsQuery.data.find((year) => year.is_active);
    setAcademicYearId((active ?? academicYearsQuery.data[0]).id);
  }, [academicYearId, academicYearsQuery.data]);

  const semestersQuery = useQuery({
    queryKey: ['schedule-builder-semesters', academicYearId],
    queryFn: () => listSemesters(academicYearId),
    enabled: !!academicYearId,
  });

  useEffect(() => {
    setSemesterId('');
  }, [academicYearId]);

  useEffect(() => {
    if (semesterId || !semestersQuery.data?.length) return;
    const active = semestersQuery.data.find((semester) => semester.is_active);
    setSemesterId((active ?? semestersQuery.data[0]).id);
  }, [semesterId, semestersQuery.data]);

  const classroomsQuery = useQuery({
    queryKey: ['schedule-builder-classrooms', academicYearId],
    queryFn: () => listClassrooms({ academicYearId }),
    enabled: !!academicYearId,
  });

  const scheduleModeQuery = useQuery({
    queryKey: ['schedule-mode'],
    queryFn: getScheduleMode,
  });

  const scheduleModeMutation = useMutation({
    mutationFn: updateScheduleMode,
    onSuccess: async (nextMode) => {
      queryClient.setQueryData(['schedule-mode'], nextMode);
      await queryClient.invalidateQueries({ queryKey: ['classroom-schedule'] });
    },
  });

  const periodsQuery = useQuery({
    queryKey: ['schedule-periods', semesterId],
    queryFn: () => listSchedulePeriods(semesterId),
    enabled: !!semesterId,
  });

  useEffect(() => {
    setClassroomId('');
  }, [academicYearId]);

  const scheduleQuery = useQuery({
    queryKey: ['classroom-schedule', classroomId, semesterId],
    queryFn: () => getClassroomSchedule(classroomId, semesterId),
    enabled: !!classroomId && !!semesterId,
  });

  const approvalQuery = useQuery({
    queryKey: ['classroom-schedule-approval', classroomId, semesterId],
    queryFn: () => getScheduleApproval(classroomId, semesterId),
    enabled: !!classroomId && !!semesterId,
  });

  const cancelSubmitMutation = useMutation({
    mutationFn: () => cancelScheduleSubmission(classroomId, semesterId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['classroom-schedule-approval', classroomId, semesterId],
      });
    },
  });

  const addMutation = useMutation({
    mutationFn: addScheduleSlot,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['classroom-schedule', classroomId, semesterId],
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (params: {
      teacherAssignmentId: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      locationName: string;
      schedulePeriodId: string;
    }) => {
      if (!editingSlot) return;
      if (params.teacherAssignmentId === editingSlot.teacher_assignment_id) {
        await updateScheduleSlot(editingSlot.teacher_assignment_id, editingSlot.id, {
          dayOfWeek: params.dayOfWeek,
          startTime: params.startTime,
          endTime: params.endTime,
          locationName: params.locationName,
          schedulePeriodId: params.schedulePeriodId,
        });
      } else {
        // Moving to a different subject/teacher means moving to a different
        // teacher_assignment's schedule list — delete under the old one, add
        // under the new one.
        await deleteScheduleSlot(editingSlot.teacher_assignment_id, editingSlot.id);
        await addScheduleSlot(params);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['classroom-schedule', classroomId, semesterId],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (slot: ClassroomScheduleSlot) =>
      deleteScheduleSlot(slot.teacher_assignment_id, slot.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['classroom-schedule', classroomId, semesterId],
      });
      setDeletingSlot(null);
    },
  });

  const subjectsQuery = useQuery({
    queryKey: ['schedule-builder-subjects', semesterId],
    queryFn: () => listSubjects({ semesterId }),
    enabled: !!semesterId,
  });

  const teachersQuery = useQuery({
    queryKey: ['schedule-builder-teachers'],
    queryFn: () => listUsers('teacher'),
    enabled: !!classroomId,
  });

  const addAssignmentMutation = useMutation({
    mutationFn: (params: { subjectId: string; teacherId: string }) =>
      createTeacherAssignment({ ...params, classroomId, semesterId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['classroom-schedule', classroomId, semesterId],
      });
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: (assignment: ClassroomScheduleAssignment) =>
      deleteTeacherAssignment(assignment.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['classroom-schedule', classroomId, semesterId],
      });
      setDeletingAssignment(null);
    },
  });

  const filteredClassrooms = useMemo(() => {
    const keyword = classroomSearch.trim().toLocaleLowerCase('th');
    if (!keyword) return classroomsQuery.data ?? [];

    return (classroomsQuery.data ?? []).filter((classroom) => {
      const homeroomNames = classroom.homeroom_teachers
        .map((teacher) => `${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`.trim())
        .filter(Boolean)
        .join(' ');
      return [classroom.grade_level, classroom.name, homeroomNames]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword);
    });
  }, [classroomSearch, classroomsQuery.data]);

  const visibleClassrooms = useMemo(
    () => rowInPage(filteredClassrooms, classroomTable.page, classroomTable.rowsPerPage),
    [classroomTable.page, classroomTable.rowsPerPage, filteredClassrooms]
  );
  const scheduleMode = scheduleModeQuery.data ?? 'hour';

  const schedules = useMemo(() => scheduleQuery.data?.schedules ?? [], [scheduleQuery.data]);
  const assignments = useMemo(() => scheduleQuery.data?.assignments ?? [], [scheduleQuery.data]);

  const wasApprovedButModified =
    approvalQuery.data?.status === 'draft' && !!approvalQuery.data.approved_at;
  const isAwaitingDirector =
    approvalQuery.data?.status === 'submitted' &&
    !!approvalQuery.data.submitter_signature_url;

  const approvalStatusChip = (() => {
    if (approvalQuery.data?.status === 'approved') {
      return <Chip size="small" color="success" label="ผอ. ยืนยันแล้ว" />;
    }
    if (approvalQuery.data?.status === 'submitted') {
      return (
        <Chip
          size="small"
          color="warning"
          label={isAwaitingDirector ? 'รอ ผอ. ยืนยัน' : 'รอผู้จัดทำลงนาม'}
        />
      );
    }
    if (approvalQuery.data?.status === 'canceled') {
      return <Chip size="small" color="default" label="ยกเลิกการส่งแล้ว" />;
    }
    if (wasApprovedButModified) {
      return (
        <Chip size="small" color="error" label="ยืนยันแล้ว แต่มีการแก้ไข ต้องส่งยืนยันใหม่" />
      );
    }
    return null;
  })();

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Box sx={{ mb: 4 }}>
        <Typography component="h1" variant="h3">
          จัดตารางสอน
        </Typography>
        <Typography sx={{ mt: 1, color: 'text.secondary' }}>
          จัดคาบสอนของครูทุกคนในโรงเรียน โดยเลือกดูทีละห้องเรียน
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Box
          sx={{
            mb: 2.5,
            gap: 2,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="subtitle1">รูปแบบตารางเรียนทั้งระบบ</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {scheduleMode === 'period'
                ? 'แสดงและจัดตารางตามหมายเลขคาบที่โรงเรียนกำหนด'
                : 'แสดงและจัดตารางตามเวลาเริ่ม–สิ้นสุดแบบอิสระ'}
            </Typography>
          </Box>
          {user?.role === 'school_admin' ? (
            <FormControlLabel
              label={scheduleMode === 'period' ? 'แบบคาบ' : 'แบบชั่วโมง'}
              control={
                <Switch
                  checked={scheduleMode === 'period'}
                  disabled={scheduleModeQuery.isLoading || scheduleModeMutation.isPending}
                  onChange={(event) =>
                    scheduleModeMutation.mutate(event.target.checked ? 'period' : 'hour')
                  }
                />
              }
            />
          ) : (
            <Chip
              size="small"
              color={scheduleMode === 'period' ? 'primary' : 'default'}
              label={scheduleMode === 'period' ? 'แบบคาบ' : 'แบบชั่วโมง'}
            />
          )}
        </Box>

        {scheduleModeMutation.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {scheduleModeMutation.error.message}
          </Alert>
        )}

        <Box
          sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}
        >
          <TextField
            select
            label="ปีการศึกษา"
            value={academicYearId}
            onChange={(event) => {
              setAcademicYearId(event.target.value);
              classroomTable.onResetPage();
            }}
            disabled={academicYearsQuery.isLoading}
          >
            {(academicYearsQuery.data ?? []).map((year) => (
              <MenuItem key={year.id} value={year.id}>
                {year.year}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="ภาคเรียน"
            value={semesterId}
            onChange={(event) => {
              setSemesterId(event.target.value);
              classroomTable.onResetPage();
            }}
            disabled={!academicYearId || semestersQuery.isLoading}
          >
            {(semestersQuery.data ?? []).map((semester) => (
              <MenuItem key={semester.id} value={semester.id}>
                {semester.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        {user?.role === 'school_admin' && semesterId && scheduleMode === 'period' && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={<RemixIcon icon="solar:clock-circle-bold" />}
              onClick={() => setPeriodsDialogOpen(true)}
            >
              ตั้งค่าคาบเรียนและเวลา
            </Button>
          </Box>
        )}
      </Card>

      {scheduleMode === 'period' &&
        semesterId &&
        !periodsQuery.isLoading &&
        !periodsQuery.data?.length && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            เปิดใช้งานแบบคาบแล้ว แต่ภาคเรียนนี้ยังไม่มีโครงสร้างคาบ{' '}
            {user?.role === 'school_admin'
              ? 'กรุณากด “ตั้งค่าคาบเรียนและเวลา”'
              : 'กรุณาติดต่อผู้ดูแลโรงเรียนเพื่อตั้งค่าคาบเรียน'}
          </Alert>
        )}

      {!classroomId ? (
        !academicYearId || !semesterId ? (
          <Alert severity="info" icon={<RemixIcon icon="solar:calendar-date-bold" />}>
            เลือกปีการศึกษาและภาคเรียน เพื่อดูรายการห้องเรียน
          </Alert>
        ) : classroomsQuery.isLoading ? (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : classroomsQuery.isError ? (
          <Alert severity="error">ไม่สามารถโหลดรายการห้องเรียนได้</Alert>
        ) : !classroomsQuery.data?.length ? (
          <Alert severity="warning">ยังไม่มีห้องเรียนในปีการศึกษานี้</Alert>
        ) : (
          <Card variant="outlined">
            <Box
              sx={{
                p: 2.5,
                gap: 2,
                display: 'flex',
                alignItems: { xs: 'stretch', sm: 'center' },
                flexDirection: { xs: 'column', sm: 'row' },
                borderBottom: '1px solid',
                borderColor: 'divider',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography variant="h6">เลือกห้องเรียน</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {filteredClassrooms.length} ห้องเรียน
                </Typography>
              </Box>
              <TextField
                size="small"
                value={classroomSearch}
                onChange={(event) => {
                  setClassroomSearch(event.target.value);
                  classroomTable.onResetPage();
                }}
                placeholder="ค้นหาชั้น ห้อง หรือครูประจำชั้น"
                aria-label="ค้นหาห้องเรียนสำหรับจัดตารางสอน"
                sx={{ width: { xs: 1, sm: 360 } }}
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

            <TableContainer>
              <Table sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>ระดับชั้น</TableCell>
                    <TableCell>ห้องเรียน</TableCell>
                    <TableCell>ครูประจำชั้น</TableCell>
                    <TableCell align="right">จัดการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!filteredClassrooms.length && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                      >
                        ไม่พบห้องเรียนที่ตรงกับคำค้นหา
                      </TableCell>
                    </TableRow>
                  )}
                  {visibleClassrooms.map((classroom) => {
                    const homeroomNames = classroom.homeroom_teachers
                      .map(
                        (teacher) =>
                          `${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`.trim()
                      )
                      .filter(Boolean)
                      .join(', ');
                    return (
                      <TableRow key={classroom.id} hover>
                        <TableCell>{classroom.grade_level ?? 'ไม่ระบุชั้น'}</TableCell>
                        <TableCell>
                          <Typography variant="subtitle2">{classroom.name}</Typography>
                        </TableCell>
                        <TableCell>{homeroomNames || 'ยังไม่กำหนดครูประจำชั้น'}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<RemixIcon icon="solar:calendar-bold" />}
                            onClick={() => setClassroomId(classroom.id)}
                          >
                            จัดตารางสอน
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePaginationCustom
              page={classroomTable.page}
              count={filteredClassrooms.length}
              rowsPerPage={classroomTable.rowsPerPage}
              rowsPerPageOptions={[10, 25, 50]}
              onPageChange={classroomTable.onChangePage}
              onRowsPerPageChange={classroomTable.onChangeRowsPerPage}
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
        )
      ) : scheduleQuery.isLoading ? (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : scheduleQuery.isError ? (
        <Alert severity="error">ไม่สามารถโหลดตารางสอนของห้องนี้ได้</Alert>
      ) : (
        <>
          <Button
            color="inherit"
            onClick={() => setClassroomId('')}
            startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
            sx={{ mb: 2 }}
          >
            กลับไปเลือกห้องเรียน
          </Button>

          <Box
            sx={{
              mb: 2,
              gap: 1.5,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
              <Typography variant="h6">
                {scheduleQuery.data?.classroom.grade_level} {scheduleQuery.data?.classroom.name}
              </Typography>
              {approvalStatusChip}
            </Box>
            <Box sx={{ gap: 1, display: 'flex' }}>
              {approvalQuery.data?.status !== 'approved' && (
                <Button
                  variant="outlined"
                  color="warning"
                  disabled={!schedules.length || isAwaitingDirector}
                  startIcon={<RemixIcon icon="solar:send-bold" />}
                  onClick={() =>
                    router.push(
                      user?.role === 'teacher'
                        ? paths.teacher.scheduleSubmission(classroomId, semesterId)
                        : paths.admin.scheduleSubmission(classroomId, semesterId)
                    )
                  }
                >
                  {approvalQuery.data?.status === 'submitted'
                    ? isAwaitingDirector
                      ? 'ส่งไปแล้ว รอ ผอ. ยืนยัน'
                      : 'ลงนามผู้จัดทำ'
                    : approvalQuery.data?.status === 'canceled'
                      ? 'ลงนามส่งอีกครั้ง'
                    : wasApprovedButModified
                      ? 'ตรวจสอบและลงนามใหม่'
                      : 'ตรวจสอบและลงนามส่ง'}
                </Button>
              )}
              {approvalQuery.data?.status === 'submitted' && (
                <Button
                  variant="outlined"
                  color="inherit"
                  loading={cancelSubmitMutation.isPending}
                  startIcon={<RemixIcon icon="solar:close-circle-bold" />}
                  onClick={() => cancelSubmitMutation.mutate()}
                >
                  ยกเลิกการส่ง
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<RemixIcon icon="mingcute:add-line" />}
                onClick={() => setAddDialogOpen(true)}
                disabled={!assignments.length}
              >
                เพิ่มคาบสอน
              </Button>
            </Box>
          </Box>

          {cancelSubmitMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {cancelSubmitMutation.error.message}
            </Alert>
          )}

          <Card variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Box
              sx={{
                mb: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="subtitle1">วิชาที่สอนในห้องนี้</Typography>
              <Button
                size="small"
                startIcon={<RemixIcon icon="mingcute:add-line" />}
                onClick={() => setAddAssignmentDialogOpen(true)}
              >
                เพิ่มวิชาที่สอน
              </Button>
            </Box>

            {!assignments.length ? (
              <Alert severity="warning">
                ห้องนี้ยังไม่มีครูประจำวิชาในภาคเรียนนี้ — กด “เพิ่มวิชาที่สอน” เพื่อกำหนดครูผู้สอน
              </Alert>
            ) : (
              <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap' }}>
                {assignments.map((assignment) => {
                  const teacherName = `${assignment.teacher?.first_name ?? ''} ${assignment.teacher?.last_name ?? ''}`.trim();
                  return (
                    <Chip
                      key={assignment.id}
                      variant="soft"
                      label={`${assignment.subject?.name ?? 'ไม่ระบุวิชา'} · ครู${teacherName || '-'}`}
                      onDelete={() => setDeletingAssignment(assignment)}
                      deleteIcon={
                        <Tooltip title="ลบวิชานี้ออกจากห้อง">
                          <RemixIcon icon="solar:trash-bin-trash-bold" width={16} />
                        </Tooltip>
                      }
                    />
                  );
                })}
              </Box>
            )}
          </Card>

          <ScheduleGrid
            schedules={schedules}
            assignments={assignments}
            periods={periodsQuery.data ?? []}
            scheduleMode={scheduleMode}
            onSlotClick={(slot) => setEditingSlot(slot)}
          />
        </>
      )}

      <ScheduleSlotFormDialog
        key={editingSlot?.id ?? 'new'}
        open={addDialogOpen || !!editingSlot}
        assignments={assignments}
        periods={scheduleMode === 'period' ? periodsQuery.data ?? [] : []}
        editingSlot={editingSlot}
        onClose={() => {
          setAddDialogOpen(false);
          setEditingSlot(null);
        }}
        onSubmit={(params) =>
          editingSlot
            ? editMutation.mutateAsync(params).then(() => {})
            : addMutation.mutateAsync(params).then(() => {})
        }
        onDelete={(slot) => {
          setEditingSlot(null);
          deleteMutation.reset();
          setDeletingSlot(slot);
        }}
      />

      <SchedulePeriodsDialog
        key={`${semesterId}-${periodsQuery.data?.length ?? 0}`}
        open={periodsDialogOpen}
        semesterId={semesterId}
        periods={periodsQuery.data ?? []}
        onClose={() => setPeriodsDialogOpen(false)}
        onChanged={async () => {
          await periodsQuery.refetch();
        }}
      />

      <AssignmentFormDialog
        open={addAssignmentDialogOpen}
        subjects={subjectsQuery.data ?? []}
        teachers={teachersQuery.data ?? []}
        onClose={() => setAddAssignmentDialogOpen(false)}
        onSubmit={(params) => addAssignmentMutation.mutateAsync(params).then(() => {})}
      />

      <Dialog
        open={!!deletingAssignment}
        onClose={() => !removeAssignmentMutation.isPending && setDeletingAssignment(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการลบวิชาที่สอน</DialogTitle>
        <DialogContent>
          {removeAssignmentMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {removeAssignmentMutation.error.message}
            </Alert>
          )}
          <Typography variant="body2">
            ต้องการลบวิชานี้ออกจากห้องเรียนใช่หรือไม่? คาบสอนที่จัดไว้ของวิชานี้จะถูกลบไปด้วย
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => setDeletingAssignment(null)}
            disabled={removeAssignmentMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={removeAssignmentMutation.isPending}
            onClick={() => deletingAssignment && removeAssignmentMutation.mutate(deletingAssignment)}
          >
            ลบวิชานี้
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!deletingSlot}
        onClose={() => !deleteMutation.isPending && setDeletingSlot(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการลบคาบสอน</DialogTitle>
        <DialogContent>
          {deleteMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteMutation.error.message}
            </Alert>
          )}
          <Typography variant="body2">ต้องการลบคาบสอนนี้ออกจากตารางใช่หรือไม่?</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => setDeletingSlot(null)}
            disabled={deleteMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={deleteMutation.isPending}
            onClick={() => deletingSlot && deleteMutation.mutate(deletingSlot)}
          >
            ลบคาบสอน
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
