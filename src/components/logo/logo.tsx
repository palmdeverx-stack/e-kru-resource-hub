'use client';

import type { LinkProps } from '@mui/material/Link';

import { mergeClasses } from 'minimal-shared/utils';

import Link from '@mui/material/Link';
import { styled } from '@mui/material/styles';

import { RouterLink } from 'src/routes/components';

import { CONFIG } from 'src/global-config';

import { logoClasses } from './classes';

export type LogoProps = LinkProps & {
  isSingle?: boolean;
  disabled?: boolean;
};

/**
 * System-wide E-KRU identity.
 * Use the compact mark in constrained areas and `isSingle={false}` for the
 * horizontal brand in page headers, authentication screens and documents.
 */
export function Logo({
  sx,
  disabled,
  className,
  href = '/',
  isSingle = true,
  ...other
}: LogoProps) {
  const source = isSingle ? 'logo-single-primary.svg' : 'logo-tran-ver.svg';

  return (
    <LogoRoot
      component={RouterLink}
      href={href}
      aria-label="E-KRU"
      underline="none"
      className={mergeClasses([logoClasses.root, className])}
      sx={[
        {
          width: isSingle ? 44 : 156,
          height: isSingle ? 44 : 48,
          ...(!isSingle && { maxWidth: '100%' }),
          ...(disabled && { pointerEvents: 'none' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <LogoImage
        alt={isSingle ? 'E-KRU' : 'E-KRU Marketplace'}
        src={`${CONFIG.assetsDir}/logo/${source}`}
      />
    </LogoRoot>
  );
}

const LogoRoot = styled(Link)(() => ({
  flexShrink: 0,
  lineHeight: 0,
  color: 'transparent',
  display: 'inline-flex',
  verticalAlign: 'middle',
}));

const LogoImage = styled('img')({
  width: '100%',
  height: '100%',
  display: 'block',
  objectFit: 'contain',
  objectPosition: 'left center',
});
