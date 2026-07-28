import type { LinkProps } from '@mui/material/Link';

import Link from '@mui/material/Link';

import { RouterLink } from 'src/routes/components';

import { RemixIcon, remixIconClasses } from '../remix-icon';

// ----------------------------------------------------------------------

export type BackLinkProps = LinkProps & {
  label?: string;
};

export function BackLink({ sx, label, ...other }: BackLinkProps) {
  return (
    <Link
      component={RouterLink}
      color="inherit"
      underline="none"
      sx={[
        (theme) => ({
          verticalAlign: 'middle',
          [`& .${remixIconClasses.root}`]: {
            verticalAlign: 'inherit',
            transform: 'translateY(-2px)',
            ml: {
              xs: '-14px',
              md: '-18px',
            },
            transition: theme.transitions.create(['opacity'], {
              duration: theme.transitions.duration.shorter,
              easing: theme.transitions.easing.sharp,
            }),
          },
          '&:hover': {
            [`& .${remixIconClasses.root}`]: {
              opacity: 0.48,
            },
          },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <RemixIcon width={18} icon="eva:arrow-ios-back-fill" />
      {label}
    </Link>
  );
}
