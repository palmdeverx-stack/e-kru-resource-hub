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
        sx={{
          width: 'auto',
          flexShrink: 0,
          height: compact ? 40 : { xs: 42, sm: 52, md: 80 },
        }}
      />
      {/* {!compact && (
        <Stack spacing={0} sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap>
            eKru Marketplace
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            ตลาดสื่อการสอน
          </Typography>
        </Stack>
      )} */}
    </Stack>
  );
}
