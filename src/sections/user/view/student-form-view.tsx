'use client';

import type { UserRow, CreateUserParams, UpdateStudentProfileParams } from '../user-actions';

import * as z from 'zod';
import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Step from '@mui/material/Step';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stepper from '@mui/material/Stepper';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import StepLabel from '@mui/material/StepLabel';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import {
  formatImageSize,
  resizeProfileImage,
  PROFILE_IMAGE_SOURCE_LIMIT_BYTES,
} from 'src/utils/resize-profile-image';

import { UploadAvatar } from 'src/components/upload';
import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { generatePassword } from '../components/create-user-dialog';
import { getStudent, createUser, uploadStudentAvatar, updateStudentProfile } from '../user-actions';

// ----------------------------------------------------------------------

const StudentSchema = z.object({
  studentCode: z.string().trim().min(1, { error: 'กรุณากรอกรหัสนักเรียน!' }),
  nationalId: z.union([
    z.literal(''),
    z.string().regex(/^\d{13}$/, { error: 'เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก!' }),
  ]),
  namePrefix: z.string(),
  firstName: z.string().trim().min(1, { error: 'กรุณากรอกชื่อภาษาไทย!' }),
  lastName: z.string().trim().min(1, { error: 'กรุณากรอกนามสกุลภาษาไทย!' }),
  firstNameEn: z.string(),
  lastNameEn: z.string(),
  nickname: z.string(),
  gender: z.enum(['', 'male', 'female', 'other', 'unspecified']),
  birthDate: z.string().refine((value) => !value || !dayjs(value).isAfter(dayjs(), 'day'), {
    error: 'วันเดือนปีเกิดต้องไม่เป็นวันที่ในอนาคต!',
  }),
  nationality: z.string(),
  ethnicity: z.string(),
  religion: z.string(),
  guardianFullName: z.string().trim(),
  guardianRelationship: z.string().trim(),
  guardianPhone: z.string().trim(),
  guardianEmail: z.union([z.literal(''), z.email({ error: 'อีเมลผู้ปกครองไม่ถูกต้อง!' })]),
  guardianOccupation: z.string(),
  guardianAddress: z.string(),
  guardianNotes: z.string(),
  username: z.string().trim().min(1, { error: 'กรุณากรอกชื่อผู้ใช้งาน!' }),
  email: z.union([z.literal(''), z.email({ error: 'อีเมลไม่ถูกต้อง!' })]),
  password: z.union([
    z.literal(''),
    z.string().min(6, { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร!' }),
  ]),
});

type StudentFormValues = z.infer<typeof StudentSchema>;

const EMPTY_VALUES: StudentFormValues = {
  studentCode: '',
  nationalId: '',
  namePrefix: '',
  firstName: '',
  lastName: '',
  firstNameEn: '',
  lastNameEn: '',
  nickname: '',
  gender: '',
  birthDate: '',
  nationality: 'ไทย',
  ethnicity: 'ไทย',
  religion: '',
  guardianFullName: '',
  guardianRelationship: '',
  guardianPhone: '',
  guardianEmail: '',
  guardianOccupation: '',
  guardianAddress: '',
  guardianNotes: '',
  username: '',
  email: '',
  password: '',
};

const AVATAR_ACCEPT = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

const FORM_STEPS = [
  'ข้อมูลประจำตัว',
  'ข้อมูลส่วนบุคคล',
  'บัญชีเข้าใช้งาน',
  'ข้อมูลผู้ปกครอง',
];

type Props = {
  studentId?: string;
  basePath?: string;
  createReturnPath?: string;
  pendingConfirmation?: boolean;
};

export function StudentFormView({
  studentId,
  createReturnPath,
  pendingConfirmation = false,
  basePath = paths.admin.student.root,
}: Props) {
  const isEdit = !!studentId;
  const backPath = isEdit ? `${basePath}/${studentId}` : createReturnPath || basePath;
  const detailPath = (id: string) => `${basePath}/${id}`;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    data: student,
    isLoading: studentLoading,
    isError: studentError,
  } = useQuery({
    queryKey: ['users', 'student', studentId],
    queryFn: () => getStudent(studentId!),
    enabled: isEdit,
  });

  const methods = useForm<StudentFormValues>({
    resolver: zodResolver(StudentSchema),
    defaultValues: EMPTY_VALUES,
  });
  const { trigger, setError, handleSubmit, reset, watch, setValue } = methods;
  const birthDate = watch('birthDate');
  const age =
    birthDate && dayjs(birthDate).isValid() ? dayjs().diff(dayjs(birthDate), 'year') : null;

  const saveMutation = useMutation({
    mutationFn: async (values: StudentFormValues) => {
      const profile = {
        username: values.username.trim(),
        email: values.email.trim() || undefined,
        password: values.password || undefined,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        studentCode: values.studentCode.trim(),
        nationalId: values.nationalId.trim() || undefined,
        namePrefix: values.namePrefix || undefined,
        firstNameEn: values.firstNameEn.trim() || undefined,
        lastNameEn: values.lastNameEn.trim() || undefined,
        nickname: values.nickname.trim() || undefined,
        gender: values.gender || undefined,
        birthDate: values.birthDate || undefined,
        nationality: values.nationality.trim() || undefined,
        ethnicity: values.ethnicity.trim() || undefined,
        religion: values.religion.trim() || undefined,
      } satisfies UpdateStudentProfileParams;

      const savedStudent =
        isEdit && studentId
          ? await updateStudentProfile(studentId, profile)
          : await createUser({
              ...profile,
              password: profile.password || generatePassword(),
              role: 'student',
              pendingConfirmation,
              guardian: {
                fullName: values.guardianFullName.trim(),
                relationship: values.guardianRelationship.trim(),
                phone: values.guardianPhone.trim(),
                email: values.guardianEmail.trim(),
                occupation: values.guardianOccupation.trim(),
                address: values.guardianAddress.trim(),
                notes: values.guardianNotes.trim(),
                isPrimary: true,
              },
            } satisfies CreateUserParams);

      if (avatarFile) await uploadStudentAvatar(savedStudent.id, avatarFile);
      return savedStudent;
    },
    onSuccess: async (savedStudent: UserRow) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      router.push(!isEdit && createReturnPath ? createReturnPath : detailPath(savedStudent.id));
    },
  });

  useEffect(() => {
    if (isEdit && !student) return;

    reset(
      student
        ? {
            ...EMPTY_VALUES,
            studentCode: student.student_code ?? '',
            nationalId: student.national_id ?? '',
            namePrefix: student.name_prefix ?? '',
            firstName: student.first_name ?? '',
            lastName: student.last_name ?? '',
            firstNameEn: student.first_name_en ?? '',
            lastNameEn: student.last_name_en ?? '',
            nickname: student.nickname ?? '',
            gender: student.gender ?? '',
            birthDate: student.birth_date ?? '',
            nationality: student.nationality ?? 'ไทย',
            ethnicity: student.ethnicity ?? 'ไทย',
            religion: student.religion ?? '',
            username: student.username,
            email: student.email ?? '',
            password: '',
          }
        : { ...EMPTY_VALUES, password: generatePassword() }
    );
    setShowPassword(!student);
     
  }, [student, isEdit, reset]);

  const prepareAvatar = async (file: File) => {
    setAvatarError(null);
    setIsPreparingAvatar(true);
    try {
      setAvatarFile(await resizeProfileImage(file));
    } catch (error) {
      setAvatarFile(null);
      setAvatarError(error instanceof Error ? error.message : 'ไม่สามารถเตรียมรูปภาพได้');
    } finally {
      setIsPreparingAvatar(false);
    }
  };

  const nextStep = async () => {
    const stepFields: Array<Array<keyof StudentFormValues>> = [
      ['studentCode', 'nationalId', 'namePrefix', 'nickname', 'firstName', 'lastName'],
      ['gender', 'birthDate', 'nationality', 'ethnicity', 'religion'],
      ['username', 'email', 'password'],
    ];
    if (await trigger(stepFields[activeStep] ?? [])) {
      setActiveStep((current) => Math.min(current + 1, FORM_STEPS.length - 1));
    }
  };

  const submitForm = handleSubmit((values) => {
    if (!isEdit) {
      let guardianValid = true;
      if (!values.guardianFullName.trim()) {
        setError('guardianFullName', { message: 'กรุณากรอกชื่อ-นามสกุลผู้ปกครอง!' });
        guardianValid = false;
      }
      if (!values.guardianRelationship.trim()) {
        setError('guardianRelationship', { message: 'กรุณาระบุความสัมพันธ์!' });
        guardianValid = false;
      }
      if (!values.guardianPhone.trim()) {
        setError('guardianPhone', { message: 'กรุณากรอกเบอร์โทรศัพท์ผู้ปกครอง!' });
        guardianValid = false;
      }
      if (!guardianValid) return;
    }
    saveMutation.mutate(values);
  });

  if (isEdit && studentLoading) {
    return (
      <Box sx={{ py: 12, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isEdit && (studentError || !student)) {
    return (
      <Container maxWidth="md">
        <Alert
          severity="error"
          action={
            <Button component={RouterLink} href={backPath} color="inherit">
              กลับ
            </Button>
          }
        >
          ไม่พบข้อมูลนักเรียนนี้
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Button
        component={RouterLink}
        href={backPath}
        color="inherit"
        size="small"
        startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        sx={{ mb: 1.5, color: 'text.secondary' }}
      >
        กลับ
      </Button>
      <Typography component="h1" variant="h3" sx={{ mb: 1 }}>
        {isEdit ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียน'}
      </Typography>
      <Typography sx={{ mb: 4, color: 'text.secondary' }}>
        ข้อมูลประจำตัว ข้อมูลส่วนบุคคล บัญชีเข้าสู่ระบบ และข้อมูลผู้ปกครอง
      </Typography>

      {!isEdit && (
        <Card variant="outlined" sx={{ mb: 3, px: { xs: 2, sm: 4 }, py: 2.5 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {FORM_STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Card>
      )}

      <Card variant="outlined" sx={{ overflow: 'visible' }}>
        <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
          {(saveMutation.error || avatarError) && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {saveMutation.error?.message ?? avatarError}
            </Alert>
          )}

          <Form methods={methods} onSubmit={submitForm}>
            <Box
              sx={{
                gap: 3,
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: isEdit || activeStep === 0 ? '180px minmax(0, 1fr)' : '1fr',
                },
              }}
            >
              {(isEdit || activeStep === 0) && (
                <Box>
                  <UploadAvatar
                    value={avatarFile ?? student?.avatar_url ?? null}
                    accept={AVATAR_ACCEPT}
                    maxSize={PROFILE_IMAGE_SOURCE_LIMIT_BYTES}
                    loading={isPreparingAvatar}
                    disabled={saveMutation.isPending || isPreparingAvatar}
                    onDrop={(files) => {
                      const file = files[0];
                      if (file) void prepareAvatar(file);
                    }}
                    helperText={
                      <Typography
                        variant="caption"
                        sx={{
                          mt: 1.5,
                          display: 'block',
                          textAlign: 'center',
                          color: 'text.secondary',
                        }}
                      >
                        {avatarFile
                          ? `ตัวอย่างหลังย่อ ${formatImageSize(avatarFile.size)} · WEBP`
                          : 'PNG, JPEG หรือ WEBP'}
                        <br />
                        {avatarFile ? 'รูปจะบันทึกพร้อมข้อมูลนักเรียน' : 'ระบบย่อให้ไม่เกิน 1MB'}
                      </Typography>
                    }
                  />
                </Box>
              )}

              <Box sx={{ minWidth: 0 }}>
                {(isEdit || activeStep === 0) && (
                  <>
                    <SectionTitle title="ข้อมูลประจำตัวนักเรียน" />
                    <Box sx={fieldGridSx}>
                      <Field.Text
                        name="studentCode"
                        label="รหัสนักเรียน (Student ID) *"
                        autoFocus
                      />
                      <Field.Text
                        name="nationalId"
                        label="เลขประจำตัวประชาชน"
                        helperText="ไม่บังคับ · ตัวเลข 13 หลัก"
                        slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 13 } }}
                      />
                      <Field.Select name="namePrefix" label="คำนำหน้า">
                        <MenuItem value="">ไม่ระบุ</MenuItem>
                        {['เด็กชาย', 'เด็กหญิง', 'นาย', 'นางสาว', 'นาง'].map((prefix) => (
                          <MenuItem key={prefix} value={prefix}>
                            {prefix}
                          </MenuItem>
                        ))}
                      </Field.Select>
                      <Field.Text name="nickname" label="ชื่อเล่น" />
                      <Field.Text name="firstName" label="ชื่อภาษาไทย *" />
                      <Field.Text name="lastName" label="นามสกุลภาษาไทย *" />
                      <Field.Text name="firstNameEn" label="ชื่อภาษาอังกฤษ" />
                      <Field.Text name="lastNameEn" label="นามสกุลภาษาอังกฤษ" />
                    </Box>
                    {isEdit && <Divider sx={{ my: 3 }} />}
                  </>
                )}

                {(isEdit || activeStep === 1) && (
                  <>
                    <SectionTitle title="ข้อมูลส่วนบุคคล" />
                    <Box sx={fieldGridSx}>
                      <Field.Select name="gender" label="เพศ">
                        <MenuItem value="">ไม่ระบุ</MenuItem>
                        <MenuItem value="male">ชาย</MenuItem>
                        <MenuItem value="female">หญิง</MenuItem>
                        <MenuItem value="other">อื่น ๆ</MenuItem>
                        <MenuItem value="unspecified">ไม่ประสงค์ระบุ</MenuItem>
                      </Field.Select>
                      <Field.DatePicker name="birthDate" label="วันเดือนปีเกิด" />
                      <Field.Text
                        name="age"
                        label="อายุ"
                        value={age === null || age < 0 ? '' : `${age} ปี`}
                        disabled
                        helperText="คำนวณอัตโนมัติจากวันเกิด"
                      />
                      <Field.Text name="nationality" label="สัญชาติ" />
                      <Field.Text name="ethnicity" label="เชื้อชาติ" />
                      <Field.Text name="religion" label="ศาสนา" />
                    </Box>
                    {isEdit && <Divider sx={{ my: 3 }} />}
                  </>
                )}

                {(isEdit || activeStep === 2) && (
                  <>
                    <SectionTitle title="บัญชีเข้าสู่ระบบ" />
                    <Box sx={fieldGridSx}>
                      <Field.Text
                        name="username"
                        label="ชื่อผู้ใช้งาน *"
                        helperText="ใช้สำหรับเข้าสู่ระบบ"
                      />
                      <Field.Text name="email" label="อีเมล" helperText="ไม่บังคับ" />
                      <Box sx={{ gridColumn: { sm: 'span 2' } }}>
                        <Field.Text
                          name="password"
                          label={isEdit ? 'รหัสผ่านใหม่ (ไม่บังคับ)' : 'รหัสผ่านชั่วคราว'}
                          type={showPassword ? 'text' : 'password'}
                          helperText={
                            isEdit
                              ? 'เว้นว่างหากไม่ต้องการเปลี่ยน'
                              : 'นักเรียนต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก'
                          }
                          slotProps={{
                            input: {
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton
                                    edge="end"
                                    onClick={() => setShowPassword((value) => !value)}
                                  >
                                    <RemixIcon
                                      icon={
                                        showPassword
                                          ? 'solar:eye-bold'
                                          : 'solar:eye-closed-bold'
                                      }
                                    />
                                  </IconButton>
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                        <Button
                          size="small"
                          color="inherit"
                          startIcon={<RemixIcon icon="solar:restart-bold" />}
                          onClick={() => {
                            setValue('password', generatePassword(), {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                            setShowPassword(true);
                          }}
                          sx={{ mt: 0.75 }}
                        >
                          สร้างรหัสผ่านใหม่
                        </Button>
                      </Box>
                    </Box>
                    {isEdit && <Divider sx={{ my: 3 }} />}
                  </>
                )}

                {!isEdit && activeStep === 3 && (
                  <>
                    <SectionTitle title="ข้อมูลผู้ปกครองหลัก" />
                    <Alert severity="info" sx={{ mb: 2.5 }}>
                      ผู้ปกครองรายนี้จะเป็นผู้ติดต่อหลัก
                      และสามารถเชื่อมบัญชี LINE เพิ่มเติมได้หลังยืนยันข้อมูลนักเรียน
                    </Alert>
                    <Box sx={fieldGridSx}>
                      <Field.Text
                        name="guardianFullName"
                        label="ชื่อ-นามสกุลผู้ปกครอง *"
                        autoFocus
                      />
                      <Field.Text
                        name="guardianRelationship"
                        label="ความสัมพันธ์ *"
                        placeholder="เช่น บิดา มารดา"
                      />
                      <Field.Text
                        name="guardianPhone"
                        label="เบอร์โทรศัพท์ *"
                        slotProps={{ htmlInput: { inputMode: 'tel', maxLength: 30 } }}
                      />
                      <Field.Text name="guardianEmail" label="อีเมลผู้ปกครอง" />
                      <Field.Text name="guardianOccupation" label="อาชีพ" />
                      <Box sx={{ display: { xs: 'none', sm: 'block' } }} />
                      <Field.Text
                        name="guardianAddress"
                        label="ที่อยู่"
                        multiline
                        minRows={3}
                        sx={{ gridColumn: { sm: 'span 2' } }}
                      />
                      <Field.Text
                        name="guardianNotes"
                        label="หมายเหตุ"
                        multiline
                        minRows={2}
                        sx={{ gridColumn: { sm: 'span 2' } }}
                      />
                    </Box>
                  </>
                )}

                <Divider sx={{ my: 3 }} />

                <Box
                  sx={{
                    gap: 1.5,
                    display: 'flex',
                    alignItems: { xs: 'stretch', sm: 'center' },
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                  }}
                >
                  <Button
                    component={RouterLink}
                    href={backPath}
                    color="inherit"
                    size="large"
                    disabled={saveMutation.isPending || isPreparingAvatar}
                    sx={{ width: { xs: 1, sm: 'auto' } }}
                  >
                    ยกเลิก
                  </Button>
                  <Box
                    sx={{
                      gap: 1,
                      display: 'flex',
                      flexDirection: { xs: 'column-reverse', sm: 'row' },
                    }}
                  >
                    {!isEdit && activeStep > 0 && (
                      <Button
                        size="large"
                        color="inherit"
                        disabled={saveMutation.isPending}
                        onClick={() => setActiveStep((current) => Math.max(current - 1, 0))}
                      >
                        ย้อนกลับ
                      </Button>
                    )}
                    {!isEdit && activeStep < FORM_STEPS.length - 1 ? (
                      <Button
                        size="large"
                        variant="contained"
                        disabled={isPreparingAvatar}
                        onClick={() => void nextStep()}
                        endIcon={<RemixIcon icon="eva:arrow-ios-forward-fill" />}
                        sx={{ minWidth: 150 }}
                      >
                        ถัดไป
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        size="large"
                        variant="contained"
                        loading={saveMutation.isPending}
                        disabled={isPreparingAvatar}
                        sx={{ minWidth: 180 }}
                      >
                        {isEdit ? 'บันทึกการแก้ไข' : 'บันทึกและส่งตรวจสอบ'}
                      </Button>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Form>
        </Box>
      </Card>
    </Container>
  );
}

const fieldGridSx = {
  gap: 2.5,
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
};

function SectionTitle({ title }: { title: string }) {
  return (
    <Typography variant="subtitle1" sx={{ mb: 2 }}>
      {title}
    </Typography>
  );
}
