'use client';

import type { SubjectType, LearningArea, ActivityType } from '../subject-actions';

import * as z from 'zod';
import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { Upload } from 'src/components/upload';
import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { listSubjectMasterItems } from 'src/sections/subject-master/subject-master-actions';
import { listSemesters, listAcademicYears } from 'src/sections/academic-year/academic-year-actions';

import {
  getSubject,
  GRADE_LEVELS,
  createSubject,
  deleteSubject,
  updateSubject,
  ACTIVITY_TYPES,
  uploadSubjectImage,
  removeSubjectImage,
  STUDENT_DEVELOPMENT_ACTIVITY_CODE,
} from '../subject-actions';

// ----------------------------------------------------------------------

const FormSchema = z.object({
  code: z.string().trim().min(1, { error: 'กรุณากรอกรหัสวิชา!' }),
  name: z.string().trim().min(1, { error: 'กรุณากรอกชื่อวิชาภาษาไทย!' }),
  nameEn: z.string().trim(),
  credits: z.number().min(0, { error: 'หน่วยกิตต้องไม่ต่ำกว่า 0!' }).max(99),
  studyHours: z.number().min(0, { error: 'ชั่วโมงเรียนต้องไม่ต่ำกว่า 0!' }).max(9999),
  description: z.string().trim().max(2000, { error: 'คำอธิบายต้องไม่เกิน 2,000 ตัวอักษร!' }),
  descriptionEn: z
    .string()
    .trim()
    .max(2000, { error: 'คำอธิบายภาษาอังกฤษต้องไม่เกิน 2,000 ตัวอักษร!' }),
  academicYearId: z.string().min(1, { error: 'กรุณาเลือกปีการศึกษา!' }),
  semesterId: z.string().min(1, { error: 'กรุณาเลือกภาคเรียน!' }),
  published: z.boolean(),
  learningArea: z.string(),
  activityType: z.string(),
  subjectType: z.string(),
  educationStage: z.string(),
  gradeLevels: z.array(z.string()),
  learningStandards: z.string().max(20000),
  learningOutcomes: z.string().max(20000),
  learningUnits: z.string().max(20000),
  indicators: z.string().max(20000),
});

type FormValues = z.infer<typeof FormSchema>;

const IMAGE_ACCEPT = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const EMPTY_VALUES: FormValues = {
  code: '',
  name: '',
  nameEn: '',
  credits: 1,
  studyHours: 40,
  description: '',
  descriptionEn: '',
  academicYearId: '',
  semesterId: '',
  published: false,
  learningArea: '',
  activityType: '',
  subjectType: '',
  educationStage: '',
  gradeLevels: [],
  learningStandards: '',
  learningOutcomes: '',
  learningUnits: '',
  indicators: '',
};

type Props = {
  subjectId?: string;
  basePath?: string;
  initialAcademicYearId?: string;
  initialSemesterId?: string;
};

