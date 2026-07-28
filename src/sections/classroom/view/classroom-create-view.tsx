'use client';

import * as z from 'zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { today, fIsBetween } from 'src/utils/format-time';

import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { listSubjects } from 'src/sections/subject/subject-actions';
import { listSemesters, listAcademicYears } from 'src/sections/academic-year/academic-year-actions';

import { useAuthContext } from 'src/auth/hooks';

import { createClassroom } from '../classroom-actions';

// ----------------------------------------------------------------------

export const ClassroomCreateSchema = z.object({
  name: z.string().trim().min(1, { error: 'กรุณากรอกชื่อห้องเรียนภาษาไทย!' }),
  nameEn: z.string(),
  gradeLevel: z.string(),
  gradeLevelEn: z.string(),
  academicYearId: z.string().min(1, { error: 'กรุณาเลือกปีการศึกษา!' }),
  subjectId: z.string(),
  semesterId: z.string(),
});

const TeacherClassroomCreateSchema = ClassroomCreateSchema.extend({
  subjectId: z.string().min(1, { error: 'กรุณาเลือกวิชาที่สอน!' }),
  semesterId: z.string().min(1, { error: 'กรุณาเลือกภาคเรียน!' }),
});

type ClassroomCreateSchemaType = z.infer<typeof ClassroomCreateSchema>;

// ----------------------------------------------------------------------

