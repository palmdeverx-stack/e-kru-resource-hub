'use client';

import type { TypographyProps } from '@mui/material/Typography';
import type { MarketplaceSeller } from './types';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import { useTheme, type Theme, type SxProps } from '@mui/material/styles';

import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { RiStore2Line, RiShieldStarFill, RiVerifiedBadgeFill } from 'src/components/remix-icon';

import { isSellerProfileVerified, isSystemMarketplaceSeller } from './seller-completion';

type SellerSummary =
  | (Pick<
      MarketplaceSeller,
      'display_name' | 'slug' | 'logo_url' | 'profile_completion' | 'is_system_store'
    > & {
      id?: string;
      owner_role?: string;
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
  fallbackName = 'ผู้ขาย E-KRU',
  sx,
  nameSx,
}: Props) {
  const theme = useTheme();
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
        <>
          <Typography
            variant={nameVariant}
            noWrap
            sx={{ color: 'inherit', fontWeight: 600, ...nameSx }}
          >
            {name}
          </Typography>
          {isSellerProfileVerified(seller?.profile_completion) && (
            <RiVerifiedBadgeFill
              size={nameVariant === 'h4' ? 24 : 18}
              color={theme.palette.primary.main}
              aria-label="ร้านค้าที่ผ่านการตรวจสอบ"
              style={{ flexShrink: 0 }}
            />
          )}
          {isSystemMarketplaceSeller(seller) && (
            <RiShieldStarFill
              size={nameVariant === 'h4' ? 24 : 18}
              color={theme.palette.primary.main}
              aria-label="ร้านค้าระบบ E-KRU"
              style={{ flexShrink: 0 }}
            />
          )}
        </>
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
