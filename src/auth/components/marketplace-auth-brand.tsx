'use client';

import Box from '@mui/material/Box';

import { CONFIG } from 'src/global-config';

import { Image } from 'src/components/image';

export function MarketplaceAuthBrand() {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Image
        visibleByDefault
        alt="E-KRU Marketplace"
        src={`${CONFIG.assetsDir}/logo/logo-tran-ver.svg`}
        sx={{ width: 156, height: 54 }}
        slotProps={{ img: { sx: { objectFit: 'contain', objectPosition: 'left center' } } }}
      />
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
