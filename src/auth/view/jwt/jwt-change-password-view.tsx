'use client';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';
import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';

import Alert from '@mui/material/Alert';
import { Box, Card } from '@mui/material';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

import { useRouter } from 'src/routes/hooks';

import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from '../../hooks';
import { getErrorMessage } from '../../utils';
import { FormHead } from '../../components/form-head';
import { signOut, changePassword } from '../../context/jwt';
import { getHomePathForRole } from '../../utils/role-home-path';

// ----------------------------------------------------------------------

export type ChangePasswordSchemaType = z.infer<typeof ChangePasswordSchema>;

export const ChangePasswordSchema = z
  .object({
    newPassword: z.string().min(6, { error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร!' }),
    confirmPassword: z.string().min(1, { error: 'กรุณายืนยันรหัสผ่านใหม่!' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    error: 'รหัสผ่านใหม่ไม่ตรงกัน!',
  });

// ----------------------------------------------------------------------

export function JwtChangePasswordView() {
  const router = useRouter();

  const showPassword = useBoolean();

  const { user, checkUserSession } = useAuthContext();

  const signOutMutation = useMutation({
    mutationFn: async () => {
      await signOut();
      await checkUserSession?.();
    },
  });

  const methods = useForm({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const { handleSubmit } = methods;

  const changePasswordMutation = useMutation({
    mutationFn: (data: ChangePasswordSchemaType) => changePassword(data.newPassword),
    onSuccess: async () => {
      await checkUserSession?.();
      router.replace(getHomePathForRole(user?.role));
    },
  });

  const onSubmit = handleSubmit((data) => changePasswordMutation.mutate(data));

  const errorMessage = changePasswordMutation.error
    ? getErrorMessage(changePasswordMutation.error)
    : null;

  return (
    <Card sx={{ p: 3 }}>
      <FormHead
        title="ตั้งรหัสผ่านใหม่"
        description="เพื่อความปลอดภัย กรุณาตั้งรหัสผ่านใหม่ก่อนเข้าใช้งานระบบ"
        sx={{ textAlign: { xs: 'center', md: 'left' } }}
      />

      {!!errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      <Form methods={methods} onSubmit={onSubmit}>
        <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
          <Field.Text
            name="newPassword"
            label="รหัสผ่านใหม่"
            placeholder="6 ตัวอักษรขึ้นไป"
            type={showPassword.value ? 'text' : 'password'}
            slotProps={{
              inputLabel: { shrink: true },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={showPassword.onToggle} edge="end">
                      <RemixIcon
                        icon={showPassword.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'}
                      />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <Field.Text
            name="confirmPassword"
            label="ยืนยันรหัสผ่านใหม่"
            type={showPassword.value ? 'text' : 'password'}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <Button
            fullWidth
            color="inherit"
            size="large"
            type="submit"
            variant="contained"
            loading={changePasswordMutation.isPending}
            loadingIndicator="กำลังบันทึก..."
          >
            บันทึกรหัสผ่านใหม่
          </Button>

          <Button
            fullWidth
            type="button"
            color="inherit"
            size="large"
            variant="text"
            loading={signOutMutation.isPending}
            onClick={() => signOutMutation.mutate()}
          >
            ไม่ใช่บัญชีของฉัน ออกจากระบบ
          </Button>
        </Box>
      </Form>
    </Card>
  );
}
