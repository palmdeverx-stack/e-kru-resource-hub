'use client';

import Box from '@mui/material/Box';

import { Logo } from 'src/components/logo';

export function MarketplaceAuthBrand() {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Logo isSingle={false} sx={{ width: 156, height: 48 }} />
      {/* <Box sx={{ mt: 1.25 }}>
        <Chip
          size="small"
          color="primary"
          variant="soft"
          label="E-KRU Marketplace"
          sx={{ fontWeight: 700 }}
        />
      </Box> */}
    </Box>
  );
}
