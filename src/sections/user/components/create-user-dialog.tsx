'use client';

import type { UserRow } from '../user-actions';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { Box, Stack } from '@mui/material';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';

import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { listStaffMasterItems } from 'src/sections/staff-master/staff-master-actions';

import { STAFF_TYPES, EMPLOYMENT_STATUSES } from 'src/types/staff-employment';

import { createUser, updateStaffUser } from '../user-actions';

// ----------------------------------------------------------------------

const CreateSchema = z
  .object({
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
    role: z.enum(['teacher', 'student']),
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

type CreateFormValues = z.infer<typeof CreateSchema>;

export function generatePassword(length = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);

  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

type Props = {
  open: boolean;
  isStudentMode: boolean;
  user?: UserRow | null;
  onClose: () => void;
};

export function CreateUserDialog({ open, isStudentMode, user = null, onClose }: Props) {
  const isEdit = !!user;
  const [showPassword, setShowPassword] = useState(false);
  const queryClient = useQueryClient();
  const masterItemsQuery = useQuery({
    queryKey: ['staff-master-items'],
    queryFn: listStaffMasterItems,
    enabled: open && !isStudentMode,
  });
  const activeMasterItems = (
    category: 'staff_type' | 'position' | 'academic_rank' | 'employment_status'
  ) =>
    (masterItemsQuery.data ?? []).filter(
      (item) =>
        item.category === category &&
        (item.is_active ||
          item.code === user?.staff_type ||
          item.code === user?.employment_status ||
          item.name === user?.position_title ||
          item.name === user?.academic_rank)
    );

  const methods = useForm<CreateFormValues>({
    resolver: zodResolver(CreateSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      firstNameEn: '',
      lastNameEn: '',
      username: '',
      email: '',
      password: '',
      role: (isStudentMode ? 'student' : 'teacher') as 'student' | 'teacher',
      staffType: 'teacher',
      employmentStatus: 'active',
      employmentStartDate: '',
      appointmentDate: '',
      contractEndDate: '',
      positionTitle: '',
      academicRank: '',
    },
  });
  const { handleSubmit, reset, setValue } = methods;

  const createMutation = useMutation({
    mutationFn: (params: Parameters<typeof createUser>[0]) =>
      isEdit ? updateStaffUser(user.id, params) : createUser(params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
      reset();
    },
  });

  useEffect(() => {
    if (!open) return;

    reset(
      user
        ? {
            firstName: user.first_name ?? '',
            lastName: user.last_name ?? '',
            firstNameEn: user.first_name_en ?? '',
            lastNameEn: user.last_name_en ?? '',
            username: user.username,
            email: user.email ?? '',
            password: '',
            role: 'teacher',
            staffType: user.staff_type ?? 'teacher',
            employmentStatus: user.employment_status ?? 'active',
            employmentStartDate: user.employment_start_date ?? '',
            appointmentDate: user.appointment_date ?? '',
            contractEndDate: user.contract_end_date ?? '',
            positionTitle: user.position_title ?? '',
            academicRank: user.academic_rank ?? '',
          }
        : {
            firstName: '',
            lastName: '',
            firstNameEn: '',
            lastNameEn: '',
            username: '',
            email: '',
            password: generatePassword(),
            role: isStudentMode ? 'student' : 'teacher',
            staffType: 'teacher',
            employmentStatus: 'active',
            employmentStartDate: '',
            appointmentDate: '',
            contractEndDate: '',
            positionTitle: '',
            academicRank: '',
          }
    );
    setShowPassword(false);
    createMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isStudentMode, reset, user]);

  const closeDialog = () => {
    if (createMutation.isPending) return;
    onClose();
    setShowPassword(false);
    reset();
    createMutation.reset();
  };

  const onSubmit = handleSubmit((data) =>
    createMutation.mutate({
      ...data,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      firstNameEn: data.firstNameEn.trim() || undefined,
      lastNameEn: data.lastNameEn.trim() || undefined,
      username: data.username.trim(),
      email: data.email || undefined,
      password: data.password || (isEdit ? undefined : generatePassword()),
      role: isStudentMode ? 'student' : 'teacher',
      positionTitle: data.positionTitle.trim() || undefined,
      academicRank: data.academicRank.trim() || undefined,
    })
  );

  return (
    <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="md">
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography component="h2" variant="h6">
                {isEdit ? 'แก้ไขครู/บุคลากร' : isStudentMode ? 'เพิ่มนักเรียน' : 'เพิ่มครู/บุคลากร'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                {isEdit
                  ? 'แก้ไขข้อมูลบัญชีและกำหนดรหัสผ่านใหม่'
                  : isStudentMode
                    ? 'สร้างบัญชีนักเรียนใหม่'
                    : 'สร้างบัญชีใหม่สำหรับบุคลากรหรือครู'}
              </Typography>
            </Box>
            <Box>
              <IconButton
                onClick={closeDialog}
                disabled={createMutation.isPending}
                aria-label="ปิดหน้าต่าง"
              >
                <RemixIcon icon="mingcute:close-line" />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack>
            {createMutation.error && (
              <Alert severity="error" sx={{ mb: 2.5 }}>
                {createMutation.error.message}
              </Alert>
            )}

            <Box
              sx={{
                gap: 1.5,
                p: 2,
                display: 'flex',
                borderRadius: 2,
                alignItems: 'center',
                bgcolor: 'background.neutral',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <RemixIcon
                icon={isStudentMode ? 'solar:user-rounded-bold' : 'solar:users-group-rounded-bold'}
                width={26}
              />
              <Box>
                <Typography variant="subtitle2">
                  ประเภทบัญชี: {isStudentMode ? 'นักเรียน' : 'ครู'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  กำหนดให้อัตโนมัติตามหน้าที่กำลังจัดการ
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                mt: 2,
                gap: 2.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              }}
            >
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
              <Field.Text
                name="username"
                label="ชื่อผู้ใช้งาน *"
                helperText="ใช้สำหรับเข้าสู่ระบบ"
              />
              <Field.Text name="email" label="อีเมล" helperText="ไม่บังคับ" />
              <Box>
                <Field.Text
                  name="password"
                  label={isEdit ? 'รหัสผ่านใหม่ (ไม่บังคับ)' : 'รหัสผ่าน (ระบบสร้างให้)'}
                  type={showPassword ? 'text' : 'password'}
                  helperText={
                    isEdit
                      ? 'เว้นว่างหากไม่ต้องการเปลี่ยนรหัสผ่าน'
                      : 'ไม่บังคับ หากเว้นว่างระบบจะสร้างรหัสผ่านให้อัตโนมัติ — ผู้ใช้งานต้องเปลี่ยนรหัสผ่านนี้ตอนเข้าสู่ระบบครั้งแรก'
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
                    setShowPassword(false);
                  }}
                  sx={{ mt: 0.75 }}
                >
                  สร้างรหัสผ่านใหม่
                </Button>
              </Box>
            </Box>

            {!isStudentMode && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  ข้อมูลการทำงาน
                </Typography>
                <Box
                  sx={{
                    gap: 2.5,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                  }}
                >
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
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={closeDialog} disabled={createMutation.isPending}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="contained" loading={createMutation.isPending}>
            {isEdit ? 'บันทึกการแก้ไข' : isStudentMode ? 'เพิ่มนักเรียน' : 'เพิ่มครู/บุคลากร'}
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
