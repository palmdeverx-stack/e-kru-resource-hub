'use client';

import type { TeacherAssignment } from '../teacher-assignment-actions';

import * as z from 'zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { listUsers } from 'src/sections/user/user-actions';
import { listSubjects } from 'src/sections/subject/subject-actions';
import { listClassrooms } from 'src/sections/classroom/classroom-actions';
import { listSemesters, listAcademicYears } from 'src/sections/academic-year/academic-year-actions';

import { useAuthContext } from 'src/auth/hooks';

import { createTeacherAssignment, updateTeacherAssignment } from '../teacher-assignment-actions';

// ----------------------------------------------------------------------

const FormSchema = z.object({
  teacherId: z.string().min(1, { error: 'กรุณาเลือกครูผู้สอน!' }),
  subjectId: z.string().min(1, { error: 'กรุณาเลือกรายวิชา!' }),
  classroomId: z.string().min(1, { error: 'กรุณาเลือกห้องเรียน!' }),
  academicYearId: z.string().min(1, { error: 'กรุณาเลือกปีการศึกษา!' }),
  semesterId: z.string().min(1, { error: 'กรุณาเลือกภาคเรียน!' }),
});

type FormValues = z.infer<typeof FormSchema>;

type Props = {
  open: boolean;
  editingRow: TeacherAssignment | null;
  onClose: () => void;
};

const emptyValues: FormValues = {
  teacherId: '',
  subjectId: '',
  classroomId: '',
  academicYearId: '',
  semesterId: '',
};

