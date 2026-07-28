'use client';

import type { UserRow, CreateUserParams, UpdateStudentProfileParams } from '../user-actions';

import * as z from 'zod';
import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';

import {
  formatImageSize,
  resizeProfileImage,
  PROFILE_IMAGE_SOURCE_LIMIT_BYTES,
} from 'src/utils/resize-profile-image';

import { UploadAvatar } from 'src/components/upload';
import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { generatePassword } from './create-user-dialog';
import { createUser, uploadStudentAvatar, updateStudentProfile } from '../user-actions';

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
  username: '',
  email: '',
  password: '',
};

const AVATAR_ACCEPT = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

type Props = {
  open: boolean;
  student?: UserRow | null;
  onClose: () => void;
  onSaved?: (student: UserRow) => void;
};

export function StudentFormDialog({ open, student = null, onClose, onSaved }: Props) {
  const isEdit = !!student;
  const queryClient = useQueryClient();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const methods = useForm<StudentFormValues>({
    resolver: zodResolver(StudentSchema),
    defaultValues: EMPTY_VALUES,
  });
  const { handleSubmit, reset, watch, setValue } = methods;
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

      const savedStudent = isEdit
        ? await updateStudentProfile(student.id, profile)
        : await createUser({
            ...profile,
            password: profile.password || generatePassword(),
            role: 'student',
          } satisfies CreateUserParams);

      if (avatarFile) await uploadStudentAvatar(savedStudent.id, avatarFile);
      return savedStudent;
    },
    onSuccess: async (savedStudent) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      onSaved?.(savedStudent);
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;

    reset(
      student
        ? {
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
    setAvatarFile(null);
    setAvatarError(null);
    setIsPreparingAvatar(false);
    setShowPassword(!student);
    saveMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student, reset]);

  const closeDialog = () => {
    if (saveMutation.isPending || isPreparingAvatar) return;
    saveMutation.reset();
    setAvatarFile(null);
    setAvatarError(null);
    onClose();
  };

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

  return (
    <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="md">
      <Form methods={methods} onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box>
              <Typography component="h2" variant="h6">
                {isEdit ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียน'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                ข้อมูลประจำตัว ข้อมูลส่วนบุคคล และบัญชีเข้าสู่ระบบ
              </Typography>
            </Box>
            <IconButton
              onClick={closeDialog}
              disabled={saveMutation.isPending || isPreparingAvatar}
              aria-label="ปิดหน้าต่าง"
            >
              <RemixIcon icon="mingcute:close-line" />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {(saveMutation.error || avatarError) && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {saveMutation.error?.message ?? avatarError}
            </Alert>
          )}

          <Box
            sx={{
              gap: 3,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '180px minmax(0, 1fr)' },
            }}
          >
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
                    sx={{ mt: 1.5, display: 'block', textAlign: 'center', color: 'text.secondary' }}
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

            <Box sx={{ minWidth: 0 }}>
              <SectionTitle title="ข้อมูลประจำตัวนักเรียน" />
              <Box sx={fieldGridSx}>
                <Field.Text name="studentCode" label="รหัสนักเรียน (Student ID) *" autoFocus />
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

              <Divider sx={{ my: 3 }} />
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

              <Divider sx={{ my: 3 }} />
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
                                icon={showPassword ? 'solar:eye-bold' : 'solar:eye-closed-bold'}
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
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            color="inherit"
            onClick={closeDialog}
            disabled={saveMutation.isPending || isPreparingAvatar}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            variant="contained"
            loading={saveMutation.isPending}
            disabled={isPreparingAvatar}
          >
            {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มนักเรียน'}
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
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
