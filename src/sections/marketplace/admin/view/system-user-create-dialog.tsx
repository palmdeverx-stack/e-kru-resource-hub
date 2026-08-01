'use client';

import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';

import { Form, RHFTextField } from 'src/components/hook-form';
import { RiEyeLine, RiEyeOffLine } from 'src/components/remix-icon';

const SystemUserCreateSchema = z
  .object({
    role: z.enum(['super_admin', 'master_admin']),
    firstName: z.string().trim().min(1, { error: 'กรุณากรอกชื่อ' }),
    lastName: z.string().trim().min(1, { error: 'กรุณากรอกนามสกุล' }),
    username: z
      .string()
      .trim()
      .min(3, { error: 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร' })
      .max(40, { error: 'ชื่อผู้ใช้ต้องไม่เกิน 40 ตัวอักษร' })
      .regex(/^[a-zA-Z0-9._-]+$/, {
        error: 'ใช้ได้เฉพาะ a-z, 0-9, จุด ขีดกลาง หรือขีดล่าง',
      }),
    email: z.email({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }),
    password: z.string().min(8, { error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }),
    confirmPassword: z.string().min(1, { error: 'กรุณายืนยันรหัสผ่าน' }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    error: 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน',
  });

type SystemUserCreateValues = z.infer<typeof SystemUserCreateSchema>;

const defaultValues: SystemUserCreateValues = {
  role: 'super_admin',
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (message: string) => void | Promise<void>;
};

export function SystemUserCreateDialog({ open, onClose, onCreated }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const methods = useForm<SystemUserCreateValues>({
    resolver: zodResolver(SystemUserCreateSchema),
    defaultValues,
    mode: 'onBlur',
  });
  const {
    reset,
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;
  const role = watch('role');

  const close = () => {
    if (isSubmitting) return;
    reset(defaultValues);
    setSubmitError('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    setSubmitError('');
    try {
      const response = await fetch('/api/admin/system-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      await onCreated(result.message);
      reset(defaultValues);
      setShowPassword(false);
      setShowConfirmPassword(false);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'สร้างบัญชีไม่สำเร็จ');
    }
  });

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>สร้างบัญชีผู้ดูแลระบบ</DialogTitle>
      <Form methods={methods} onSubmit={submit}>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            {!!submitError && <Alert severity="error">{submitError}</Alert>}
            <RHFTextField name="role" select required label="สิทธิ์บัญชี">
              <MenuItem value="super_admin">Admin</MenuItem>
              <MenuItem value="master_admin">Master Admin</MenuItem>
            </RHFTextField>
            {role === 'master_admin' && (
              <Alert severity="warning">
                Master Admin มีสิทธิ์สูงสุด รวมถึงการสร้างและจัดการบัญชีผู้ดูแลระบบอื่น
              </Alert>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <RHFTextField name="firstName" required label="ชื่อ" />
              <RHFTextField name="lastName" required label="นามสกุล" />
            </Stack>
            <RHFTextField
              name="username"
              required
              label="ชื่อผู้ใช้งาน"
              helperText="3–40 ตัวอักษร: a-z, 0-9, จุด ขีดกลาง หรือขีดล่าง"
              slotProps={{ htmlInput: { maxLength: 40 } }}
            />
            <RHFTextField name="email" required type="email" label="อีเมล" />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <RHFTextField
                name="password"
                required
                type={showPassword ? 'text' : 'password'}
                label="รหัสผ่าน"
                helperText="อย่างน้อย 8 ตัวอักษร"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                          onClick={() => setShowPassword((current) => !current)}
                        >
                          {showPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <RHFTextField
                name="confirmPassword"
                required
                type={showConfirmPassword ? 'text' : 'password'}
                label="ยืนยันรหัสผ่าน"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          aria-label={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                          onClick={() => setShowConfirmPassword((current) => !current)}
                        >
                          {showConfirmPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" disabled={isSubmitting} onClick={close}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="contained" loading={isSubmitting}>
            สร้างบัญชี
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
