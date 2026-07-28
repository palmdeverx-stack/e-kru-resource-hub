'use client';

import type { Enrollment } from '../enrollment-actions';
import type { UserRow } from 'src/sections/user/user-actions';
import type { Classroom } from 'src/sections/classroom/classroom-actions';

import * as z from 'zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const EnrollmentFormSchema = z.object({
  studentIds: z.array(z.string()).min(1, { error: 'กรุณาเลือกนักเรียนอย่างน้อย 1 คน!' }),
  classroomId: z.string().min(1, { error: 'กรุณาเลือกห้องเรียน!' }),
  studentNumber: z
    .string()
    .trim()
    .refine((value) => !value || /^\d+$/.test(value), { error: 'เลขที่ต้องเป็นตัวเลขเท่านั้น!' }),
});

export type EnrollmentFormValues = z.infer<typeof EnrollmentFormSchema>;

type Props = {
  open: boolean;
  enrollment: Enrollment | null;
  initialClassroomId?: string;
  lockClassroom?: boolean;
  students: UserRow[];
  classrooms: Classroom[];
  enrollments: Enrollment[];
  studentsLoading?: boolean;
  classroomsLoading?: boolean;
  pending?: boolean;
  error?: Error | null;
  onClose: () => void;
  onSubmit: (values: EnrollmentFormValues) => void;
};

export function EnrollmentFormDialog({
  open,
  enrollment,
  initialClassroomId,
  lockClassroom = false,
  students,
  classrooms,
  enrollments,
  studentsLoading = false,
  classroomsLoading = false,
  pending = false,
  error,
  onClose,
  onSubmit,
}: Props) {
  const methods = useForm<EnrollmentFormValues>({
    resolver: zodResolver(EnrollmentFormSchema),
    defaultValues: { studentIds: [], classroomId: '', studentNumber: '' },
  });
  const {
    control,
    reset,
    setValue,
    handleSubmit,
    formState: { errors },
  } = methods;
  const studentIds = useWatch({ control, name: 'studentIds' });
  const classroomId = useWatch({ control, name: 'classroomId' });

  useEffect(() => {
    if (!open) return;

    reset({
      studentIds: enrollment ? [enrollment.student.id] : [],
      classroomId: enrollment?.classroom.id ?? initialClassroomId ?? '',
      studentNumber: enrollment?.student_number ?? '',
    });
  }, [enrollment, initialClassroomId, open, reset]);

  const selectedStudents = students.filter((student) => studentIds.includes(student.id));
  const selectedClassroom = classrooms.find((classroom) => classroom.id === classroomId) ?? null;
  const availableStudents = selectedClassroom
    ? students.filter(
        (student) =>
          student.is_active !== false &&
          (student.student_status ?? 'studying') === 'studying' &&
          !enrollments.some(
            (row) =>
              row.student.id === student.id &&
              row.classroom.academic_year_id === selectedClassroom.academic_year_id
          )
      )
    : [];

  const submit = handleSubmit(onSubmit);

  return (
    <Dialog open={open} onClose={() => !pending && onClose()} fullWidth maxWidth="sm">
      <Form methods={methods} onSubmit={submit}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography component="h2" variant="h6">
                {enrollment ? 'แก้ไขการลงทะเบียน' : 'เพิ่มนักเรียนเข้าห้อง'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                {enrollment
                  ? 'แก้ไขห้องเรียนและเลขที่ของนักเรียน'
                  : 'เลือกห้องเรียนก่อน แล้วเลือกนักเรียนได้พร้อมกันหลายคน'}
              </Typography>
            </Box>
            <IconButton onClick={onClose} disabled={pending} aria-label="ปิดหน้าต่าง">
              <RemixIcon icon="mingcute:close-line" />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Stack sx={{ mt: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2.5 }}>
                {error.message}
              </Alert>
            )}
            <Box sx={{ gap: 2.5, display: 'flex', flexDirection: 'column' }}>
              <Autocomplete
                options={classrooms}
                value={selectedClassroom}
                loading={classroomsLoading}
                disabled={lockClassroom && !enrollment}
                getOptionLabel={(option) =>
                  option.academic_years?.year
                    ? `${option.name} · ${option.academic_years.year}`
                    : option.name
                }
                isOptionEqualToValue={(option, value) => option.id === value.id}
                onChange={(_, value) => {
                  setValue('classroomId', value?.id ?? '', {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  if (!enrollment) {
                    setValue('studentIds', [], { shouldDirty: true, shouldValidate: true });
                  }
                }}
                noOptionsText="ไม่พบห้องเรียน"
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="ห้องเรียน *"
                    placeholder="ค้นหาห้องเรียน"
                    error={!!errors.classroomId}
                    helperText={errors.classroomId?.message ?? 'ห้องปลายทางของนักเรียน'}
                  />
                )}
              />

              {enrollment ? (
                <>
                  <TextField
                    disabled
                    label="นักเรียน"
                    value={
                      selectedStudents[0]
                        ? `${selectedStudents[0].first_name ?? ''} ${selectedStudents[0].last_name ?? ''}`.trim() ||
                          selectedStudents[0].username
                        : enrollment.student.username
                    }
                  />
                  <Field.Text
                    name="studentNumber"
                    label="เลขที่"
                    placeholder="เช่น 12"
                    helperText="ไม่บังคับ"
                    slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*' } }}
                  />
                </>
              ) : (
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  limitTags={4}
                  options={availableStudents}
                  value={selectedStudents}
                  loading={studentsLoading}
                  disabled={!selectedClassroom || studentsLoading}
                  getOptionLabel={(option) =>
                    `${option.first_name ?? ''} ${option.last_name ?? ''}`.trim() || option.username
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
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="นักเรียน *"
                      placeholder={selectedStudents.length ? '' : 'ค้นหาและเลือกนักเรียนหลายคน'}
                      error={!!errors.studentIds}
                      helperText={
                        errors.studentIds?.message ??
                        `เลือกแล้ว ${selectedStudents.length} คน · เพิ่มเลขที่รายบุคคลภายหลังได้`
                      }
                    />
                  )}
                />
              )}

              {(selectedStudents.length > 0 || selectedClassroom) && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'background.neutral',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {enrollment ? 'สรุปการแก้ไข' : 'สรุปก่อนเพิ่ม'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    นักเรียน:{' '}
                    <strong>
                      {selectedStudents.length
                        ? enrollment
                          ? `${selectedStudents[0]?.first_name ?? ''} ${selectedStudents[0]?.last_name ?? ''}`.trim() ||
                            selectedStudents[0]?.username
                          : `${selectedStudents.length} คน`
                        : 'ยังไม่ได้เลือก'}
                    </strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                    ห้องเรียน: <strong>{selectedClassroom?.name ?? 'ยังไม่ได้เลือก'}</strong>
                  </Typography>
                </Box>
              )}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button color="inherit" onClick={onClose} disabled={pending}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="contained" loading={pending}>
            {enrollment ? 'บันทึกการแก้ไข' : `เพิ่มนักเรียน ${selectedStudents.length || ''} คน`}
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
