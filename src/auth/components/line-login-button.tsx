'use client';

import { RiLineFill } from '@remixicon/react';

import Button from '@mui/material/Button';

import { useTranslate } from 'src/locales';

export function LineLoginButton({ returnTo }: { returnTo?: string | null }) {
  const { t } = useTranslate();
  if (!process.env.NEXT_PUBLIC_LIFF_ID) return null;
  const destination = `/auth/line${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
  return (
    <Button
      fullWidth
      href={destination}
      variant="outlined"
      startIcon={<RiLineFill size={20} aria-hidden="true" />}
      sx={{
        mt: 1.5,
        mx: 'auto',
        display: 'flex',
        position: 'relative',
        maxWidth: 400,
        height: 40,
        px: 5,
        borderRadius: '4px',
        borderColor: '#dadce0',
        bgcolor: '#fff',
        color: '#3c4043',
        fontSize: 14,
        fontWeight: 500,
        '& .MuiButton-startIcon': {
          position: 'absolute',
          left: 12,
          m: 0,
          color: '#06C755',
        },
        '&:hover': {
          borderColor: '#dadce0',
          bgcolor: '#f8faf9',
        },
      }}
    >
      {t('auth.social.line')}
    </Button>
  );
}
