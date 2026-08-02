'use client';

import type { RemixiconComponentType } from '@remixicon/react';
import type { MarketplaceSellerBadge, MarketplaceSellerBadgeDefinition } from './types';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { useTranslate } from 'src/locales';

import { MarketplaceBrand } from 'src/components/marketplace-brand';
import {
  RiFireFill,
  RiStarFill,
  RiAwardFill,
  RiHeartFill,
  RiCloseLine,
  RiRocketFill,
  RiRocketLine,
  RiTrophyFill,
  RiTrophyLine,
  RiSparklingFill,
  RiSparklingLine,
} from 'src/components/remix-icon';

const badgeIcons: Record<string, RemixiconComponentType> = {
  trophy: RiTrophyLine,
  star: RiStarFill,
  fire: RiFireFill,
  rocket: RiRocketLine,
  heart: RiHeartFill,
  sparkling: RiSparklingLine,
  award: RiAwardFill,
};

const sealBadgeIcons: Record<string, RemixiconComponentType> = {
  ...badgeIcons,
  trophy: RiTrophyFill,
  rocket: RiRocketFill,
  sparkling: RiSparklingFill,
};

const roundedHexagonMask =
  'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Cpath d=%22M50 1C53 1 55 2 58 4L91 23C95 25 97 29 97 34V66C97 71 95 75 91 77L58 96C53 99 47 99 42 96L9 77C5 75 3 71 3 66V34C3 29 5 25 9 23L42 4C45 2 47 1 50 1Z%22 fill=%22black%22/%3E%3C/svg%3E")';

let badgeDefinitionsRequest: Promise<MarketplaceSellerBadgeDefinition[]> | null = null;

function loadBadgeDefinitions() {
  badgeDefinitionsRequest ??= fetch('/api/marketplace/seller-badges').then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? 'Failed to load badges');
    return (result.badges ?? []) as MarketplaceSellerBadgeDefinition[];
  });

  return badgeDefinitionsRequest.catch((error) => {
    badgeDefinitionsRequest = null;
    throw error;
  });
}