export function SubjectFormView({
  subjectId,
  basePath = paths.admin.subject.root,
  initialAcademicYearId = '',
  initialSemesterId = '',
}: Props = {}) {
  const router = useRouter();
  const isEdit = !!subjectId;
  const queryClient = useQueryClient();
  const [subjectImage, setSubjectImage] = useState<File | string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: EMPTY_VALUES,
  });
  const { handleSubmit, reset, setValue, control } = methods;
  const academicYearId = useWatch({ control, name: 'academicYearId' });
  const learningArea = useWatch({ control, name: 'learningArea' });
  const published = useWatch({ control, name: 'published' });

  const subjectQuery = useQuery({
    queryKey: ['subjects', 'detail', subjectId],
    queryFn: () => getSubject(subjectId!),
    enabled: isEdit,
  });
  const editingSubject = subjectQuery.data ?? null;
  const { data: academicYears = [], isLoading: academicYearsLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: listAcademicYears,
  });
  const { data: semesters = [], isLoading: semestersLoading } = useQuery({
    queryKey: ['semesters', academicYearId],
    queryFn: () => listSemesters(academicYearId),
    enabled: !!academicYearId,
  });
  const { data: masterItems = [] } = useQuery({
    queryKey: ['subject-master-items'],
    queryFn: listSubjectMasterItems,
  });
  const learningAreas = masterItems.filter(
    (item) =>
      item.category === 'learning_area' &&
      (item.is_active || item.code === editingSubject?.learning_area)
  );
  const subjectTypes = masterItems.filter(
    (item) =>
      item.category === 'subject_type' &&
      (item.is_active || item.code === editingSubject?.subject_type)
  );
  const educationStages = masterItems.filter(
    (item) =>
      item.category === 'education_stage' &&
      (item.is_active || item.code === editingSubject?.education_stage)
  );

  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const params = {
        name: data.name.trim(),
        nameEn: data.nameEn.trim() || undefined,
        code: data.code.trim(),
        credits: data.credits,
        studyHours: data.studyHours,
        description: data.description.trim() || undefined,
        descriptionEn: data.descriptionEn.trim() || undefined,
        academicYearId: data.academicYearId,
        semesterId: data.semesterId,
        status: (data.published ? 'published' : 'draft') as 'published' | 'draft',
        learningArea: (data.learningArea || undefined) as LearningArea | undefined,
        activityType: (data.activityType || undefined) as ActivityType | undefined,
        subjectType: (data.subjectType || undefined) as SubjectType | undefined,
        educationStage: data.educationStage || undefined,
        gradeLevels: data.gradeLevels,
        learningStandards: data.learningStandards.trim() || undefined,
        learningOutcomes: data.learningOutcomes.trim() || undefined,
        learningUnits: data.learningUnits.trim() || undefined,
        indicators: data.indicators.trim() || undefined,
      };
      const subject = editingSubject
        ? await updateSubject(editingSubject.id, params)
        : await createSubject(params);

      try {
        if (subjectImage instanceof File) {
          return await uploadSubjectImage(subject.id, subjectImage);
        }
        if (editingSubject && imageRemoved && editingSubject.image_url) {
          return await removeSubjectImage(subject.id);
        }
        return subject;
      } catch (error) {
        if (!editingSubject) await deleteSubject(subject.id);
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subjects'] });
      router.push(basePath);
    },
  });

  useEffect(() => {
    if (isEdit && !editingSubject) return;

    saveMutation.reset();
    setImageRemoved(false);
    setSubjectImage(editingSubject?.image_url ?? null);
    reset(
      editingSubject
        ? {
            code: editingSubject.code ?? '',
            name: editingSubject.name,
            nameEn: editingSubject.name_en ?? '',
            credits: Number(editingSubject.credits),
            studyHours: Number(editingSubject.study_hours ?? 0),
            description: editingSubject.description ?? '',
            descriptionEn: editingSubject.description_en ?? '',
            academicYearId: editingSubject.academic_year_id ?? '',
            semesterId: editingSubject.semester_id ?? '',
            published: editingSubject.status === 'published',
            learningArea: editingSubject.learning_area ?? '',
            activityType: editingSubject.activity_type ?? '',
            subjectType: editingSubject.subject_type ?? '',
            educationStage: editingSubject.education_stage ?? '',
            gradeLevels: editingSubject.grade_levels ?? [],
            learningStandards: editingSubject.learning_standards ?? '',
            learningOutcomes: editingSubject.learning_outcomes ?? '',
            learningUnits: editingSubject.learning_units ?? '',
            indicators: editingSubject.indicators ?? '',
          }
        : {
            ...EMPTY_VALUES,
            academicYearId: initialAcademicYearId,
            semesterId: initialSemesterId,
          }
    );
    // Mutation methods are stable; including the mutation object causes unnecessary resets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSubject, initialAcademicYearId, initialSemesterId, isEdit, reset]);

  const onSubmit = handleSubmit((data) => saveMutation.mutate(data));

  return (
    <Container maxWidth="lg" sx={{ pb: 5 }}>
      <Button
        component={RouterLink}
        href={basePath}
        color="inherit"
        size="small"
        startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        sx={{ mb: 1.5, color: 'text.secondary' }}
      >
        กลับหน้ารายวิชา
      </Button>

      <Typography component="h1" variant="h3">
        {isEdit ? 'แก้ไขรายวิชา' : 'เพิ่มรายวิชา'}
      </Typography>
      <Typography sx={{ mt: 1, mb: 4, color: 'text.secondary' }}>
        {isEdit
          ? 'ปรับข้อมูลหลักสูตร หน่วยกิต คำอธิบาย และรูปภาพรายวิชา'
          : 'เพิ่มรายละเอียดวิชาใหม่เข้าสู่รายการของโรงเรียน'}
      </Typography>

      {subjectQuery.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {subjectQuery.error.message}
        </Alert>
      )}
      {subjectQuery.isLoading && (
        <Alert severity="info" sx={{ mb: 3 }}>
          กำลังโหลดข้อมูลรายวิชา...
        </Alert>
      )}

      <Form methods={methods} onSubmit={onSubmit}>
        <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
          {saveMutation.error && <Alert severity="error">{saveMutation.error.message}</Alert>}

          <Box
            sx={{
              gap: 3,
              display: 'grid',
              alignItems: 'start',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
            }}
          >
            <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
              <Box sx={{ gap: 2.5, display: 'flex', flexDirection: 'column' }}>
                <FormSectionTitle
                  number="1"
                  title="ข้อมูลพื้นฐานรายวิชา"
                  description="ระบุปีการศึกษา ภาคเรียน รหัส และชื่อรายวิชา"
                  icon="solar:notebook-bold-duotone"
                />

                <Box
                  sx={{
                    gap: 2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                  }}
                >
                  <Field.Select
                    name="academicYearId"
                    label="ปีการศึกษา *"
                    disabled={academicYearsLoading}
                    onChange={(event) => {
                      setValue('academicYearId', event.target.value);
                      setValue('semesterId', '', { shouldValidate: true });
                    }}
                    helperText="ปีที่เปิดรายวิชานี้"
                  >
                    {academicYears.map((year) => (
                      <MenuItem key={year.id} value={year.id}>
                        {year.year}
                      </MenuItem>
                    ))}
                  </Field.Select>
                  <Field.Select
                    name="semesterId"
                    label="ภาคเรียน *"
                    disabled={!academicYearId || semestersLoading}
                    helperText={academicYearId ? 'ภาคเรียนที่เปิดรายวิชา' : 'เลือกปีการศึกษาก่อน'}
                  >
                    {semesters.map((semester) => (
                      <MenuItem key={semester.id} value={semester.id}>
                        {semester.name}
                      </MenuItem>
                    ))}
                  </Field.Select>
                </Box>

                <Box
                  sx={{
                    gap: 2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                  }}
                >
                  <Field.Text
                    name="code"
                    label="รหัสวิชา *"
                    placeholder="เช่น MATH101"
                    helperText="ต้องไม่ซ้ำกับรายวิชาอื่นในภาคเรียนเดียวกัน"
                    autoFocus
                  />
                  <Field.Text
                    name="name"
                    label="ชื่อวิชาภาษาไทย"
                    placeholder="เช่น คณิตศาสตร์พื้นฐาน"
                    helperText="ชื่อหลักที่ครูและนักเรียนจะเห็นในระบบ"
                    required
                  />
                  <Field.Text
                    name="nameEn"
                    label="ชื่อวิชาภาษาอังกฤษ"
                    placeholder="e.g. Fundamental Mathematics"
                    helperText="ไม่บังคับ"
                    slotProps={{ htmlInput: { lang: 'en' } }}
                  />
                </Box>

                <Divider />
                <FormSectionTitle
                  number="2"
                  title="การจัดหมวดหมู่และระดับชั้น"
                  description="เลือกกลุ่มสาระ ประเภทรายวิชา และระดับชั้นที่เปิดสอน"
                  icon="solar:folder-with-files-bold-duotone"
                />
                <Box
                  sx={{
                    gap: 2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                  }}
                >
                  <Field.Select
                    name="learningArea"
                    label="กลุ่มสาระการเรียนรู้"
                    helperText="อ้างอิงข้อมูลหลักกลุ่มสาระของโรงเรียน"
                    onChange={(event) => {
                      setValue('learningArea', event.target.value);
                      if (event.target.value !== STUDENT_DEVELOPMENT_ACTIVITY_CODE) {
                        setValue('activityType', '');
                      }
                    }}
                  >
                    <MenuItem value="">ไม่ระบุ</MenuItem>
                    {learningAreas.map((area) => (
                      <MenuItem key={area.id} value={area.code}>
                        {area.name}
                      </MenuItem>
                    ))}
                  </Field.Select>
                  <Field.Select
                    name="subjectType"
                    label="ประเภทรายวิชา"
                    helperText="อ้างอิงข้อมูลหลักประเภทรายวิชาของโรงเรียน"
                  >
                    <MenuItem value="">ไม่ระบุ</MenuItem>
                    {subjectTypes.map((type) => (
                      <MenuItem key={type.id} value={type.code}>
                        {type.name}
                      </MenuItem>
                    ))}
                  </Field.Select>
                  <Field.Select
                    name="educationStage"
                    label="ช่วงชั้น"
                    helperText="อ้างอิงข้อมูลหลักช่วงชั้นของโรงเรียน"
                  >
                    <MenuItem value="">ไม่ระบุ</MenuItem>
                    {educationStages.map((stage) => (
                      <MenuItem key={stage.id} value={stage.code}>
                        {stage.name}
                      </MenuItem>
                    ))}
                  </Field.Select>
                  {learningArea === STUDENT_DEVELOPMENT_ACTIVITY_CODE && (
                    <Field.Select
                      name="activityType"
                      label="ประเภทกิจกรรมพัฒนาผู้เรียน"
                      helperText="แนะแนว ลูกเสือ/นศท. ชุมนุม หรือจิตอาสา"
                      sx={{ gridColumn: { sm: 'span 2' } }}
                    >
                      <MenuItem value="">ไม่ระบุ</MenuItem>
                      {ACTIVITY_TYPES.map((type) => (
                        <MenuItem key={type.value} value={type.value}>
                          {type.label}
                        </MenuItem>
                      ))}
                    </Field.Select>
                  )}
                  <Box sx={{ gridColumn: { sm: 'span 2' } }}>
                    <Field.Autocomplete
                      name="gradeLevels"
                      label="ระดับชั้นที่เปิดสอน"
                      placeholder="ไม่ระบุ"
                      fullWidth
                      multiple
                      keyOption={{ label: 'label', value: 'value' }}
                      options={GRADE_LEVELS.map((level) => ({ label: level, value: level }))}
                      helperText="เลือกได้หลายระดับชั้น เช่น ม.1-ม.3"
                    />
                  </Box>
                </Box>

                <Divider />
                <FormSectionTitle
                  number="3"
                  title="เวลาเรียนและคำอธิบาย"
                  description="กำหนดหน่วยกิต ชั่วโมงเรียน และรายละเอียดรายวิชา"
                  icon="solar:clock-circle-bold-duotone"
                />

                <Box
                  sx={{
                    gap: 2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                  }}
                >
                  <Field.Text
                    name="credits"
                    label="หน่วยกิต *"
                    type="number"
                    helperText="เช่น 0.5, 1 หรือ 3"
                    slotProps={{ htmlInput: { min: 0, max: 99, step: 0.5 } }}
                  />
                  <Field.Text
                    name="studyHours"
                    label="ชั่วโมงเรียน *"
                    type="number"
                    helperText="จำนวนชั่วโมงเรียนรวมของรายวิชา"
                    slotProps={{ htmlInput: { min: 0, max: 9999, step: 0.5 } }}
                  />
                </Box>
                <Field.Text
                  name="description"
                  label="คำอธิบายรายวิชา"
                  placeholder="สรุปเนื้อหาและวัตถุประสงค์ของรายวิชา"
                  helperText="ไม่บังคับ สูงสุด 2,000 ตัวอักษร"
                  multiline
                  minRows={3}
                />
                <Field.Text
                  name="descriptionEn"
                  label="คำอธิบายรายวิชาภาษาอังกฤษ"
                  placeholder="Course scope, objectives, or additional details"
                  helperText="ไม่บังคับ สูงสุด 2,000 ตัวอักษร"
                  multiline
                  minRows={3}
                  slotProps={{ htmlInput: { lang: 'en' } }}
                />

                <Divider />
                <FormSectionTitle
                  number="4"
                  title="โครงสร้างหลักสูตรรายวิชา"
                  description="ใช้เครื่องมือจัดรูปแบบเพื่อพิมพ์รายละเอียดหลักสูตรและเอกสารการสอน"
                  icon="solar:document-text-bold-duotone"
                />
                <Stack spacing={0.75}>
                  <Typography variant="subtitle2">มาตรฐานการเรียนรู้</Typography>
                  <Field.Editor
                    name="learningStandards"
                    placeholder="เช่น ท 1.1 ใช้กระบวนการอ่านสร้างความรู้และความคิด"
                  />
                </Stack>
                <Stack spacing={0.75}>
                  <Typography variant="subtitle2">ผลลัพธ์การเรียนรู้</Typography>
                  <Field.Editor
                    name="learningOutcomes"
                    placeholder="เช่น ผู้เรียนสามารถอธิบายแนวคิดสำคัญได้"
                  />
                </Stack>
                <Stack spacing={0.75}>
                  <Typography variant="subtitle2">หน่วยการเรียนรู้</Typography>
                  <Field.Editor
                    name="learningUnits"
                    placeholder="เช่น หน่วยที่ 1 พื้นฐานและแนวคิดสำคัญ"
                  />
                </Stack>
                <Stack spacing={0.75}>
                  <Typography variant="subtitle2">ตัวชี้วัด</Typography>
                  <Field.Editor
                    name="indicators"
                    placeholder="เช่น ท 1.1 ป.1/1 อ่านออกเสียงคำและข้อความสั้น ๆ"
                  />
                </Stack>
              </Box>
            </Card>

            <Card
              variant="outlined"
              sx={{
                p: 3,
                top: 88,
                position: { lg: 'sticky' },
              }}
            >
              {isEdit && (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1">สถานะการเผยแพร่</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      ครูท่านอื่นและผู้บริหารจะเห็นวิชานี้ก็ต่อเมื่อเผยแพร่แล้ว
                      ก่อนหน้านั้นจะเห็นเฉพาะคุณ
                    </Typography>
                  </Box>
                  <Field.Switch
                    name="published"
                    label={published ? 'เผยแพร่แล้ว' : 'แบบร่าง'}
                    sx={{ mb: 2.5 }}
                  />
                  <Divider sx={{ mb: 2.5 }} />
                </>
              )}
              <Box sx={{ gap: 1.25, mb: 2.5, display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    display: 'grid',
                    flexShrink: 0,
                    borderRadius: 1.5,
                    color: 'primary.main',
                    placeItems: 'center',
                    bgcolor: 'primary.lighter',
                  }}
                >
                  <RemixIcon icon="solar:gallery-wide-bold-duotone" width={23} />
                </Box>
                <Box>
                  <Typography variant="subtitle1">รูปภาพรายวิชา</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    รูปหน้าปกรายวิชา
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2" sx={{ mt: 0.25, mb: 1.5, color: 'text.secondary' }}>
                รูปนี้จะแสดงในหน้ารายวิชาของครูและนักเรียน
              </Typography>
              <Upload
                value={subjectImage}
                accept={IMAGE_ACCEPT}
                maxSize={MAX_IMAGE_SIZE}
                disabled={saveMutation.isPending}
                onDrop={(files) => {
                  const file = files[0];
                  if (file) {
                    setSubjectImage(file);
                    setImageRemoved(false);
                  }
                }}
                onDelete={() => {
                  setSubjectImage(null);
                  setImageRemoved(true);
                }}
                helperText="PNG, JPEG หรือ WEBP ขนาดไม่เกิน 5MB แนะนำอัตราส่วน 16:9"
                sx={{ height: { xs: 180, sm: 220 } }}
              />
              <Alert severity="info" variant="outlined" sx={{ mt: 2.5 }}>
                ช่องที่มีเครื่องหมาย * เป็นข้อมูลที่จำเป็น
              </Alert>
            </Card>
          </Box>

          <Card
            variant="outlined"
            sx={{
              p: 2,
              bottom: 16,
              zIndex: 5,
              position: 'sticky',
              boxShadow: (theme) => theme.vars.customShadows.z8,
            }}
          >
            <Box
              sx={{
                gap: 1,
                display: 'flex',
                alignItems: { sm: 'center' },
                flexDirection: { xs: 'column-reverse', sm: 'row' },
                justifyContent: 'space-between',
              }}
            >
              <Typography
                variant="body2"
                sx={{ display: { xs: 'none', sm: 'block' }, color: 'text.secondary' }}
              >
                ตรวจสอบข้อมูลให้ครบก่อนบันทึกรายวิชา
              </Typography>
              <Box sx={{ gap: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  component={RouterLink}
                  href={basePath}
                  color="inherit"
                  size="large"
                  disabled={saveMutation.isPending}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  size="large"
                  variant="contained"
                  loading={saveMutation.isPending}
                  disabled={subjectQuery.isLoading || subjectQuery.isError}
                  sx={{ minWidth: 170 }}
                >
                  {isEdit ? 'บันทึกการแก้ไข' : 'บันทึก'}
                </Button>
              </Box>
            </Box>
          </Card>
        </Box>
      </Form>
    </Container>
  );
}

function FormSectionTitle({
  icon,
  number,
  title,
  description,
}: {
  icon: string;
  number: string;
  title: string;
  description: string;
}) {
  return (
    <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'flex-start' }}>
      <Box
        sx={{
          width: 42,
          height: 42,
          display: 'grid',
          flexShrink: 0,
          borderRadius: 1.5,
          color: 'primary.main',
          placeItems: 'center',
          bgcolor: 'primary.lighter',
          position: 'relative',
        }}
      >
        <RemixIcon icon={icon} width={23} />
        <Box
          sx={{
            right: -6,
            bottom: -6,
            width: 20,
            height: 20,
            display: 'grid',
            borderRadius: '50%',
            color: 'common.white',
            placeItems: 'center',
            bgcolor: 'primary.main',
            fontSize: 11,
            fontWeight: 700,
            position: 'absolute',
            border: '2px solid',
            borderColor: 'background.paper',
          }}
        >
          {number}
        </Box>
      </Box>
      <Box>
        <Typography variant="subtitle1">{title}</Typography>
        <Typography variant="body2" sx={{ mt: 0.25, color: 'text.secondary' }}>
          {description}
        </Typography>
      </Box>
    </Box>
  );
}
