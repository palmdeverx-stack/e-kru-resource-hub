'use client';

import { useState, useEffect } from 'react';

import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';

import { RouterLink } from 'src/routes/components';

import { Logo } from 'src/components/logo';

type MarketplaceBrandProps = {
  compact?: boolean;
  variant?: 'default' | 'transparent';
  href?: string;
  disabled?: boolean;
};

type PublicBrand = {
  platformName?: string;
  logoUrl?: string | null;
  transparentLogoUrl?: string | null;
};

export function MarketplaceBrand({
  compact = false,
  variant = 'default',
  href = '/',
  disabled = false,
}: MarketplaceBrandProps) {
  const [brand, setBrand] = useState<PublicBrand | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/marketplace/contact', { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<PublicBrand>) : null))
      .then((result) => result && setBrand(result))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const imageUrl =
    variant === 'transparent'
      ? brand?.transparentLogoUrl || brand?.logoUrl
      : brand?.logoUrl || brand?.transparentLogoUrl;
  const width = compact ? 126 : { xs: 132, sm: 148, md: 164 };
  const height = compact ? 38 : { xs: 40, sm: 44, md: 48 };

  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
      {imageUrl ? (
        <Link
          component={RouterLink}
          href={href}
          aria-label={brand?.platformName || 'E-KRU Marketplace'}
          underline="none"
          sx={{
            width,
            height,
            display: 'inline-flex',
            flexShrink: 0,
            pointerEvents: disabled ? 'none' : undefined,
          }}
        >
          <Stack
            component="img"
            src={imageUrl}
            alt={brand?.platformName || 'E-KRU Marketplace'}
            sx={{ width: 1, height: 1, objectFit: 'contain', objectPosition: 'left center' }}
          />
        </Link>
      ) : (
        <Logo
          href={href}
          disabled={disabled}
          isSingle={false}
          sx={{ width, height, flexShrink: 0 }}
        />
      )}
      {/* {!compact && (
        <Stack spacing={0} sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap>
            E-KRU Marketplace
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            ตลาดสื่อการสอน
          </Typography>
        </Stack>
      )} */}
    </Stack>
  );
}
