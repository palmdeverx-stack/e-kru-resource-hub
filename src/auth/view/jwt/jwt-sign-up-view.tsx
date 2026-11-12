'use client';

import * as z from 'zod';
import { useMemo, useState } from 'react';
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

import { useTranslate } from 'src/locales';

import { Logo } from 'src/components/logo';
import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from '../../hooks';
import { FormHead } from '../../components/form-head';
import { FormDivider } from '../../components/form-divider';
import { signUp, signInWithGoogle } from '../../context/jwt';
import { SignUpTerms } from '../../components/sign-up-terms';
import { getErrorMessage, getHomePathForRole } from '../../utils';
import { LineLoginButton } from '../../components/line-login-button';
import { GoogleIdentityButton } from '../../components/google-identity-button';

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
  const { setSessionUser } = useAuthContext();
  const { t, currentLang } = useTranslate();
  const [googleClientError, setGoogleClientError] = useState<Error | null>(null);

  const showPassword = useBoolean();

  const defaultValues: SignUpSchemaType = {
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
  };

  const localizedSchema = useMemo(
    () =>
      z.object({
        firstName: z.string().min(1, { error: t('auth.validation.firstNameRequired') }),
        lastName: z.string().min(1, { error: t('auth.validation.lastNameRequired') }),
        username: z.string().min(1, { error: t('auth.validation.usernameRequired') }),
        email: z.email({ error: t('auth.validation.emailInvalid') }),
        password: z
          .string()
          .min(1, { error: t('auth.validation.passwordRequired') })
          .min(8, { error: t('auth.validation.passwordMin8') }),
      }),
    [t]
  );

  const methods = useForm({
    resolver: zodResolver(localizedSchema),
    defaultValues,
  });

  const { handleSubmit } = methods;

  const signUpMutation = useMutation({
    mutationFn: signUp,
    onSuccess: async (result) => {
      router.replace(`/auth/verify-email?email=${encodeURIComponent(result.email)}`);
    },
  });

  const googleMutation = useMutation({
    mutationFn: signInWithGoogle,
    onSuccess: async (result) => {
      if ('requiresPin' in result) {
        setGoogleClientError(
          new Error('บัญชีผู้ดูแลระบบต้องเข้าสู่ระบบผ่านหน้าเข้าสู่ระบบเพื่อยืนยัน PIN')
        );
        return;
      }

      setSessionUser?.(result);
      const destination = getHomePathForRole(result.role);
      router.prefetch(destination);
      router.replace(destination);
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

  const authError = googleClientError ?? googleMutation.error ?? signUpMutation.error;
  const errorMessage = authError ? getErrorMessage(authError) : null;

  const renderForm = () => (
    <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Field.Text
          name="firstName"
          size="small"
          autoComplete="given-name"
          sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
          label={t('auth.fields.firstName')}
          placeholder={t('auth.placeholders.firstName')}
          slotProps={{
            inputLabel: { shrink: true },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <RemixIcon icon="solar:user-rounded-bold" width={21} />
                </InputAdornment>
              ),
            },
          }}
        />
        <Field.Text
          name="lastName"
          size="small"
          autoComplete="family-name"
          sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
          label={t('auth.fields.lastName')}
          placeholder={t('auth.placeholders.lastName')}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>

      <Field.Text
        name="username"
        size="small"
        autoComplete="username"
        sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
        label={t('auth.fields.username')}
        placeholder={t('auth.placeholders.newUsername')}
        slotProps={{
          inputLabel: { shrink: true },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <RemixIcon icon="solar:user-id-outline" width={21} />
              </InputAdornment>
            ),
          },
        }}
      />

      <Field.Text
        name="email"
        size="small"
        autoComplete="email"
        sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
        label={t('auth.fields.email')}
        placeholder={t('auth.placeholders.email')}
        slotProps={{
          inputLabel: { shrink: true },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <RemixIcon icon="solar:letter-outline" width={21} />
              </InputAdornment>
            ),
          },
        }}
      />

      <Field.Text
        name="password"
        size="small"
        autoComplete="new-password"
        sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
        label={t('auth.fields.password')}
        placeholder={t('auth.placeholders.password8')}
        type={showPassword.value ? 'text' : 'password'}
        slotProps={{
          inputLabel: { shrink: true },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <RemixIcon icon="solar:lock-password-outline" width={21} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={showPassword.onToggle}
                  edge="end"
                  aria-label={
                    showPassword.value
                      ? t('auth.accessibility.hidePassword')
                      : t('auth.accessibility.showPassword')
                  }
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

      <Button
        fullWidth
        color="primary"
        size="large"
        type="submit"
        variant="contained"
        loading={signUpMutation.isPending}
        loadingIndicator={t('auth.signUp.submitting')}
        sx={(theme) => ({
          minHeight: 44,
          py: 1,
          fontSize: 15,
          color: 'common.white',
          background: `linear-gradient(135deg, ${theme.vars.palette.primary.main} 0%, ${theme.vars.palette.primary.dark} 100%)`,
          boxShadow: theme.customShadows.primary,
          '&:hover': {
            background: `linear-gradient(135deg, ${theme.vars.palette.primary.dark} 0%, ${theme.vars.palette.primary.darker} 100%)`,
            boxShadow: theme.customShadows.z16,
          },
        })}
      >
        {t('auth.signUp.submit')}
      </Button>
    </Box>
  );

  return (
    <Box
      sx={{
        width: 1,
        color: 'text.primary',
        '&& .MuiButton-root': { borderRadius: '4px' },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Logo
          isSingle={false}
          sx={{ width: 220, height: 104, '& img': { objectPosition: 'center' } }}
        />
      </Box>

      <FormHead
        title={t('auth.signUp.title')}
        description={
          <>
            {t('auth.signUp.hasAccount')}{' '}
            <Link component={RouterLink} href={paths.auth.jwt.signIn} variant="subtitle2">
              {t('auth.signUp.goToSignIn')}
            </Link>
          </>
        }
        sx={{ mb: 2.5, gap: 0.75, textAlign: 'center' }}
      />

      {!!errorMessage && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {errorMessage}
        </Alert>
      )}

      <Form methods={methods} onSubmit={onSubmit}>
        {renderForm()}
      </Form>

      <FormDivider label={t('auth.signUp.divider')} sx={{ my: 2 }} />
      <Box sx={{ width: 1, maxWidth: 400, mx: 'auto' }}>
        <GoogleIdentityButton
          mode="signup"
          language={currentLang.value === 'en' ? 'en' : 'th'}
          disabled={googleMutation.isPending}
          onCredential={(credential) => {
            setGoogleClientError(null);
            googleMutation.mutate(credential);
          }}
          onError={setGoogleClientError}
        />

        <LineLoginButton />
      </Box>
      <SignUpTerms />
    </Box>
  );
}
