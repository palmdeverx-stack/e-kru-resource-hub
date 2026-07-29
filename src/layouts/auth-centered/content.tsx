'use client';

import type { BoxProps } from '@mui/material/Box';

import { mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';

import { layoutClasses } from '../core';

// ----------------------------------------------------------------------

export type AuthCenteredContentProps = BoxProps;

export function AuthCenteredContent({
  sx,
  children,
  className,
  ...other
}: AuthCenteredContentProps) {
  return (
    <Box
      className={mergeClasses([layoutClasses.content, className])}
      sx={[
        (theme) => ({
          py: { xs: 3, sm: 4 },
          px: { xs: 2.5, sm: 4 },
          width: 1,
          zIndex: 2,
          border: `1px solid ${theme.vars.palette.divider}`,
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 'var(--layout-auth-content-width)',
          bgcolor: theme.vars.palette.background.default,
          boxShadow: theme.customShadows.z16,
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {children}
    </Box>
  );
}
