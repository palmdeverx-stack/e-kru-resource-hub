'use client';

import type { ButtonProps } from '@mui/material/Button';

import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export function SignInButton({ sx, ...other }: ButtonProps) {
  const { t } = useTranslate();
  const { authenticated, loading } = useAuthContext();

  if (loading || authenticated) {
    return null;
  }

  return (
    <Button
      component={RouterLink}
      href={paths.auth.jwt.signIn}
      variant="outlined"
      sx={sx}
      {...other}
    >
      {t('actions.signIn')}
    </Button>
  );
}
