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
import { RouterLink } from 'src/routes/components';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { useTranslate } from 'src/locales';

import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from '../../hooks';
import { FormHead } from '../../components/form-head';
import { FormDivider } from '../../components/form-divider';
import { getErrorMessage, getHomePathForRole } from '../../utils';
import { MarketplaceAuthBrand } from '../../components/marketplace-auth-brand';
import { verifySignInPin, signInWithGoogle, signInWithPassword } from '../../context/jwt';

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
  const { t } = useTranslate();
  const searchParams = useSearchParams();
  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo =
    requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
      ? requestedReturnTo
      : null;

  const showPassword = useBoolean();
  const [pinChallenge, setPinChallenge] = useState<{
    token: string;
    role: 'master_admin' | 'school_admin';
  } | null>(null);

  const { setSessionUser } = useAuthContext();

  const defaultValues: SignInSchemaType = {
    username: '',
    password: '',
    pin: '',
  };

  const localizedSchema = useMemo(
    () =>
      z.object({
        username: z.string().min(1, { error: t('auth.validation.usernameRequired') }),
        password: z
          .string()
          .min(1, { error: t('auth.validation.passwordRequired') })
          .min(6, { error: t('auth.validation.passwordMin6') }),
        pin: z.string().refine((value) => value === '' || /^\d{8}$/.test(value), {
          error: t('auth.validation.pinInvalid'),
        }),
      }),
    [t]
  );

  const methods = useForm({
    resolver: zodResolver(localizedSchema),
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

      const destination = returnTo ?? getHomePathForRole(result.role);
      setSessionUser?.(result);
      router.prefetch(destination);
      router.replace(destination);
    },
  });

  const verifyPinMutation = useMutation({
    mutationFn: verifySignInPin,
    onSuccess: async (user) => {
      const destination = returnTo ?? getHomePathForRole(user.role);
      setSessionUser?.(user);
      router.prefetch(destination);
      router.replace(destination);
    },
  });

  const googleMutation = useMutation({
    mutationFn: () => signInWithGoogle(returnTo),
  });

  const onSubmit = handleSubmit(async (data) => {
    if (pinChallenge) {
      if (!/^\d{8}$/.test(data.pin)) {
        methods.setError('pin', { message: t('auth.validation.pinInvalid') });
        return;
      }
      verifyPinMutation.mutate({ pinChallengeToken: pinChallenge.token, pin: data.pin });
      return;
    }

    signInMutation.mutate({ username: data.username, password: data.password });
  });

  const error = pinChallenge
    ? verifyPinMutation.error
    : (googleMutation.error ?? signInMutation.error);
  const errorMessage = error ? getErrorMessage(error) : null;

  const renderForm = () => (
    <Box sx={{ gap: 2.5, display: 'flex', flexDirection: 'column' }}>
      {!pinChallenge ? (
        <>
          <Field.Text
            name="username"
            label={t('auth.fields.username')}
            placeholder={t('auth.placeholders.username')}
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
              label={t('auth.fields.password')}
              placeholder={t('auth.placeholders.password6')}
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
        loadingIndicator={
          pinChallenge ? t('auth.signIn.verifyingPin') : t('auth.signIn.submitting')
        }
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
        {pinChallenge ? t('auth.signIn.verifyPin') : t('auth.signIn.submit')}
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
          {t('auth.signIn.backToCredentials')}
        </Button>
      )}
    </Box>
  );

  return (
    <Box sx={{ width: 1, color: 'text.primary' }}>
      <MarketplaceAuthBrand />

      <FormHead
        title={pinChallenge ? t('auth.signIn.pinTitle') : t('auth.signIn.title')}
        description={
          pinChallenge?.role === 'school_admin' ? (
            t('auth.signIn.schoolPinDescription')
          ) : pinChallenge ? (
            t('auth.signIn.adminPinDescription')
          ) : (
            <>
              {t('auth.signIn.description')}
              <br />
              {t('auth.signIn.noAccount')}{' '}
              <Link component={RouterLink} href={paths.auth.jwt.signUp} variant="subtitle2">
                {t('auth.signIn.createAccount')}
              </Link>
            </>
          )
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

      {!pinChallenge && (
        <>
          <FormDivider label={t('auth.signIn.divider')} />
          <Button
            fullWidth
            size="large"
            color="inherit"
            variant="outlined"
            loading={googleMutation.isPending}
            startIcon={<RemixIcon width={22} icon="socials:google" />}
            onClick={() => googleMutation.mutate()}
            sx={{ py: 1.35, bgcolor: 'background.paper' }}
          >
            {t('auth.signIn.google')}
          </Button>
        </>
      )}
    </Box>
  );
}
