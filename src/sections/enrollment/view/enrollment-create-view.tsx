'use client';

import * as z from 'zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { Form } from 'src/components/hook-form';
import { RemixIcon } from 'src/components/remix-icon';

import { listUsers } from 'src/sections/user/user-actions';
import { listClassrooms } from 'src/sections/classroom/classroom-actions';
import { StudentFormDialog } from 'src/sections/user/components/student-form-dialog';

import { useAuthContext } from 'src/auth/hooks';

import { listEnrollments, createEnrollments } from '../enrollment-actions';

// ----------------------------------------------------------------------

export const EnrollmentCreateSchema = z.object({
  studentIds: z.array(z.string()).min(1, { error: 'กรุณาเลือกนักเรียนอย่างน้อย 1 คน!' }),
  classroomId: z.string().min(1, { error: 'กรุณาเลือกห้องเรียน!' }),
});

type EnrollmentCreateSchemaType = z.infer<typeof EnrollmentCreateSchema>;

// ----------------------------------------------------------------------

export function EnrollmentCreateView() {
  const router = useRouter();
  const { user } = useAuthContext();
  const isTeacher = user?.role === 'teacher';
  const backPath = isTeacher ? paths.teacher.assignments : paths.admin.enrollment.root;
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);

  const {
    data: students = [],
    isLoading: studentsLoading,
    isError: studentsError,
  } = useQuery({
    queryKey: ['users', 'student'],
    queryFn: () => listUsers('student'),
  });
  const {
    data: classrooms = [],
    isLoading: classroomsLoading,
    isError: classroomsError,
  } = useQuery({ queryKey: ['classrooms'], queryFn: () => listClassrooms() });

  const methods = useForm<EnrollmentCreateSchemaType>({
    resolver: zodResolver(EnrollmentCreateSchema),
    defaultValues: { studentIds: [], classroomId: '' },
  });

  const {
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = methods;
  const studentIds = useWatch({ control, name: 'studentIds' });
  const classroomId = useWatch({ control, name: 'classroomId' });

  const enrollableStudents = students.filter(
    (student) =>
      student.is_active !== false && (student.student_status ?? 'studying') === 'studying'
  );
  const selectedStudents = students.filter((student) => studentIds.includes(student.id));
  const selectedClassroom = classrooms.find((classroom) => classroom.id === classroomId) ?? null;

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => listEnrollments(),
  });
  const availableStudents = selectedClassroom
    ? enrollableStudents.filter(
        (student) =>
          !enrollments.some(
            (enrollment) =>
              enrollment.student.id === student.id &&
              enrollment.classroom.academic_year_id === selectedClassroom.academic_year_id
          )
      )
    : [];

  const createMutation = useMutation({
    mutationFn: createEnrollments,
    onSuccess: () => router.push(backPath),
  });

  const onSubmit = handleSubmit((data) => createMutation.mutate(data));

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
          <Button
            component={RouterLink}
            href={backPath}
            color="inherit"
            size="small"
            startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
            sx={{ mb: 1.5, color: 'text.secondary' }}
          >
            กลับไปหน้าชั้นเรียน
          </Button>
          <Typography component="h1" variant="h3" sx={{ mb: 1 }}>
            เพิ่มนักเรียนเข้าห้อง
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            เลือกห้องเรียนก่อน แล้วเลือกนักเรียนหลายคนเพื่อเพิ่มเข้าห้องพร้อมกัน
          </Typography>
        </Box>

        <Box
          sx={{
            width: 64,
            height: 64,
            flexShrink: 0,
            display: { xs: 'none', sm: 'grid' },
            borderRadius: 2.5,
            color: 'primary.main',
            placeItems: 'center',
            bgcolor: 'primary.lighter',
          }}
        >
          <RemixIcon icon="solar:user-plus-bold" width={34} />
        </Box>
      </Box>

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' },
        }}
      >
        <Card variant="outlined" sx={{ overflow: 'visible' }}>
          <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
            {createMutation.error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {createMutation.error.message}
              </Alert>
            )}

            {(studentsError || classroomsError) && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                โหลดรายชื่อนักเรียนหรือห้องเรียนไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่
              </Alert>
            )}

            <Form methods={methods} onSubmit={onSubmit}>
              <Box sx={{ gap: 4, display: 'flex', flexDirection: 'column' }}>
                <Box component="section" aria-labelledby="classroom-selection-title">
                  <SectionTitle
                    id="classroom-selection-title"
                    number="1"
                    title="เลือกห้องเรียน"
                    description="เลือกห้องและปีการศึกษาที่ต้องการเพิ่มนักเรียน"
                  />

                  <Autocomplete
                    fullWidth
                    options={classrooms}
                    value={selectedClassroom}
                    loading={classroomsLoading}
                    disabled={classroomsLoading || classroomsError}
                    getOptionLabel={(option) =>
                      option.academic_years?.year
                        ? `${option.name} · ปีการศึกษา ${option.academic_years.year}`
                        : option.name
                    }
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    onChange={(_, value) => {
                      setValue('classroomId', value?.id ?? '', {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      setValue('studentIds', [], {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    noOptionsText="ไม่พบห้องเรียน"
                    loadingText="กำลังโหลดห้องเรียน..."
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="ห้องเรียน *"
                        placeholder="ค้นหาห้องเรียน"
                        error={!!errors.classroomId}
                        helperText={
                          errors.classroomId?.message ?? 'ห้องที่ต้องการเพิ่มนักเรียนเข้าไป'
                        }
                      />
                    )}
                  />
                </Box>

                <Divider />

                <Box component="section" aria-labelledby="student-selection-title">
                  <Box
                    sx={{
                      gap: 2,
                      display: 'flex',
                      alignItems: { xs: 'stretch', sm: 'flex-start' },
                      flexDirection: { xs: 'column', sm: 'row' },
                      justifyContent: 'space-between',
                    }}
                  >
                    <SectionTitle
                      id="student-selection-title"
                      number="2"
                      title="เลือกนักเรียน"
                      description="ค้นหาและเลือกนักเรียนได้พร้อมกันหลายคน"
                    />
                    <Button
                      variant="outlined"
                      disabled={!selectedClassroom}
                      startIcon={<RemixIcon icon="solar:user-plus-bold" />}
                      onClick={() => setStudentDialogOpen(true)}
                      sx={{ flexShrink: 0 }}
                    >
                      สร้างบัญชีนักเรียนใหม่
                    </Button>
                  </Box>

                  <Autocomplete
                    multiple
                    fullWidth
                    disableCloseOnSelect
                    limitTags={6}
                    options={availableStudents}
                    value={selectedStudents}
                    loading={studentsLoading}
                    disabled={!selectedClassroom || studentsLoading || studentsError}
                    getOptionLabel={(option) =>
                      `${option.first_name ?? ''} ${option.last_name ?? ''}`.trim() ||
                      option.username
                    }
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    onChange={(_, value) =>
                      setValue(
                        'studentIds',
                        value.map((student) => student.id),
                        { shouldDirty: true, shouldValidate: true }
                      )
                    }
                    noOptionsText={
                      selectedClassroom
                        ? 'ไม่พบนักเรียนที่สามารถเพิ่มในปีการศึกษานี้'
                        : 'กรุณาเลือกห้องเรียนก่อน'
                    }
                    loadingText="กำลังโหลดรายชื่อนักเรียน..."
                    renderOption={(props, option) => {
                      const name =
                        `${option.first_name ?? ''} ${option.last_name ?? ''}`.trim() ||
                        option.username;

                      return (
                        <Box component="li" {...props} key={option.id}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              @{option.username}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="นักเรียน *"
                        placeholder={selectedStudents.length ? '' : 'ค้นหาและเลือกนักเรียนหลายคน'}
                        error={!!errors.studentIds}
                        helperText={
                          errors.studentIds?.message ??
                          `เลือกแล้ว ${selectedStudents.length} คน · กำหนดเลขที่รายบุคคลภายหลังได้`
                        }
                      />
                    )}
                  />
                </Box>

                <Divider />

                <Box
                  sx={{
                    gap: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    flexDirection: { xs: 'column-reverse', sm: 'row' },
                    justifyContent: 'flex-end',
                  }}
                >
                  <Button
                    component={RouterLink}
                    href={backPath}
                    color="inherit"
                    size="large"
                    sx={{ width: { xs: 1, sm: 'auto' } }}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    size="large"
                    variant="contained"
                    loading={createMutation.isPending}
                    loadingIndicator="กำลังเพิ่ม..."
                    startIcon={<RemixIcon icon="solar:user-plus-bold" />}
                    sx={{ minWidth: 210, width: { xs: 1, sm: 'auto' } }}
                  >
                    เพิ่มนักเรียน {selectedStudents.length || ''} คนเข้าห้อง
                  </Button>
                </Box>
              </Box>
            </Form>
          </Box>
        </Card>

        <Card
          variant="outlined"
          sx={{
            p: 3,
            top: 96,
            position: { md: 'sticky' },
            bgcolor: 'background.neutral',
          }}
        >
          <Box
            sx={{ mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Box>
              <Typography variant="overline" sx={{ color: 'primary.main' }}>
                ตรวจสอบก่อนยืนยัน
              </Typography>
              <Typography variant="h6">สรุปการเพิ่มนักเรียน</Typography>
            </Box>
            <RemixIcon icon="solar:file-check-bold-duotone" width={32} />
          </Box>

          <SummaryRow
            icon="solar:user-rounded-bold"
            label="นักเรียน"
            value={selectedStudents.length ? `${selectedStudents.length} คน` : 'ยังไม่ได้เลือก'}
            ready={selectedStudents.length > 0}
          />
          <SummaryRow
            icon="solar:users-group-rounded-bold"
            label="ห้องเรียน"
            value={selectedClassroom?.name ?? 'ยังไม่ได้เลือก'}
            ready={!!selectedClassroom}
          />
          <Alert severity="info" icon={<RemixIcon icon="solar:info-circle-bold" />} sx={{ mt: 2.5 }}>
            ระบบจะแสดงเฉพาะนักเรียนที่ยังไม่มีห้องในปีการศึกษานี้ และสามารถกำหนดเลขที่ภายหลังได้
          </Alert>
        </Card>
      </Box>

      <StudentFormDialog
        open={studentDialogOpen}
        onClose={() => setStudentDialogOpen(false)}
        onSaved={(student) => {
          setValue('studentIds', Array.from(new Set([...studentIds, student.id])), {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
      />
    </Container>
  );
}

// ----------------------------------------------------------------------

type SectionTitleProps = {
  id: string;
  number: string;
  title: string;
  description: string;
};

function SectionTitle({ id, number, title, description }: SectionTitleProps) {
  return (
    <Box sx={{ gap: 1.5, mb: 3, display: 'flex', alignItems: 'flex-start' }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          flexShrink: 0,
          display: 'grid',
          borderRadius: '50%',
          color: 'common.white',
          placeItems: 'center',
          typography: 'subtitle2',
          bgcolor: 'primary.main',
        }}
      >
        {number}
      </Box>
      <Box>
        <Typography id={id} component="h2" variant="h6">
          {title}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.25, color: 'text.secondary' }}>
          {description}
        </Typography>
      </Box>
    </Box>
  );
}

type SummaryRowProps = {
  icon: 'solar:user-rounded-bold' | 'solar:users-group-rounded-bold';
  label: string;
  value: string;
  ready: boolean;
};

function SummaryRow({ icon, label, value, ready }: SummaryRowProps) {
  return (
    <Box sx={{ gap: 1.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          flexShrink: 0,
          display: 'grid',
          borderRadius: 1.25,
          color: ready ? 'primary.main' : 'text.disabled',
          placeItems: 'center',
          bgcolor: ready ? 'primary.lighter' : 'action.hover',
        }}
      >
        <RemixIcon icon={icon} width={21} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: 600, color: ready ? 'text.primary' : 'text.disabled' }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}
