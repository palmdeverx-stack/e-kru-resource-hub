'use client';

import Stack from '@mui/material/Stack';

import { Logo } from 'src/components/logo';

type MarketplaceBrandProps = {
  compact?: boolean;
};

export function MarketplaceBrand({ compact = false }: MarketplaceBrandProps) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
      <Logo
        isSingle={false}
        sx={{
          width: compact ? 126 : { xs: 132, sm: 148, md: 164 },
          flexShrink: 0,
          height: compact ? 38 : { xs: 40, sm: 44, md: 48 },
        }}
      />
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
