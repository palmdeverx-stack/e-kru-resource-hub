'use client';

import type { StaffType } from 'src/types/staff-employment';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { listStaffMasterItems } from 'src/sections/staff-master/staff-master-actions';

import { STAFF_TYPES, EMPLOYMENT_STATUSES } from 'src/types/staff-employment';

import { generatePassword } from '../components/create-user-dialog';
import { createUser, getManagedUser, updateStaffUser } from '../user-actions';

// ----------------------------------------------------------------------

const StaffSchema = z
  .object({
    namePrefix: z.string().trim().min(1, { error: 'กรุณาเลือกคำนำหน้าชื่อ!' }),
    firstName: z.string().trim().min(1, { error: 'กรุณากรอกชื่อภาษาไทย!' }),
    lastName: z.string().trim().min(1, { error: 'กรุณากรอกนามสกุลภาษาไทย!' }),
    firstNameEn: z.string(),
    lastNameEn: z.string(),
    username: z.string().trim().min(1, { error: 'กรุณากรอกชื่อผู้ใช้งาน!' }),
    email: z.union([z.literal(''), z.email({ error: 'อีเมลไม่ถูกต้อง!' })]),
    password: z.union([
      z.literal(''),
      z.string().min(6, { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร!' }),
    ]),
    staffType: z.string().trim().min(1, { error: 'กรุณาเลือกประเภทบุคลากร' }),
    employmentStatus: z.string().trim().min(1, { error: 'กรุณาเลือกสถานะปฏิบัติงาน' }),
    employmentStartDate: z.string(),
    appointmentDate: z.string(),
    contractEndDate: z.string(),
    positionTitle: z.string(),
    academicRank: z.string(),
  })
  .refine(
    (data) =>
      !data.employmentStartDate ||
      !data.contractEndDate ||
      data.contractEndDate >= data.employmentStartDate,
    {
      path: ['contractEndDate'],
      error: 'วันที่สิ้นสุดสัญญาต้องไม่ก่อนวันที่เริ่มงาน',
    }
  );

type StaffFormValues = z.infer<typeof StaffSchema>;

const DEFAULT_VALUES: StaffFormValues = {
  namePrefix: '',
  firstName: '',
  lastName: '',
  firstNameEn: '',
  lastNameEn: '',
  username: '',
  email: '',
  password: '',
  staffType: 'teacher',
  employmentStatus: 'active',
  employmentStartDate: '',
  appointmentDate: '',
  contractEndDate: '',
  positionTitle: '',
  academicRank: '',
};

// ----------------------------------------------------------------------

export function StaffCreateView({ userId }: { userId?: string } = {}) {
  const isEdit = !!userId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const userQuery = useQuery({
    queryKey: ['users', 'staff', userId],
    queryFn: async () => {
      const user = await getManagedUser(userId!);
      if (user.role !== 'teacher') {
        throw new Error('บัญชีนี้ไม่ใช่ครูหรือบุคลากร');
      }
      return user;
    },
    enabled: isEdit,
  });
  const masterItemsQuery = useQuery({
    queryKey: ['staff-master-items'],
    queryFn: listStaffMasterItems,
  });
  const methods = useForm<StaffFormValues>({
    resolver: zodResolver(StaffSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { reset, setValue, handleSubmit } = methods;

  useEffect(() => {
    if (isEdit) return;
    setValue('password', generatePassword(), { shouldValidate: true });
  }, [isEdit, setValue]);

  useEffect(() => {
    const user = userQuery.data;
    if (!user) return;

    reset({
      namePrefix: user.name_prefix ?? '',
      firstName: user.first_name ?? '',
      lastName: user.last_name ?? '',
      firstNameEn: user.first_name_en ?? '',
      lastNameEn: user.last_name_en ?? '',
      username: user.username,
      email: user.email ?? '',
      password: '',
      staffType: user.staff_type ?? 'teacher',
      employmentStatus: user.employment_status ?? 'active',
      employmentStartDate: user.employment_start_date ?? '',
      appointmentDate: user.appointment_date ?? '',
      contractEndDate: user.contract_end_date ?? '',
      positionTitle: user.position_title ?? '',
      academicRank: user.academic_rank ?? '',
    });
  }, [reset, userQuery.data]);

  const activeMasterItems = (
    category: 'staff_type' | 'prefix' | 'position' | 'academic_rank' | 'employment_status'
  ) =>
    (masterItemsQuery.data ?? []).filter(
      (item) =>
        item.category === category &&
        (item.is_active ||
          item.code === userQuery.data?.staff_type ||
          item.code === userQuery.data?.employment_status ||
          item.name === userQuery.data?.name_prefix ||
          item.name === userQuery.data?.position_title ||
          item.name === userQuery.data?.academic_rank)
    );

  const saveMutation = useMutation({
    mutationFn: (values: StaffFormValues) => {
      const params = {
        namePrefix: values.namePrefix.trim(),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        firstNameEn: values.firstNameEn.trim() || undefined,
        lastNameEn: values.lastNameEn.trim() || undefined,
        username: values.username.trim(),
        email: values.email.trim() || undefined,
        password: values.password || undefined,
        staffType: values.staffType as StaffType,
        employmentStatus: values.employmentStatus,
        employmentStartDate: values.employmentStartDate || undefined,
        appointmentDate: values.appointmentDate || undefined,
        contractEndDate: values.contractEndDate || undefined,
        positionTitle: values.positionTitle.trim() || undefined,
        academicRank: values.academicRank.trim() || undefined,
      };

      return isEdit
        ? updateStaffUser(userId!, params)
        : createUser({ ...params, password: values.password, role: 'teacher' });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      router.push(paths.admin.user.root);
    },
  });

  const onSubmit = handleSubmit((values) => saveMutation.mutate(values));

  return (
    <Container maxWidth="lg" sx={{ pb: 5 }}>
      <Button
        component={RouterLink}
        href={paths.admin.user.root}
        color="inherit"
        size="small"
        startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        sx={{ mb: 1.5, color: 'text.secondary' }}
      >
        กลับหน้าครู/บุคลากร
      </Button>

      <Typography component="h1" variant="h3">
        {isEdit ? 'แก้ไขครู/บุคลากร' : 'เพิ่มครู/บุคลากร'}
      </Typography>
      <Typography sx={{ mt: 1, mb: 4, color: 'text.secondary' }}>
        {isEdit
          ? 'แก้ไขข้อมูลส่วนตัว ข้อมูลเข้าใช้งาน และข้อมูลการทำงาน'
          : 'สร้างบัญชีและบันทึกข้อมูลการทำงานของครูหรือบุคลากร'}
      </Typography>

      <Form methods={methods} onSubmit={onSubmit}>
        <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
          {saveMutation.error && <Alert severity="error">{saveMutation.error.message}</Alert>}
          {userQuery.isError && <Alert severity="error">{userQuery.error.message}</Alert>}
          {userQuery.isLoading && <Alert severity="info">กำลังโหลดข้อมูลครู/บุคลากร...</Alert>}
          {masterItemsQuery.isError && (
            <Alert severity="warning">
              ไม่สามารถโหลดข้อมูลหลักบุคลากรได้ กรุณาตรวจสอบเมนูข้อมูลหลักบุคลากร
            </Alert>
          )}

          <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
            <SectionTitle
              title="ข้อมูลส่วนตัว"
              description="ชื่อและข้อมูลส่วนตัวของครูหรือบุคลากร"
            />
            <Box sx={fieldGridSx}>
              <Field.Select name="namePrefix" label="คำนำหน้าชื่อ *">
                {activeMasterItems('prefix').map((item) => (
                  <MenuItem key={item.id} value={item.name}>
                    {item.name_en ? `${item.name} / ${item.name_en}` : item.name}
                  </MenuItem>
                ))}
              </Field.Select>
              <Field.Text name="firstName" label="ชื่อภาษาไทย *" autoFocus />
              <Field.Text name="lastName" label="นามสกุลภาษาไทย *" />
              <Field.Text
                name="firstNameEn"
                label="ชื่อภาษาอังกฤษ"
                slotProps={{ htmlInput: { lang: 'en' } }}
              />
              <Field.Text
                name="lastNameEn"
                label="นามสกุลภาษาอังกฤษ"
                slotProps={{ htmlInput: { lang: 'en' } }}
              />
            </Box>
          </Card>

          <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
            <SectionTitle
              title="ข้อมูลเข้าใช้งาน"
              description="ชื่อผู้ใช้งาน อีเมล และรหัสผ่านสำหรับเข้าสู่ระบบ"
            />
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
                  label={isEdit ? 'รหัสผ่านใหม่' : 'รหัสผ่านชั่วคราว *'}
                  type={showPassword ? 'text' : 'password'}
                  helperText={
                    isEdit
                      ? 'เว้นว่างหากไม่ต้องการเปลี่ยนรหัสผ่าน'
                      : 'ผู้ใช้งานต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก'
                  }
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            edge="end"
                            onClick={() => setShowPassword((value) => !value)}
                            aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
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
          </Card>

          <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
            <SectionTitle
              title="ข้อมูลการทำงาน"
              description="ประเภทบุคลากร สถานะ ตำแหน่ง และวิทยฐานะ"
            />
            <Box sx={fieldGridSx}>
              <Field.Select name="staffType" label="ประเภทบุคลากร *">
                {(activeMasterItems('staff_type').length
                  ? activeMasterItems('staff_type').map((item) => ({
                      value: item.code!,
                      label: item.name_en ? `${item.name} / ${item.name_en}` : item.name,
                    }))
                  : STAFF_TYPES
                ).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Field.Select>
              <Field.Select name="employmentStatus" label="สถานะ *">
                {(activeMasterItems('employment_status').length
                  ? activeMasterItems('employment_status').map((item) => ({
                      value: item.code!,
                      label: item.name_en ? `${item.name} / ${item.name_en}` : item.name,
                    }))
                  : EMPLOYMENT_STATUSES
                ).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Field.Select>
              <Field.DatePicker name="employmentStartDate" label="วันที่เริ่มงาน" />
              <Field.DatePicker name="appointmentDate" label="วันที่บรรจุ" />
              <Field.DatePicker name="contractEndDate" label="วันที่สิ้นสุดสัญญา" />
              <Field.Select name="positionTitle" label="ตำแหน่ง">
                <MenuItem value="">ไม่ระบุ</MenuItem>
                {activeMasterItems('position').map((item) => (
                  <MenuItem key={item.id} value={item.name}>
                    {item.name_en ? `${item.name} / ${item.name_en}` : item.name}
                  </MenuItem>
                ))}
              </Field.Select>
              <Field.Select name="academicRank" label="วิทยฐานะ">
                <MenuItem value="">ไม่ระบุ</MenuItem>
                {activeMasterItems('academic_rank').map((item) => (
                  <MenuItem key={item.id} value={item.name}>
                    {item.name_en ? `${item.name} / ${item.name_en}` : item.name}
                  </MenuItem>
                ))}
              </Field.Select>
            </Box>
          </Card>

          <Divider />
          <Box
            sx={{
              gap: 1,
              display: 'flex',
              flexDirection: { xs: 'column-reverse', sm: 'row' },
              justifyContent: 'flex-end',
            }}
          >
            <Button
              component={RouterLink}
              href={paths.admin.user.root}
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
              disabled={masterItemsQuery.isLoading || userQuery.isLoading || userQuery.isError}
              startIcon={
                <RemixIcon icon={isEdit ? 'solar:diskette-bold' : 'solar:user-plus-bold'} />
              }
              sx={{ minWidth: 190 }}
            >
              {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มครู/บุคลากร'}
            </Button>
          </Box>
        </Box>
      </Form>
    </Container>
  );
}

const fieldGridSx = {
  gap: 2.5,
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
};

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6">{title}</Typography>
      <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
        {description}
      </Typography>
    </Box>
  );
}
