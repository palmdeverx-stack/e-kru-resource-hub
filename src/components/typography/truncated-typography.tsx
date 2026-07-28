import type { TypographyProps } from '@mui/material';

import { Typography } from '@mui/material';

type TruncatedTypographyProps = TypographyProps & {
  line?: number;
};

export function TruncatedTypography({
  children,
  line = 1,
  sx,
  ...other
}: TruncatedTypographyProps) {
  return (
    <Typography
      sx={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        WebkitBoxOrient: 'vertical',
        ...(line === 1
          ? {
              display: 'block',
              whiteSpace: 'nowrap',
            }
          : {
              display: '-webkit-box',
              WebkitLineClamp: line,
            }),
        ...sx,
      }}
      {...other}
    >
      {children}
    </Typography>
  );
}
