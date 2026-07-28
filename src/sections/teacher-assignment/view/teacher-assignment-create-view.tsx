'use client';

import * as z from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { Form, Field } from 'src/components/hook-form';

import { listUsers } from 'src/sections/user/user-actions';
import { listSubjects } from 'src/sections/subject/subject-actions';
import { listClassrooms } from 'src/sections/classroom/classroom-actions';
import { listSemesters, listAcademicYears } from 'src/sections/academic-year/academic-year-actions';

import { createTeacherAssignment } from '../teacher-assignment-actions';

// ----------------------------------------------------------------------

export const TeacherAssignmentCreateSchema = z.object({
  teacherId: z.string().min(1, { error: 'กรุณาเลือกครูผู้สอน!' }),
  subjectId: z.string().min(1, { error: 'กรุณาเลือกรายวิชา!' }),
  classroomId: z.string().min(1, { error: 'กรุณาเลือกห้องเรียน!' }),
  academicYearId: z.string().min(1, { error: 'กรุณาเลือกปีการศึกษา!' }),
  semesterId: z.string().min(1, { error: 'กรุณาเลือกภาคเรียน!' }),
});

// ----------------------------------------------------------------------

export function TeacherAssignmentCreateView() {
  const router = useRouter();

  const { data: teachers } = useQuery({
    queryKey: ['users', 'teacher'],
    queryFn: () => listUsers('teacher'),
  });
  const { data: subjects } = useQuery({ queryKey: ['subjects'], queryFn: () => listSubjects() });
  const { data: classrooms } = useQuery({ queryKey: ['classrooms'], queryFn: () => listClassrooms() });
  const { data: academicYears } = useQuery({
    queryKey: ['academic-years'],
    queryFn: listAcademicYears,
  });

  const methods = useForm({
    resolver: zodResolver(TeacherAssignmentCreateSchema),
    defaultValues: {
      teacherId: '',
      subjectId: '',
      classroomId: '',
      academicYearId: '',
      semesterId: '',
    },
  });

  const { handleSubmit, control, setValue } = methods;
  const academicYearId = useWatch({ control, name: 'academicYearId' });
  const semesterId = useWatch({ control, name: 'semesterId' });
  const availableSubjects = subjects?.filter((subject) => subject.semester_id === semesterId);

  const { data: semesters } = useQuery({
    queryKey: ['semesters', academicYearId],
    queryFn: () => listSemesters(academicYearId),
    enabled: !!academicYearId,
  });

  const createMutation = useMutation({
    mutationFn: createTeacherAssignment,
    onSuccess: () => router.push(paths.admin.teacherAssignment.root),
  });

  const onSubmit = handleSubmit(async (data) =>
    createMutation.mutate({
      teacherId: data.teacherId,
      subjectId: data.subjectId,
      classroomId: data.classroomId,
      semesterId: data.semesterId,
    })
  );

  return (
    <Container sx={{ py: 10 }}>
      <Typography variant="h3" sx={{ mb: 5 }}>
        เพิ่มครูประจำวิชา
      </Typography>

      <Card sx={{ p: 3, maxWidth: 480 }}>
        {createMutation.error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {createMutation.error.message}
          </Alert>
        )}

        <Form methods={methods} onSubmit={onSubmit}>
          <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
            <Field.Select name="teacherId" label="ครูผู้สอน">
              {teachers?.map((teacher) => (
                <MenuItem key={teacher.id} value={teacher.id}>
                  {`${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`.trim() ||
                    teacher.username}
                </MenuItem>
              ))}
            </Field.Select>

            <Field.Select name="subjectId" label="รายวิชา" disabled={!semesterId}>
              {availableSubjects?.map((subject) => (
                <MenuItem key={subject.id} value={subject.id}>
                  {subject.name}
                </MenuItem>
              ))}
            </Field.Select>

            <Field.Select name="classroomId" label="ห้องเรียน">
              {classrooms?.map((classroom) => (
                <MenuItem key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </MenuItem>
              ))}
            </Field.Select>

            <Field.Select
              name="academicYearId"
              label="ปีการศึกษา"
              onChange={(event) => {
                setValue('academicYearId', event.target.value);
                setValue('semesterId', '');
                setValue('subjectId', '');
              }}
            >
              {academicYears?.map((year) => (
                <MenuItem key={year.id} value={year.id}>
                  {year.year}
                </MenuItem>
              ))}
            </Field.Select>

            <Field.Select
              name="semesterId"
              label="ภาคเรียน"
              disabled={!academicYearId}
              onChange={(event) => {
                setValue('semesterId', event.target.value);
                setValue('subjectId', '');
              }}
            >
              {semesters?.map((semester) => (
                <MenuItem key={semester.id} value={semester.id}>
                  {semester.name}
                </MenuItem>
              ))}
            </Field.Select>

            <Button
              type="submit"
              variant="contained"
              size="large"
              loading={createMutation.isPending}
            >
              เพิ่มครูประจำวิชา
            </Button>
          </Box>
        </Form>
      </Card>
    </Container>
  );
}