export function TeacherAssignmentFormDialog({ open, editingRow, onClose }: Props) {
  const { user } = useAuthContext();
  const isTeacher = user?.role === 'teacher';
  const schoolScope = user?.school_id ?? '';
  const queryClient = useQueryClient();

  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: emptyValues,
  });
  const { handleSubmit, control, reset, setValue } = methods;
  const academicYearId = useWatch({ control, name: 'academicYearId' });
  const semesterId = useWatch({ control, name: 'semesterId' });

  const { data: teachers = [], isLoading: teachersLoading } = useQuery({
    queryKey: ['users', 'teacher', schoolScope],
    queryFn: () => listUsers('teacher'),
    enabled: open && !isTeacher && !!schoolScope,
  });
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects', schoolScope, semesterId],
    queryFn: () => listSubjects({ semesterId }),
    enabled: open && !!schoolScope && !!semesterId,
  });
  const { data: classrooms = [], isLoading: classroomsLoading } = useQuery({
    queryKey: ['classrooms', schoolScope, academicYearId],
    queryFn: () => listClassrooms({ academicYearId }),
    enabled: open && !!schoolScope && !!academicYearId,
  });
  const { data: academicYears = [], isLoading: yearsLoading } = useQuery({
    queryKey: ['academic-years', schoolScope],
    queryFn: listAcademicYears,
    enabled: open && !!schoolScope,
  });
  const { data: semesters = [], isLoading: semestersLoading } = useQuery({
    queryKey: ['semesters', schoolScope, academicYearId],
    queryFn: () => listSemesters(academicYearId),
    enabled: open && !!schoolScope && !!academicYearId,
  });

  const createMutation = useMutation({
    mutationFn: createTeacherAssignment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
      await queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: string; data: FormValues }) =>
      updateTeacherAssignment(params.id, params.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
      await queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      onClose();
    },
  });

  const savePending = createMutation.isPending || updateMutation.isPending;
  const saveError = createMutation.error ?? updateMutation.error;

  useEffect(() => {
    if (!open) return;

    createMutation.reset();
    updateMutation.reset();

    if (editingRow) {
      reset({
        teacherId: editingRow.teacher.id,
        subjectId: editingRow.subject.id,
        classroomId: editingRow.classroom.id,
        academicYearId: editingRow.semester.academic_year_id,
        semesterId: editingRow.semester.id,
      });
      return;
    }

    reset({ ...emptyValues, teacherId: isTeacher ? (user?.id ?? '') : '' });
    // Mutations and form methods are stable; including them causes unnecessary resets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRow, isTeacher, open, reset, user?.id]);

  useEffect(() => {
    if (editingRow && academicYearId === editingRow.semester.academic_year_id) return;
    setValue('semesterId', '');
    setValue('subjectId', '');
    setValue('classroomId', '');
  }, [academicYearId, editingRow, setValue]);

  useEffect(() => {
    if (editingRow && semesterId === editingRow.semester.id) return;
    setValue('subjectId', '');
  }, [semesterId, editingRow, setValue]);

  const handleClose = () => {
    if (!savePending) onClose();
  };

  const onSubmit = handleSubmit((data) => {
    if (editingRow) {
      updateMutation.mutate({ id: editingRow.id, data });
      return;
    }

    createMutation.mutate(data);
  });

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography component="h2" variant="h6">
                {editingRow
                  ? 'แก้ไขรายวิชาที่รับผิดชอบ'
                  : isTeacher
                    ? 'เพิ่มรายวิชาที่สอน'
                    : 'เพิ่มครูประจำวิชา'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                {isTeacher
                  ? 'เลือกวิชา ห้องเรียน ปีการศึกษา และภาคเรียนที่คุณรับผิดชอบ'
                  : 'มอบหมายครูให้กับรายวิชา ห้องเรียน และภาคเรียน'}
              </Typography>
            </Box>
            <Box>
              <IconButton onClick={handleClose} disabled={savePending} aria-label="ปิดหน้าต่าง">
                <RemixIcon icon="mingcute:close-line" />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ py: 3 }}>
          {saveError && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {saveError.message}
            </Alert>
          )}

          <Box
            sx={{
              mt: 3,
              gap: 2.5,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            }}
          >
            {!isTeacher && (
              <Field.Select
                name="teacherId"
                label="ครูผู้สอน *"
                disabled={teachersLoading}
                helperText="ครูที่รับผิดชอบรายวิชานี้"
              >
                {teachers.map((teacher) => (
                  <MenuItem key={teacher.id} value={teacher.id}>
                    {`${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`.trim() ||
                      teacher.username}
                  </MenuItem>
                ))}
              </Field.Select>
            )}

            <Field.Select
              name="academicYearId"
              label="ปีการศึกษา *"
              disabled={yearsLoading}
              helperText="เลือกก่อนเพื่อโหลดภาคเรียนและห้องเรียน"
            >
              {academicYears.map((year) => (
                <MenuItem key={year.id} value={year.id}>
                  {year.year}
                </MenuItem>
              ))}
            </Field.Select>

            <Field.Select
              name="classroomId"
              label="ห้องเรียน *"
              disabled={!academicYearId || classroomsLoading}
              helperText={
                academicYearId ? 'แสดงเฉพาะห้องเรียนในปีการศึกษาที่เลือก' : 'เลือกปีการศึกษาก่อน'
              }
            >
              {classrooms.map((classroom) => (
                <MenuItem key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </MenuItem>
              ))}
            </Field.Select>

            <Field.Select
              name="semesterId"
              label="ภาคเรียน *"
              disabled={!academicYearId || semestersLoading}
              helperText={academicYearId ? 'ภาคเรียนที่ต้องการมอบหมาย' : 'เลือกปีการศึกษาก่อน'}
            >
              {semesters.map((semester) => (
                <MenuItem key={semester.id} value={semester.id}>
                  {semester.name}
                </MenuItem>
              ))}
            </Field.Select>

            <Field.Select
              name="subjectId"
              label="รายวิชา *"
              disabled={!semesterId || subjectsLoading}
              helperText={
                semesterId ? 'แสดงเฉพาะวิชาที่เปิดในภาคเรียนนี้' : 'เลือกปีการศึกษาและภาคเรียนก่อน'
              }
            >
              {subjects.map((subject) => (
                <MenuItem key={subject.id} value={subject.id}>
                  {subject.code ? `${subject.code} · ${subject.name}` : subject.name}
                </MenuItem>
              ))}
            </Field.Select>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button color="inherit" onClick={handleClose} disabled={savePending}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="contained" loading={savePending}>
            {editingRow ? 'บันทึกการแก้ไข' : isTeacher ? 'เพิ่มรายวิชาที่สอน' : 'เพิ่มครูประจำวิชา'}
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
