import type { ReactNode } from 'react';
import type { Theme, SxProps } from '@mui/material/styles';
import type { TypographyProps } from '@mui/material/Typography';

import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

export type TitleTypographyProps = {
  children?: ReactNode;
  variant?: TypographyProps['variant'];
  sx?: SxProps<Theme>;
  height?: number;
};

export function TitleTypography({
  children = 'สร้างแม่แบบเอกสาร',
  variant = 'h3',
  height = 8,
  sx,
}: TitleTypographyProps) {
  return (
    <Typography
      variant={variant}
      sx={[
        {
          display: 'inline-block',
          width: 'fit-content',
          position: 'relative',
          isolation: 'isolate',
          fontFamily: (theme) => theme.typography.fontFamily,
          '&::after': {
            position: 'absolute',
            zIndex: -1,
            right: 0,
            bottom: 6,
            left: 0,
            height,
            bgcolor: (theme) => theme.palette.warning.main,
            borderRadius: 1,
            content: '""',
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Typography>
  );
}
