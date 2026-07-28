'use client';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';
import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { signUp } from '../../context/jwt';
import { getErrorMessage } from '../../utils';
import { FormHead } from '../../components/form-head';
import { SignUpTerms } from '../../components/sign-up-terms';

// ----------------------------------------------------------------------

export type SignUpSchemaType = z.infer<typeof SignUpSchema>;

export const SignUpSchema = z.object({
  firstName: z.string().min(1, { error: 'กรุณากรอกชื่อ!' }),
  lastName: z.string().min(1, { error: 'กรุณากรอกนามสกุล!' }),
  username: z.string().min(1, { error: 'กรุณากรอกชื่อผู้ใช้งาน!' }),
  email: z.email({ error: 'กรุณากรอกอีเมลที่ถูกต้อง!' }),
  password: z
    .string()
    .min(1, { error: 'กรุณากรอกรหัสผ่าน!' })
    .min(8, { error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร!' }),
});

// ----------------------------------------------------------------------

export function JwtSignUpView() {
  const router = useRouter();

  const showPassword = useBoolean();

  const defaultValues: SignUpSchemaType = {
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
  };

  const methods = useForm({
    resolver: zodResolver(SignUpSchema),
    defaultValues,
  });

  const { handleSubmit } = methods;

  const signUpMutation = useMutation({
    mutationFn: signUp,
    onSuccess: async (result) => {
      router.replace(`/auth/verify-email?email=${encodeURIComponent(result.email)}`);
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    signUpMutation.mutate({
      username: data.username,
      password: data.password,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
    });
  });

  const errorMessage = signUpMutation.error ? getErrorMessage(signUpMutation.error) : null;

  const renderForm = () => (
    <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{ display: 'flex', gap: { xs: 3, sm: 2 }, flexDirection: { xs: 'column', sm: 'row' } }}
      >
        <Field.Text name="firstName" label="ชื่อ" slotProps={{ inputLabel: { shrink: true } }} />
        <Field.Text name="lastName" label="นามสกุล" slotProps={{ inputLabel: { shrink: true } }} />
      </Box>

      <Field.Text
        name="username"
        label="ชื่อผู้ใช้งาน"
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <Field.Text name="email" label="อีเมล" slotProps={{ inputLabel: { shrink: true } }} />

      <Field.Text
        name="password"
        label="รหัสผ่าน"
        placeholder="8 ตัวอักษรขึ้นไป"
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

      <Button
        fullWidth
        color="inherit"
        size="large"
        type="submit"
        variant="contained"
        loading={signUpMutation.isPending}
        loadingIndicator="กำลังสร้างบัญชี..."
      >
        สร้างบัญชี
      </Button>
    </Box>
  );

  return (
    <>
      <FormHead
        title="สมัคร eKru Marketplace"
        description={
          <>
            {`สร้างบัญชีเพื่อซื้อหรือเปิดร้านขายสื่อการสอน · มีบัญชีอยู่แล้ว? `}
            <Link component={RouterLink} href={paths.auth.jwt.signIn} variant="subtitle2">
              เข้าสู่ระบบ
            </Link>
          </>
        }
        sx={{ textAlign: { xs: 'center', md: 'left' } }}
      />

      {!!errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      <Form methods={methods} onSubmit={onSubmit}>
        {renderForm()}
      </Form>

      <SignUpTerms />
    </>
  );
}