export function MarketplaceSellerBadges({
  badges,
  limit,
  variant = 'chip',
}: {
  badges?: MarketplaceSellerBadge[];
  limit?: number;
  variant?: 'chip' | 'seal';
}) {
  const { currentLang } = useTranslate();
  const language = currentLang.value === 'en' ? 'en' : 'th';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBadgeKey, setSelectedBadgeKey] = useState<string | null>(null);
  const [definitions, setDefinitions] = useState<MarketplaceSellerBadgeDefinition[]>([]);
  const [loadingDefinitions, setLoadingDefinitions] = useState(false);
  const [definitionsError, setDefinitionsError] = useState('');
  const visibleBadges = limit ? (badges ?? []).slice(0, limit) : (badges ?? []);
  if (!visibleBadges.length) return null;

  const openBadgeDialog = (badgeKey: string | null) => {
    setSelectedBadgeKey(badgeKey);
    setDialogOpen(true);
    if (definitions.length || loadingDefinitions) return;

    setDefinitionsError('');
    setLoadingDefinitions(true);
    loadBadgeDefinitions()
      .then(setDefinitions)
      .catch((error) =>
        setDefinitionsError(error instanceof Error ? error.message : 'โหลดข้อมูล Badge ไม่สำเร็จ')
      )
      .finally(() => setLoadingDefinitions(false));
  };

  return (
    <>
      <Stack
        direction="row"
        spacing={variant === 'seal' ? 1 : 0.75}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        {visibleBadges.map((badge) => {
          const Icon = badgeIcons[badge.icon_key] ?? RiTrophyLine;
          const isNewCreator = badge.badge_key === 'new_creator';
          const storedLabel = language === 'en' ? badge.label_en : badge.label_th;
          const storedDescription = language === 'en' ? badge.description_en : badge.description_th;
          const label =
            isNewCreator && storedLabel === 'New Creator'
              ? language === 'en'
                ? 'Emerging Creator'
                : 'นักสร้างสรรค์ดาวรุ่ง'
              : storedLabel;
          const description =
            isNewCreator &&
            (storedDescription === 'ผู้ขายใหม่ที่เพิ่งเริ่มต้นบน Marketplace' ||
              storedDescription === 'A new seller getting started on the Marketplace')
              ? language === 'en'
                ? 'Your creator journey starts here. Publish and grow your sales to unlock the next badge.'
                : 'จุดเริ่มต้นของร้านคุณ สร้างผลงานและยอดขายเพื่อปลดล็อกรางวัลระดับถัดไป'
              : storedDescription;
          if (variant === 'seal') {
            const SealIcon = sealBadgeIcons[badge.icon_key] ?? RiTrophyFill;

            return (
              <SellerBadgeSeal
                key={badge.badge_key}
                badge={badge}
                icon={SealIcon}
                label={label}
                description={description}
                onClick={() => openBadgeDialog(badge.badge_key)}
              />
            );
          }
          return (
            <Tooltip key={badge.badge_key} title={description} arrow>
              <Chip
                size="small"
                icon={<Icon size={16} />}
                label={label}
                onClick={() => openBadgeDialog(badge.badge_key)}
                sx={{
                  height: isNewCreator ? 34 : undefined,
                  color: isNewCreator ? '#7A3E00' : badge.color,
                  fontWeight: isNewCreator ? 800 : 700,
                  border: '1px solid',
                  borderColor: isNewCreator ? '#F4B740' : badge.color,
                  bgcolor: isNewCreator
                    ? undefined
                    : `color-mix(in srgb, ${badge.color} 10%, transparent)`,
                  background: isNewCreator
                    ? 'linear-gradient(135deg, #FFF9E8 0%, #FFE6A3 55%, #FFF3CF 100%)'
                    : undefined,
                  boxShadow: isNewCreator
                    ? '0 4px 12px rgba(217, 119, 6, 0.18), inset 0 1px 0 rgba(255,255,255,0.9)'
                    : undefined,
                  '& .MuiChip-icon': {
                    color: isNewCreator ? '#B45309' : 'inherit',
                    width: isNewCreator ? 24 : undefined,
                    height: isNewCreator ? 24 : undefined,
                    p: isNewCreator ? 0.4 : undefined,
                    ml: isNewCreator ? 0.6 : undefined,
                    borderRadius: isNewCreator ? '50%' : undefined,
                    bgcolor: isNewCreator ? 'rgba(255,255,255,0.7)' : undefined,
                  },
                  '& .MuiChip-label': {
                    px: isNewCreator ? 1.25 : undefined,
                    letterSpacing: isNewCreator ? 0.1 : undefined,
                  },
                }}
              />
            </Tooltip>
          );
        })}
        {limit && (badges?.length ?? 0) > limit && (
          <Chip
            size="small"
            variant="outlined"
            label={`+${(badges?.length ?? 0) - limit}`}
            onClick={() => openBadgeDialog(null)}
          />
        )}
      </Stack>

      <SellerBadgesDialog
        open={dialogOpen}
        language={language}
        definitions={definitions}
        loading={loadingDefinitions}
        error={definitionsError}
        selectedBadgeKey={selectedBadgeKey}
        onSelect={setSelectedBadgeKey}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}

function SellerBadgeSeal({
  badge,
  icon: Icon,
  label,
  description,
  onClick,
}: {
  badge: MarketplaceSellerBadge;
  icon: RemixiconComponentType;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Tooltip title={`${label} — ${description}`} arrow>
      <Box
        component="button"
        type="button"
        aria-label={`${label}: ${description}`}
        onClick={onClick}
        sx={{
          width: 40,
          height: 40,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          color: 'common.white',
          bgcolor: badge.color,
          p: 0,
          border: 0,
          cursor: 'pointer',
          appearance: 'none',
          maskImage: roundedHexagonMask,
          maskSize: '100% 100%',
          maskRepeat: 'no-repeat',
          WebkitMaskImage: roundedHexagonMask,
          WebkitMaskSize: '100% 100%',
          WebkitMaskRepeat: 'no-repeat',
          filter: 'drop-shadow(0 2px 3px rgba(15, 23, 42, 0.08))',
          transition: 'transform 180ms ease, filter 180ms ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            filter: 'drop-shadow(0 6px 8px rgba(15, 23, 42, 0.16))',
          },
          '&:focus-visible': {
            outline: `3px solid ${badge.color}`,
            outlineOffset: 3,
          },
        }}
      >
        <Icon size={20} aria-hidden />
      </Box>
    </Tooltip>
  );
}

