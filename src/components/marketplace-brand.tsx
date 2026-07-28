'use client';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Logo } from 'src/components/logo';

type MarketplaceBrandProps = {
  compact?: boolean;
};

export function MarketplaceBrand({ compact = false }: MarketplaceBrandProps) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Logo />
      {!compact && (
        <Stack spacing={0} sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap>
            eKru Marketplace
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            ตลาดสื่อการสอน
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