export function ClassroomCreateView() {
  const router = useRouter();
  const { user } = useAuthContext();
  const isTeacher = user?.role === 'teacher';
  const backPath = isTeacher ? paths.teacher.assignments : paths.admin.classroom.root;

  const {
    data: academicYears,
    isLoading: academicYearsLoading,
    isError: academicYearsError,
  } = useQuery({
    queryKey: ['academic-years'],
    queryFn: listAcademicYears,
  });
  const {
    data: subjects,
    isLoading: subjectsLoading,
    isError: subjectsError,
  } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => listSubjects(),
    enabled: isTeacher,
  });

  const methods = useForm<ClassroomCreateSchemaType>({
    resolver: zodResolver(isTeacher ? TeacherClassroomCreateSchema : ClassroomCreateSchema),
    defaultValues: {
      name: '',
      nameEn: '',
      gradeLevel: '',
      gradeLevelEn: '',
      academicYearId: '',
      subjectId: '',
      semesterId: '',
    },
  });

  const { handleSubmit, control, setValue } = methods;
  const academicYearId = useWatch({ control, name: 'academicYearId' });
  const semesterId = useWatch({ control, name: 'semesterId' });
  const availableSubjects = subjects?.filter((subject) => subject.semester_id === semesterId);

  const {
    data: semesters,
    isLoading: semestersLoading,
    isError: semestersError,
  } = useQuery({
    queryKey: ['semesters', academicYearId],
    queryFn: () => listSemesters(academicYearId),
    enabled: isTeacher && !!academicYearId,
  });

  useEffect(() => {
    setValue('semesterId', '');
    setValue('subjectId', '');
  }, [academicYearId, setValue]);

  useEffect(() => {
    setValue('subjectId', '');
  }, [semesterId, setValue]);

  const createMutation = useMutation({
    mutationFn: createClassroom,
    onSuccess: () => router.push(backPath),
  });

  const onSubmit = handleSubmit(async (data) =>
    createMutation.mutate({
      name: data.name.trim(),
      nameEn: data.nameEn.trim() || undefined,
      academicYearId: data.academicYearId,
      gradeLevel: data.gradeLevel.trim() || undefined,
      gradeLevelEn: data.gradeLevelEn.trim() || undefined,
      subjectId: isTeacher ? data.subjectId : undefined,
      semesterId: isTeacher ? data.semesterId : undefined,
    })
  );

  const referenceDataError = academicYearsError || subjectsError || semestersError;

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
            สร้างห้องเรียนใหม่
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            กรอกข้อมูลห้องเรียนและวิชาที่สอน เพื่อเริ่มสร้างงานและบันทึกคะแนน
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
          <RemixIcon icon="solar:users-group-rounded-bold-duotone" width={36} />
        </Box>
      </Box>

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' },
        }}
      >
        <Card variant="outlined" sx={{ overflow: 'visible' }}>
          <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
            {createMutation.error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {createMutation.error.message}
              </Alert>
            )}

            {referenceDataError && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                โหลดตัวเลือกบางรายการไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่อีกครั้ง
              </Alert>
            )}

            <Form methods={methods} onSubmit={onSubmit}>
              <Box sx={{ gap: 4, display: 'flex', flexDirection: 'column' }}>
                <Box component="section" aria-labelledby="classroom-information-title">
                  <SectionTitle
                    id="classroom-information-title"
                    number="1"
                    title="ข้อมูลห้องเรียน"
                    description="ระบุชื่อห้องและปีการศึกษาที่จะเปิดใช้งาน"
                  />

                  <Box
                    sx={{
                      gap: 2.5,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    }}
                  >
                    <Field.Select
                      name="academicYearId"
                      label="ปีการศึกษา *"
                      disabled={academicYearsLoading}
                      helperText="เลือกปีการศึกษาของห้องนี้"
                    >
                      {academicYearsLoading && <MenuItem disabled>กำลังโหลด...</MenuItem>}
                      {!academicYearsLoading && !academicYears?.length && (
                        <MenuItem disabled>ยังไม่มีปีการศึกษา</MenuItem>
                      )}
                      {academicYears?.map((year) => (
                        <MenuItem key={year.id} value={year.id}>
                          {year.year}{' '}
                          {fIsBetween(today(), year.start_date, year.end_date) ? '(ปัจจุบัน)' : ''}
                        </MenuItem>
                      ))}
                    </Field.Select>

                    <Field.Text
                      name="name"
                      label="ชื่อห้องเรียนภาษาไทย *"
                      placeholder="เช่น ม.1/1"
                      helperText="ชื่อหลักที่ครูและนักเรียนเห็นในระบบ"
                    />

                    <Field.Text
                      name="nameEn"
                      label="ชื่อห้องเรียนภาษาอังกฤษ"
                      placeholder="e.g. Grade 7/1"
                      helperText="ไม่บังคับ"
                      slotProps={{ htmlInput: { lang: 'en' } }}
                    />

                    <Field.Text
                      name="gradeLevel"
                      label="ระดับชั้นภาษาไทย"
                      placeholder="เช่น มัธยมศึกษาปีที่ 1"
                      helperText="ไม่บังคับ"
                    />

                    <Field.Text
                      name="gradeLevelEn"
                      label="ระดับชั้นภาษาอังกฤษ"
                      placeholder="e.g. Grade 7"
                      helperText="ไม่บังคับ"
                      slotProps={{ htmlInput: { lang: 'en' } }}
                    />
                  </Box>
                </Box>

                {isTeacher && (
                  <>
                    <Divider />

                    <Box component="section" aria-labelledby="teaching-information-title">
                      <SectionTitle
                        id="teaching-information-title"
                        number="2"
                        title="ข้อมูลการสอน"
                        description="เลือกวิชาและภาคเรียนที่ต้องการใช้กับห้องนี้"
                      />

                      <Box
                        sx={{
                          gap: 2.5,
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                        }}
                      >
                        <Field.Select
                          name="semesterId"
                          label="ภาคเรียน *"
                          disabled={!academicYearId || semestersLoading}
                          helperText={
                            academicYearId
                              ? 'ภาคเรียนภายในปีการศึกษาที่เลือก'
                              : 'เลือกปีการศึกษาก่อน'
                          }
                        >
                          {semestersLoading && <MenuItem disabled>กำลังโหลด...</MenuItem>}
                          {!semestersLoading && academicYearId && !semesters?.length && (
                            <MenuItem disabled>ยังไม่มีภาคเรียน</MenuItem>
                          )}
                          {semesters?.map((semester) => (
                            <MenuItem key={semester.id} value={semester.id}>
                              {semester.name}{' '}
                              {fIsBetween(today(), semester.start_date, semester.end_date)
                                ? '(ปัจจุบัน)'
                                : ''}
                            </MenuItem>
                          ))}
                        </Field.Select>

                        <Field.Select
                          name="subjectId"
                          label="วิชาที่สอน *"
                          disabled={!semesterId || subjectsLoading}
                          helperText={
                            semesterId ? 'แสดงเฉพาะวิชาที่เปิดในภาคเรียนนี้' : 'เลือกภาคเรียนก่อน'
                          }
                        >
                          {subjectsLoading && <MenuItem disabled>กำลังโหลด...</MenuItem>}
                          {!subjectsLoading && semesterId && !availableSubjects?.length && (
                            <MenuItem disabled>ยังไม่มีรายวิชาในภาคเรียนนี้</MenuItem>
                          )}
                          {availableSubjects?.map((subject) => (
                            <MenuItem key={subject.id} value={subject.id}>
                              {subject.code ? `${subject.code} · ${subject.name}` : subject.name}
                            </MenuItem>
                          ))}
                        </Field.Select>
                      </Box>
                    </Box>
                  </>
                )}

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
                    loadingIndicator="กำลังสร้าง..."
                    startIcon={<RemixIcon icon="mingcute:add-line" />}
                    sx={{ minWidth: 180, width: { xs: 1, sm: 'auto' } }}
                  >
                    สร้างห้องเรียน
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
            sx={{
              width: 44,
              height: 44,
              mb: 2,
              display: 'grid',
              borderRadius: 1.5,
              color: 'primary.main',
              placeItems: 'center',
              bgcolor: 'primary.lighter',
            }}
          >
            <RemixIcon icon="solar:info-circle-bold" width={26} />
          </Box>
          <Typography variant="h6" sx={{ mb: 1 }}>
            หลังสร้างห้องแล้วทำอะไรต่อ?
          </Typography>
          <Typography variant="body2" sx={{ mb: 2.5, color: 'text.secondary' }}>
            ห้องเรียนนี้จะปรากฏในหน้าวิชาที่สอนทันที และพร้อมสำหรับขั้นตอนต่อไป
          </Typography>

          {[
            'เพิ่มนักเรียนเข้าห้องเรียน',
            'สร้างงานและกำหนดคะแนนเต็ม',
            'กรอกและติดตามคะแนนนักเรียน',
          ].map((text, index) => (
            <Box key={text} sx={{ gap: 1.5, mb: 1.75, display: 'flex', alignItems: 'flex-start' }}>
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  mt: 0.1,
                  flexShrink: 0,
                  display: 'grid',
                  borderRadius: '50%',
                  color: 'common.white',
                  placeItems: 'center',
                  typography: 'caption',
                  bgcolor: 'primary.main',
                }}
              >
                {index + 1}
              </Box>
              <Typography variant="body2">{text}</Typography>
            </Box>
          ))}
        </Card>
      </Box>
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