function SellerBadgesDialog({
  open,
  language,
  definitions,
  loading,
  error,
  selectedBadgeKey,
  onSelect,
  onClose,
}: {
  open: boolean;
  language: 'th' | 'en';
  definitions: MarketplaceSellerBadgeDefinition[];
  loading: boolean;
  error: string;
  selectedBadgeKey: string | null;
  onSelect: (badgeKey: string) => void;
  onClose: () => void;
}) {
  const activeDefinition =
    definitions.find((definition) => definition.badge_key === selectedBadgeKey) ?? definitions[0];
  const ActiveIcon = activeDefinition
    ? (sealBadgeIcons[activeDefinition.icon_key] ?? RiTrophyFill)
    : RiTrophyFill;
  const activeLabel = activeDefinition
    ? language === 'th'
      ? activeDefinition.label_th
      : activeDefinition.label_en
    : '';
  const activeDescription = activeDefinition
    ? language === 'th'
      ? activeDefinition.description_th
      : activeDefinition.description_en
    : '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      scroll="paper"
      slotProps={{
        paper: {
          sx: {
            color: '#1D2939',
            bgcolor: '#F5F8FF',
            backgroundImage:
              'radial-gradient(circle at 4% 6%, rgba(71, 130, 255, 0.13), transparent 34%), radial-gradient(circle at 96% 86%, rgba(80, 211, 178, 0.13), transparent 32%), linear-gradient(135deg, #F2F6FF 0%, #FFFFFF 52%, #F0FBF8 100%)',
          },
        },
      }}
    >
      <Box
        sx={{
          top: { xs: 12, md: 20 },
          left: { xs: 12, md: 24 },
          zIndex: 2,
          px: 1.5,
          py: 0.75,
          position: 'fixed',
          // border: '1px solid #E4EBF5',
          borderRadius: 2,
          // bgcolor: 'rgba(255,255,255,0.78)',
          // backdropFilter: 'blur(10px)',
          // boxShadow: '0 8px 24px rgba(30, 88, 180, 0.08)',
        }}
      >
        <MarketplaceBrand compact variant="transparent" disabled width={206} height={38} />
      </Box>

      <IconButton
        aria-label={language === 'th' ? 'ปิด' : 'Close'}
        onClick={onClose}
        sx={{
          top: { xs: 12, md: 20 },
          right: { xs: 12, md: 24 },
          zIndex: 2,
          position: 'fixed',
          color: '#1D2939',
          bgcolor: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #E4EBF5',
          '&:hover': { bgcolor: 'common.white' },
        }}
      >
        <RiCloseLine />
      </IconButton>

      <DialogContent sx={{ p: 0 }}>
        {loading && (
          <Stack alignItems="center" justifyContent="center" sx={{ minHeight: '100dvh' }}>
            <CircularProgress size={36} />
          </Stack>
        )}

        {!loading && error && (
          <Stack alignItems="center" justifyContent="center" sx={{ p: 3, minHeight: '100dvh' }}>
            <Alert severity="error" sx={{ width: 1, maxWidth: 520 }}>
              {error}
            </Alert>
          </Stack>
        )}

        {!loading && !error && activeDefinition && (
          <>
            <Stack
              alignItems="center"
              sx={{
                px: 3,
                pt: { xs: 11, sm: 10 },
                pb: { xs: 7, sm: 9 },
                minHeight: { xs: '92dvh', md: '100dvh' },
                textAlign: 'center',
                position: 'relative',
                justifyContent: 'space-between',
                background:
                  'radial-gradient(circle at 50% 47%, rgba(71, 130, 255, 0.16) 0%, rgba(80, 211, 178, 0.08) 28%, transparent 58%)',
              }}
            >
              <Box>
                <Typography
                  component="h2"
                  sx={{
                    maxWidth: 720,
                    fontSize: { xs: 38, sm: 56, md: 68 },
                    fontWeight: 900,
                    lineHeight: 0.98,
                    letterSpacing: '-0.045em',
                  }}
                >
                  {language === 'th' ? 'ฉันคือ' : "I'm the"}
                  <Box component="span" sx={{ display: 'block', mt: 0.75 }}>
                    {activeLabel}
                  </Box>
                </Typography>
              </Box>

              <Box
                sx={{
                  my: { xs: 4, sm: 5 },
                  width: { xs: 220, sm: 280 },
                  height: { xs: 246, sm: 312 },
                  position: 'relative',
                  filter: `drop-shadow(0 0 18px ${activeDefinition.color}) drop-shadow(0 0 55px color-mix(in srgb, ${activeDefinition.color} 65%, transparent))`,
                  '&::before': {
                    content: '""',
                    inset: '10%',
                    position: 'absolute',
                    borderRadius: '50%',
                    bgcolor: activeDefinition.color,
                    filter: 'blur(55px)',
                    opacity: 0.55,
                  },
                }}
              >
                <Box
                  sx={{
                    inset: 0,
                    position: 'absolute',
                    bgcolor: 'rgba(244, 240, 255, 0.88)',
                    maskImage: roundedHexagonMask,
                    maskSize: '100% 100%',
                    maskRepeat: 'no-repeat',
                    WebkitMaskImage: roundedHexagonMask,
                    WebkitMaskSize: '100% 100%',
                    WebkitMaskRepeat: 'no-repeat',
                  }}
                />
                <Box
                  sx={{
                    inset: { xs: 11, sm: 14 },
                    position: 'absolute',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'common.white',
                    background: `linear-gradient(145deg, color-mix(in srgb, ${activeDefinition.color} 72%, #FFFFFF), ${activeDefinition.color} 52%, color-mix(in srgb, ${activeDefinition.color} 68%, #10111D))`,
                    maskImage: roundedHexagonMask,
                    maskSize: '100% 100%',
                    maskRepeat: 'no-repeat',
                    WebkitMaskImage: roundedHexagonMask,
                    WebkitMaskSize: '100% 100%',
                    WebkitMaskRepeat: 'no-repeat',
                  }}
                >
                  <ActiveIcon size={96} aria-hidden />
                </Box>
              </Box>

              <Box sx={{ maxWidth: 640 }}>
                <Typography sx={{ color: '#667085', fontSize: { xs: 17, sm: 20 } }}>
                  {activeDescription}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  justifyContent="center"
                  flexWrap="wrap"
                  useFlexGap
                  sx={{ mt: 2 }}
                >
                  <Chip
                    label={
                      language === 'th'
                        ? `ประเมิน ${activeDefinition.evaluation_days.toLocaleString('th-TH')} วัน`
                        : `${activeDefinition.evaluation_days.toLocaleString('en-US')}-day evaluation`
                    }
                    sx={{ color: '#344054', bgcolor: 'rgba(71,130,255,0.10)' }}
                  />
                  <Chip
                    label={
                      language === 'th'
                        ? `${definitions.length.toLocaleString('th-TH')} Badge ทั้งหมด`
                        : `${definitions.length.toLocaleString('en-US')} badge types`
                    }
                    sx={{ color: '#344054', bgcolor: 'rgba(80,211,178,0.12)' }}
                  />
                </Stack>
              </Box>
            </Stack>

            <Box
              sx={{
                px: { xs: 2, sm: 4 },
                py: { xs: 5, sm: 7 },
                bgcolor: 'rgba(255,255,255,0.68)',
                borderTop: '1px solid #E4EBF5',
                backdropFilter: 'blur(18px)',
              }}
            >
              <Box sx={{ width: 1, maxWidth: 960, mx: 'auto' }}>
                <Typography variant="overline" sx={{ color: '#667085', letterSpacing: 2 }}>
                  {language === 'th' ? 'COLLECTION' : 'COLLECTION'}
                </Typography>
                <Typography variant="h3" sx={{ mt: 0.5, color: '#1D2939' }}>
                  {language === 'th'
                    ? `Badge ผู้ขายทั้งหมด ${definitions.length} แบบ`
                    : `All ${definitions.length} seller badges`}
                </Typography>
                <Typography sx={{ mt: 1, mb: 4, color: '#667085' }}>
                  {language === 'th'
                    ? 'เลือก Badge เพื่อดูรายละเอียดด้านบน ทำภารกิจครบตามเกณฑ์แล้วระบบจะมอบให้โดยอัตโนมัติ'
                    : 'Select a badge to feature it above. Complete its missions to unlock it automatically.'}
                </Typography>

                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  }}
                >
                  {definitions.map((definition) => {
                    const Icon = sealBadgeIcons[definition.icon_key] ?? RiTrophyFill;
                    const label = language === 'th' ? definition.label_th : definition.label_en;
                    const description =
                      language === 'th' ? definition.description_th : definition.description_en;
                    const missions = getBadgeMissions(definition.criteria, language);
                    const selected = definition.badge_key === selectedBadgeKey;

                    return (
                      <Box
                        component="button"
                        type="button"
                        key={definition.badge_key}
                        onClick={() => onSelect(definition.badge_key)}
                        sx={{
                          p: { xs: 2, sm: 2.5 },
                          width: 1,
                          color: '#1D2939',
                          textAlign: 'left',
                          cursor: 'pointer',
                          border: '1px solid',
                          borderColor: selected ? definition.color : '#E4EBF5',
                          borderRadius: 3,
                          bgcolor: selected
                            ? `color-mix(in srgb, ${definition.color} 12%, #FFFFFF)`
                            : 'rgba(255,255,255,0.82)',
                          font: 'inherit',
                          transition: 'transform 180ms ease, border-color 180ms ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            borderColor: definition.color,
                          },
                          '&:focus-visible': {
                            outline: `3px solid ${definition.color}`,
                            outlineOffset: 2,
                          },
                        }}
                      >
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                          <Box
                            sx={{
                              width: 52,
                              height: 58,
                              flexShrink: 0,
                              display: 'grid',
                              placeItems: 'center',
                              color: 'common.white',
                              bgcolor: definition.color,
                              maskImage: roundedHexagonMask,
                              maskSize: '100% 100%',
                              maskRepeat: 'no-repeat',
                              WebkitMaskImage: roundedHexagonMask,
                              WebkitMaskSize: '100% 100%',
                              WebkitMaskRepeat: 'no-repeat',
                            }}
                          >
                            <Icon size={26} aria-hidden />
                          </Box>

                          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography variant="subtitle1">{label}</Typography>
                              {selected && (
                                <Chip
                                  size="small"
                                  label={language === 'th' ? 'Badge ที่เลือก' : 'Selected badge'}
                                  sx={{ color: 'common.white', bgcolor: definition.color }}
                                />
                              )}
                            </Stack>
                            <Typography variant="body2" sx={{ color: '#667085' }}>
                              {description}
                            </Typography>
                            <Chip
                              size="small"
                              variant="soft"
                              label={
                                language === 'th'
                                  ? `ประเมินย้อนหลัง ${definition.evaluation_days.toLocaleString('th-TH')} วัน`
                                  : `${definition.evaluation_days.toLocaleString('en-US')}-day evaluation`
                              }
                              sx={{
                                mt: 1,
                                color: '#344054',
                                bgcolor: '#F2F6FF',
                              }}
                            />

                            <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 0.5 }}>
                              {language === 'th' ? 'ภารกิจที่ต้องทำ' : 'Missions'}
                            </Typography>
                            <Stack component="ul" spacing={0.25} sx={{ pl: 2.5, m: 0 }}>
                              {missions.map((mission) => (
                                <Typography key={mission} component="li" variant="body2">
                                  {mission}
                                </Typography>
                              ))}
                            </Stack>
                          </Box>
                        </Stack>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function getBadgeMissions(criteria: Record<string, number>, language: 'th' | 'en') {
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const number = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2 });
  const missionByCriteria: Record<string, (value: number) => string> =
    language === 'th'
      ? {
          min_orders: (value) => `มีออเดอร์สำเร็จอย่างน้อย ${number(value)} ออเดอร์`,
          min_gross_sales: (value) => `ทำยอดขายรวมอย่างน้อย ${number(value)} บาท`,
          min_average_rating: (value) => `รักษาคะแนนรีวิวเฉลี่ยอย่างน้อย ${number(value)} จาก 5`,
          min_review_count: (value) => `ได้รับรีวิวอย่างน้อย ${number(value)} รีวิว`,
          top_product_limit: (value) =>
            `มีสินค้าติดอันดับขายดี Top ${number(value)} ของ Marketplace`,
          min_best_seller_products: (value) =>
            `มีสินค้าติดอันดับขายดีอย่างน้อย ${number(value)} รายการ`,
          min_units_sold: (value) =>
            `สินค้าที่ติดอันดับขายได้อย่างน้อย ${number(value)} ชิ้นต่อรายการ`,
          max_seller_age_days: (value) => `ร้านเปิดมาแล้วไม่เกิน ${number(value)} วัน`,
          min_growth_percent: (value) => `มียอดขายเติบโตอย่างน้อย ${number(value)}%`,
          min_repeat_buyer_rate: (value) => `มีสัดส่วนผู้ซื้อซ้ำอย่างน้อย ${number(value)}%`,
        }
      : {
          min_orders: (value) => `Complete at least ${number(value)} orders`,
          min_gross_sales: (value) => `Reach at least THB ${number(value)} in gross sales`,
          min_average_rating: (value) =>
            `Maintain an average rating of at least ${number(value)} out of 5`,
          min_review_count: (value) => `Receive at least ${number(value)} reviews`,
          top_product_limit: (value) => `Have a product in the Marketplace top ${number(value)}`,
          min_best_seller_products: (value) =>
            `Have at least ${number(value)} best-selling products`,
          min_units_sold: (value) => `Sell at least ${number(value)} units of each ranked product`,
          max_seller_age_days: (value) => `Have a store age of no more than ${number(value)} days`,
          min_growth_percent: (value) => `Grow sales by at least ${number(value)}%`,
          min_repeat_buyer_rate: (value) =>
            `Maintain a repeat-buyer rate of at least ${number(value)}%`,
        };

  return Object.entries(criteria).flatMap(([key, value]) => {
    const formatMission = missionByCriteria[key];
    return formatMission ? [formatMission(value)] : [];
  });
}
