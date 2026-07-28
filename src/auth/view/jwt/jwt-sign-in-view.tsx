'use client';

import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';
import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

import { useRouter } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';

import { Image } from 'src/components/image';
import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from '../../hooks';
import { FormHead } from '../../components/form-head';
import { getErrorMessage, getHomePathForRole } from '../../utils';
import { verifySignInPin, signInWithPassword } from '../../context/jwt';

// ----------------------------------------------------------------------

export type SignInSchemaType = z.infer<typeof SignInSchema>;

export const SignInSchema = z.object({
  username: z.string().min(1, { error: 'กรุณากรอกชื่อผู้ใช้งาน!' }),
  password: z
    .string()
    .min(1, { error: 'กรุณากรอกรหัสผ่าน!' })
    .min(6, { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร!' }),
  pin: z.string().refine((value) => value === '' || /^\d{8}$/.test(value), {
    error: 'PIN ต้องเป็นตัวเลข 8 หลัก',
  }),
});

// ----------------------------------------------------------------------

export function JwtSignInView() {
  const router = useRouter();

  const showPassword = useBoolean();
  const [pinChallenge, setPinChallenge] = useState<{
    token: string;
    role: 'master_admin' | 'school_admin';
  } | null>(null);

  const { checkUserSession } = useAuthContext();

  const defaultValues: SignInSchemaType = {
    username: '',
    password: '',
    pin: '',
  };

  const methods = useForm({
    resolver: zodResolver(SignInSchema),
    defaultValues,
    reValidateMode: 'onBlur',
  });

  const { handleSubmit } = methods;

  const signInMutation = useMutation({
    mutationFn: signInWithPassword,
    onSuccess: async (result) => {
      if ('requiresPin' in result) {
        setPinChallenge({ token: result.pinChallengeToken, role: result.role });
        return;
      }

      await checkUserSession?.();

      router.replace(getHomePathForRole(result.role));
    },
  });

  const verifyPinMutation = useMutation({
    mutationFn: verifySignInPin,
    onSuccess: async (user) => {
      await checkUserSession?.();

      router.replace(getHomePathForRole(user.role));
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    if (pinChallenge) {
      if (!/^\d{8}$/.test(data.pin)) {
        methods.setError('pin', { message: 'PIN ต้องเป็นตัวเลข 8 หลัก' });
        return;
      }
      verifyPinMutation.mutate({ pinChallengeToken: pinChallenge.token, pin: data.pin });
      return;
    }

    signInMutation.mutate({ username: data.username, password: data.password });
  });

  const error = pinChallenge ? verifyPinMutation.error : signInMutation.error;
  const errorMessage = error ? getErrorMessage(error) : null;

  const renderForm = () => (
    <Box sx={{ gap: 2.5, display: 'flex', flexDirection: 'column' }}>
      {!pinChallenge ? (
        <>
          <Field.Text
            name="username"
            label="ชื่อผู้ใช้งาน"
            placeholder="กรอกชื่อผู้ใช้งาน"
            slotProps={{
              inputLabel: { shrink: true },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <RemixIcon icon="solar:user-rounded-bold" width={22} />
                  </InputAdornment>
                ),
              },
            }}
          />

          <Box sx={{ gap: 1.5, display: 'flex', flexDirection: 'column' }}>
            <Field.Text
              name="password"
              label="รหัสผ่าน"
              placeholder="6 ตัวอักษรขึ้นไป"
              type={showPassword.value ? 'text' : 'password'}
              slotProps={{
                inputLabel: { shrink: true },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <RemixIcon icon="solar:lock-password-outline" width={22} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={showPassword.onToggle}
                        edge="end"
                        aria-label={showPassword.value ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                      >
                        <RemixIcon
                          icon={showPassword.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'}
                        />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
        </>
      ) : (
        <Field.Code
          name="pin"
          length={8}
          gap={1}
          maxSize={40}
          autoFocus
          validateChar={(character) => /^\d$/.test(character)}
          slotProps={{ textField: { inputMode: 'numeric' } }}
        />
      )}

      <Button
        fullWidth
        color="primary"
        size="large"
        type="submit"
        variant="contained"
        loading={signInMutation.isPending || verifyPinMutation.isPending}
        loadingIndicator={pinChallenge ? 'กำลังตรวจสอบ PIN...' : 'กำลังเข้าสู่ระบบ...'}
        sx={(theme) => ({
          mt: 1,
          py: 1.4,
          fontSize: 16,
          color: 'common.white',
          background: `linear-gradient(135deg, ${theme.vars.palette.primary.main} 0%, ${theme.vars.palette.primary.dark} 100%)`,
          boxShadow: theme.customShadows.primary,
          '&:hover': {
            background: `linear-gradient(135deg, ${theme.vars.palette.primary.dark} 0%, ${theme.vars.palette.primary.darker} 100%)`,
            boxShadow: theme.customShadows.z16,
          },
        })}
      >
        {pinChallenge ? 'ยืนยัน PIN' : 'เข้าสู่ระบบ'}
      </Button>

      {pinChallenge && (
        <Button
          color="inherit"
          onClick={() => {
            setPinChallenge(null);
            methods.setValue('pin', '');
            verifyPinMutation.reset();
          }}
        >
          กลับไปกรอกชื่อผู้ใช้งาน
        </Button>
      )}
    </Box>
  );

  return (
    <Box sx={{ width: 1, color: 'text.primary' }}>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', mb: 2 }}>
        <Image src={`${CONFIG.assetsDir}/logo/logo-tran-ver.svg`} />
      </Box>

      <Chip
        color="primary"
        variant="soft"
        label="eKru Marketplace"
        sx={{ mb: 2, fontWeight: 700 }}
      />

      <FormHead
        title={pinChallenge ? 'ยืนยัน PIN' : 'เข้าสู่ Marketplace'}
        description={
          pinChallenge?.role === 'school_admin'
            ? 'กรอกรหัสโรงเรียน 8 หลักเพื่อเข้าสู่ระบบ'
            : pinChallenge
              ? 'กรอก PIN ผู้ดูแลระบบ 8 หลักเพื่อเข้าสู่ระบบ'
              : 'ซื้อและขายสื่อการสอนด้วยบัญชี eKru เดิม หรือบัญชี Marketplace ของคุณ'
        }
        sx={{ mt: 0.5, mb: 3, textAlign: 'left' }}
      />

      {!!errorMessage && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {errorMessage}
        </Alert>
      )}

      <Form methods={methods} onSubmit={onSubmit}>
        {renderForm()}
      </Form>
    </Box>
  );
}
