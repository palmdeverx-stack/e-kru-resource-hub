import type { SxProps, Theme } from '@mui/material/styles';

import Box from '@mui/material/Box';

import { findThaiBank } from './thai-banks';

type Props = {
  bankCode?: string | null;
  bankName?: string | null;
  size?: number;
  sx?: SxProps<Theme>;
};

export function ThaiBankLogo({ bankCode, bankName, size = 36, sx }: Props) {
  const bank = findThaiBank(bankCode) ?? findThaiBank(bankName);

  if (bank?.logo) {
    return (
      <Box
        component="img"
        src={bank.logo}
        alt={`โลโก้${bank.name}`}
        sx={[
          {
            width: size,
            height: size,
            p: 0.25,
            flexShrink: 0,
            objectFit: 'contain',
            borderRadius: '50%',
            bgcolor: 'background.paper',
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      />
    );
  }

  const fallback =
    bank?.alias ??
    bankName
      ?.replace(/^ธนาคาร/, '')
      .trim()
      .slice(0, 4) ??
    'BANK';

  return (
    <Box
      component="span"
      aria-label={bankName ? `ธนาคาร ${bankName}` : 'ธนาคาร'}
      sx={[
        {
          width: size,
          height: size,
          color: 'common.white',
          display: 'grid',
          flexShrink: 0,
          fontSize: Math.max(9, size * 0.27),
          fontWeight: 700,
          borderRadius: '50%',
          placeItems: 'center',
          bgcolor: bank?.color ?? 'text.secondary',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {fallback.toUpperCase()}
    </Box>
  );
}
