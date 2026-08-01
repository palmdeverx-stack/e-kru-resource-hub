'use client';

import type { RemixiconComponentType } from '@remixicon/react';
import type { MarketplaceSellerBadge } from './types';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

import { useTranslate } from 'src/locales';

import {
  RiFireFill,
  RiStarFill,
  RiHeartFill,
  RiRocketLine,
  RiTrophyLine,
  RiSparklingLine,
} from 'src/components/remix-icon';

const badgeIcons: Record<string, RemixiconComponentType> = {
  trophy: RiTrophyLine,
  star: RiStarFill,
  fire: RiFireFill,
  rocket: RiRocketLine,
  heart: RiHeartFill,
  sparkling: RiSparklingLine,
};

export function MarketplaceSellerBadges({
  badges,
  limit,
}: {
  badges?: MarketplaceSellerBadge[];
  limit?: number;
}) {
  const { currentLang } = useTranslate();
  const language = currentLang.value === 'en' ? 'en' : 'th';
  const visibleBadges = limit ? (badges ?? []).slice(0, limit) : (badges ?? []);
  if (!visibleBadges.length) return null;

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {visibleBadges.map((badge) => {
        const Icon = badgeIcons[badge.icon_key] ?? RiTrophyLine;
        const label = language === 'en' ? badge.label_en : badge.label_th;
        const description =
          language === 'en' ? badge.description_en : badge.description_th;
        return (
          <Tooltip key={badge.badge_key} title={description} arrow>
            <Chip
              size="small"
              icon={<Icon size={16} />}
              label={label}
              sx={{
                color: badge.color,
                fontWeight: 700,
                border: '1px solid',
                borderColor: badge.color,
                bgcolor: `color-mix(in srgb, ${badge.color} 10%, transparent)`,
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
          </Tooltip>
        );
      })}
      {limit && (badges?.length ?? 0) > limit && (
        <Chip size="small" variant="outlined" label={`+${(badges?.length ?? 0) - limit}`} />
      )}
    </Stack>
  );
}
