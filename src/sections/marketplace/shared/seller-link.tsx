'use client';

import type { Theme, SxProps } from '@mui/material/styles';
import type { TypographyProps } from '@mui/material/Typography';
import type { MarketplaceSeller } from './types';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';

import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { RiStore2Line } from 'src/components/remix-icon';

type SellerSummary =
  | (Pick<MarketplaceSeller, 'display_name' | 'slug' | 'logo_url'> & {
      id?: string;
    })
  | null
  | undefined;

type Props = {
  seller: SellerSummary;
  avatarSize?: number;
  showAvatar?: boolean;
  showName?: boolean;
  nameVariant?: TypographyProps['variant'];
  fallbackName?: string;
  sx?: SxProps<Theme>;
  nameSx?: SxProps<Theme>;
};

export function MarketplaceSellerLink({
  seller,
  avatarSize = 32,
  showAvatar = true,
  showName = true,
  nameVariant = 'body2',
  fallbackName = 'ผู้ขาย eKru',
  sx,
  nameSx,
}: Props) {
  const pathname = usePathname();
  const name = seller?.display_name || fallbackName;
  const sellerId = seller?.id && /^[0-9a-f-]{36}$/i.test(seller.id) ? seller.id : '';
  const storeIdentifier = seller?.slug || sellerId;
  const href = storeIdentifier
    ? pathname.startsWith('/dashboard')
      ? `/dashboard/store/${storeIdentifier}`
      : `/store/${storeIdentifier}`
    : '';

  const content = (
    <Stack direction="row" spacing={1} alignItems="center" sx={sx}>
      {showAvatar && (
        <Avatar
          src={seller?.logo_url ?? undefined}
          alt={name}
          sx={{
            width: avatarSize,
            height: avatarSize,
            flexShrink: 0,
            bgcolor: 'primary.lighter',
            color: 'primary.main',
          }}
        >
          <RiStore2Line size={Math.max(15, Math.round(avatarSize * 0.46))} />
        </Avatar>
      )}
      {showName && (
        <Typography
          variant={nameVariant}
          noWrap
          sx={{ color: 'inherit', fontWeight: 600, ...nameSx }}
        >
          {name}
        </Typography>
      )}
    </Stack>
  );

  if (!href) return content;

  return (
    <Box
      component={RouterLink}
      href={href}
      data-marketplace-seller-link
      aria-label={`ดูโปรไฟล์ร้าน ${name}`}
      sx={{
        minWidth: 0,
        display: 'inline-flex',
        color: 'text.primary',
        borderRadius: 1,
        textDecoration: 'none',
        transition: 'color 160ms ease, opacity 160ms ease',
        '&:hover': { color: 'primary.main', opacity: 0.9 },
      }}
    >
      {content}
    </Box>
  );
}
