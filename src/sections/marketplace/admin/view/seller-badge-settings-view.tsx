'use client';

import type { RemixiconComponentType } from '@remixicon/react';
import type { MarketplaceSellerBadge } from '../../shared/types';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import {
  RiFireFill,
  RiStarFill,
  RiAwardFill,
  RiHeartFill,
  RiSave3Line,
  RiRocketLine,
  RiTrophyLine,
  RiSparklingLine,
} from 'src/components/remix-icon';

import { MarketplaceSellerBadges } from '../../shared/seller-badges';

type BadgeKey =
  | 'top_seller'
  | 'highly_rated'
  | 'best_seller'
  | 'rising_creator'
  | 'customer_favorite'
  | 'new_creator';

type BadgeSetting = {
  badge_key: BadgeKey;
  label_th: string;
  label_en: string;
  description_th: string;
  description_en: string;
  icon_key: string;
  color: string;
  is_enabled: boolean;
  evaluation_days: number;
  criteria: Record<string, number>;
  priority: number;
};

const iconOptions: Array<{
  value: string;
  label: string;
  icon: RemixiconComponentType;
}> = [
  { value: 'trophy', label: 'ถ้วยรางวัล', icon: RiTrophyLine },
  { value: 'award', label: 'เหรียญรางวัล', icon: RiAwardFill },
  { value: 'star', label: 'ดาว', icon: RiStarFill },
  { value: 'fire', label: 'ยอดนิยม', icon: RiFireFill },
  { value: 'rocket', label: 'เติบโต', icon: RiRocketLine },
  { value: 'heart', label: 'ขวัญใจลูกค้า', icon: RiHeartFill },
  { value: 'sparkling', label: 'ประกาย', icon: RiSparklingLine },
];

const badgeKeyLabels: Record<BadgeKey, string> = {
  top_seller: 'ผู้ขายยอดเยี่ยม',
  highly_rated: 'คะแนนรีวิวสูง',
  best_seller: 'สินค้าขายดี',
  rising_creator: 'ผู้สร้างดาวรุ่ง',
  customer_favorite: 'ขวัญใจลูกค้า',
  new_creator: 'ผู้สร้างหน้าใหม่',
};

const criteriaLabels: Record<string, { label: string; helper?: string }> = {
  min_orders: { label: 'ออเดอร์สำเร็จขั้นต่ำ' },
  min_gross_sales: { label: 'ยอดขายรวมขั้นต่ำ (บาท)' },
  min_average_rating: { label: 'คะแนนรีวิวเฉลี่ยขั้นต่ำ', helper: 'กำหนดได้สูงสุด 5 คะแนน' },
  min_review_count: { label: 'จำนวนรีวิวขั้นต่ำ' },
  top_product_limit: { label: 'อันดับสินค้าขายดีที่นำมาพิจารณา' },
  min_best_seller_products: { label: 'จำนวนสินค้าที่ต้องติดอันดับ' },
  min_units_sold: { label: 'จำนวนขายขั้นต่ำต่อสินค้าติดอันดับ' },
  max_seller_age_days: { label: 'อายุร้านสูงสุด (วัน)' },
  min_growth_percent: { label: 'อัตราเติบโตขั้นต่ำ (%)' },
  min_repeat_buyer_rate: { label: 'ผู้ซื้อซ้ำขั้นต่ำ (%)' },
};

export function MarketplaceSellerBadgeSettingsView() {
  const [settings, setSettings] = useState<BadgeSetting[]>([]);
  const [savedSettings, setSavedSettings] = useState<BadgeSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/marketplace/admin/seller-badge-settings', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? 'โหลดการตั้งค่ารางวัลไม่สำเร็จ');
        setSettings(result.settings ?? []);
        setSavedSettings(result.settings ?? []);
        setSetupRequired(Boolean(result.setupRequired));
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'โหลดการตั้งค่ารางวัลไม่สำเร็จ')
      )
      .finally(() => setLoading(false));
  }, []);

  const updateSetting = (badgeKey: BadgeKey, patch: Partial<BadgeSetting>) => {
    setSettings((current) =>
      current.map((setting) =>
        setting.badge_key === badgeKey ? { ...setting, ...patch } : setting
      )
    );
  };

  const updateCriterion = (badgeKey: BadgeKey, key: string, value: number) => {
    setSettings((current) =>
      current.map((setting) =>
        setting.badge_key === badgeKey
          ? { ...setting, criteria: { ...setting.criteria, [key]: value } }
          : setting
      )
    );
  };

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [savedSettings, settings]
  );
  const hasInvalidSettings = useMemo(() => {
    const priorities = settings.map((setting) => setting.priority);
    return (
      new Set(priorities).size !== priorities.length ||
      settings.some(
        (setting) => {
          const hasInvalidCriterion = Object.entries(setting.criteria).some(([key, value]) => {
            const maximum =
              key === 'min_average_rating' ? 5 : key.includes('percent') ? 100 : 1_000_000;
            return !Number.isFinite(value) || value < 0 || value > maximum;
          });
          return (
            !setting.label_th.trim() ||
            !setting.label_en.trim() ||
            !setting.description_th.trim() ||
            !setting.description_en.trim() ||
            !iconOptions.some((option) => option.value === setting.icon_key) ||
            !/^#[0-9a-f]{6}$/i.test(setting.color) ||
            !Number.isInteger(setting.priority) ||
            setting.priority < 0 ||
            setting.priority > 10_000 ||
            !Number.isInteger(setting.evaluation_days) ||
            setting.evaluation_days < 1 ||
            setting.evaluation_days > 3650 ||
            hasInvalidCriterion
          );
        }
      )
    );
  }, [settings]);

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/marketplace/admin/seller-badge-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'บันทึกการตั้งค่าไม่สำเร็จ');
      const nextSettings = (result.settings ?? settings) as BadgeSetting[];
      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      setMessage('บันทึกการตั้งค่ารางวัลผู้ขายแล้ว Badge บนหน้าร้านจะใช้ข้อมูลใหม่ทันที');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'บันทึกการตั้งค่าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: 400, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3, md: 4 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <RiTrophyLine size={30} />
            <Typography component="h1" variant="h3">
              ตั้งค่ารางวัลผู้ขาย
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 820 }}>
            เปิด–ปิดและกำหนดเกณฑ์ Badge อัตโนมัติ ผู้ขายแต่ละร้านสามารถได้รับหลาย Badge พร้อมกัน
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="medium"
            color="inherit"
            disabled={!isDirty || saving}
            onClick={() => {
              setSettings(savedSettings);
              setError('');
              setMessage('');
            }}
          >
            ยกเลิกการแก้ไข
          </Button>
          <Button
            variant="contained"
            size="medium"
            startIcon={<RiSave3Line />}
            loading={saving}
            disabled={setupRequired || !settings.length || !isDirty || hasInvalidSettings}
            onClick={save}
          >
            บันทึกทั้งหมด
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mt: 3 }}>
          {message}
        </Alert>
      )}
      {setupRequired && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          ยังไม่ได้ติดตั้งตารางรางวัลผู้ขาย กรุณารัน migration ล่าสุด
        </Alert>
      )}
      {isDirty && hasInvalidSettings && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          กรุณากรอกชื่อ คำอธิบาย สี HEX และลำดับแสดงผลให้ถูกต้อง โดยลำดับต้องไม่ซ้ำกัน
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mt: 3 }}>
        {settings.map((setting) => {
          const priorityIsDuplicated = settings.some(
            (item) => item.badge_key !== setting.badge_key && item.priority === setting.priority
          );
          const previewBadge: MarketplaceSellerBadge = {
            seller_id: 'preview',
            badge_key: setting.badge_key,
            label_th: setting.label_th,
            label_en: setting.label_en,
            description_th: setting.description_th,
            description_en: setting.description_en,
            icon_key: setting.icon_key,
            color: setting.color,
            priority: setting.priority,
          };
          return (
            <Grid key={setting.badge_key} size={{ xs: 12, lg: 6 }}>
              <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, height: 1 }}>
                <Stack spacing={2.5}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2.5}
                    alignItems={{ sm: 'center' }}
                  >
                    <MarketplaceSellerBadges badges={[previewBadge]} variant="seal" />
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        spacing={1}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Chip
                            size="small"
                            variant="soft"
                            color={setting.is_enabled ? 'success' : 'default'}
                            label={badgeKeyLabels[setting.badge_key]}
                          />
                          <Typography variant="h6" sx={{ mt: 1 }}>
                            {setting.label_th || 'ยังไม่ได้ตั้งชื่อรางวัล'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {setting.label_en || setting.badge_key}
                          </Typography>
                        </Box>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={setting.is_enabled}
                              onChange={(event) =>
                                updateSetting(setting.badge_key, {
                                  is_enabled: event.target.checked,
                                })
                              }
                            />
                          }
                          label={setting.is_enabled ? 'เปิดใช้' : 'ปิดอยู่'}
                          labelPlacement="start"
                          sx={{ m: 0, flexShrink: 0 }}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        ตัวอย่างตราจะแสดงผลตามค่าที่กำลังแก้ไขทันที
                      </Typography>
                    </Box>
                  </Stack>
                  <Divider />

                  <Box>
                    <Typography variant="subtitle1">ข้อมูลที่แสดงบนหน้าร้าน</Typography>
                    <Typography variant="caption" color="text.secondary">
                      ชื่อและคำอธิบายจะแสดงตามภาษาที่ผู้ใช้งานเลือก
                    </Typography>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        required
                        label="ชื่อรางวัล (ไทย)"
                        value={setting.label_th}
                        error={!setting.label_th.trim()}
                        slotProps={{ htmlInput: { maxLength: 60 } }}
                        onChange={(event) =>
                          updateSetting(setting.badge_key, { label_th: event.target.value })
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        required
                        label="ชื่อรางวัล (English)"
                        value={setting.label_en}
                        error={!setting.label_en.trim()}
                        slotProps={{ htmlInput: { maxLength: 60 } }}
                        onChange={(event) =>
                          updateSetting(setting.badge_key, { label_en: event.target.value })
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        required
                        multiline
                        minRows={2}
                        label="คำอธิบาย (ไทย)"
                        value={setting.description_th}
                        error={!setting.description_th.trim()}
                        slotProps={{ htmlInput: { maxLength: 240 } }}
                        onChange={(event) =>
                          updateSetting(setting.badge_key, { description_th: event.target.value })
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        required
                        multiline
                        minRows={2}
                        label="คำอธิบาย (English)"
                        value={setting.description_en}
                        error={!setting.description_en.trim()}
                        slotProps={{ htmlInput: { maxLength: 240 } }}
                        onChange={(event) =>
                          updateSetting(setting.badge_key, { description_en: event.target.value })
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 5 }}>
                      <TextField
                        select
                        fullWidth
                        label="ไอคอน"
                        value={setting.icon_key}
                        onChange={(event) =>
                          updateSetting(setting.badge_key, { icon_key: event.target.value })
                        }
                      >
                        {iconOptions.map((option) => {
                          const Icon = option.icon;
                          return (
                            <MenuItem key={option.value} value={option.value}>
                              <Stack direction="row" spacing={1.25} alignItems="center">
                                <Icon size={19} />
                                <span>{option.label}</span>
                              </Stack>
                            </MenuItem>
                          );
                        })}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 8, sm: 4 }}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Box
                          component="input"
                          type="color"
                          aria-label={`เลือกสีสำหรับ ${setting.label_th}`}
                          value={/^#[0-9a-f]{6}$/i.test(setting.color) ? setting.color : '#1565F5'}
                          onChange={(event) =>
                            updateSetting(setting.badge_key, {
                              color: event.target.value.toUpperCase(),
                            })
                          }
                          sx={{
                            width: 52,
                            height: 56,
                            p: 0.5,
                            flexShrink: 0,
                            cursor: 'pointer',
                            border: '1px solid',
                            borderRadius: 1,
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                          }}
                        />
                        <TextField
                          fullWidth
                          label="สีหลัก (HEX)"
                          value={setting.color}
                          error={!/^#[0-9a-f]{6}$/i.test(setting.color)}
                          helperText={
                            !/^#[0-9a-f]{6}$/i.test(setting.color) ? 'ตัวอย่าง #1565F5' : ' '
                          }
                          slotProps={{ htmlInput: { maxLength: 7 } }}
                          onChange={(event) =>
                            updateSetting(setting.badge_key, {
                              color: event.target.value.toUpperCase(),
                            })
                          }
                        />
                      </Stack>
                    </Grid>
                    <Grid size={{ xs: 4, sm: 3 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="ลำดับ"
                        value={setting.priority}
                        error={
                          priorityIsDuplicated ||
                          !Number.isInteger(setting.priority) ||
                          setting.priority < 0 ||
                          setting.priority > 10000
                        }
                        helperText={priorityIsDuplicated ? 'ลำดับซ้ำ' : ' '}
                        slotProps={{ htmlInput: { min: 0, max: 10000, step: 10 } }}
                        onChange={(event) =>
                          updateSetting(setting.badge_key, {
                            priority: Number(event.target.value),
                          })
                        }
                      />
                    </Grid>
                  </Grid>

                  <Divider />
                  <Box>
                    <Typography variant="subtitle1">เงื่อนไขการได้รับรางวัล</Typography>
                    <Typography variant="caption" color="text.secondary">
                      ระบบคำนวณอัตโนมัติจากยอดขาย รีวิว และอายุร้าน
                    </Typography>
                  </Box>

                  {setting.badge_key !== 'new_creator' && (
                    <TextField
                      type="number"
                      fullWidth
                      label="ช่วงข้อมูลที่ใช้คำนวณ (วัน)"
                      value={setting.evaluation_days}
                      onChange={(event) =>
                        updateSetting(setting.badge_key, {
                          evaluation_days: Number(event.target.value),
                        })
                      }
                      helperText="ระบบประเมินจากข้อมูลย้อนหลังตามจำนวนวันที่กำหนด"
                    />
                  )}

                  <Grid container spacing={2}>
                    {Object.entries(setting.criteria).map(([key, value]) => (
                      <Grid key={key} size={{ xs: 12, sm: 6 }}>
                        <TextField
                          type="number"
                          fullWidth
                          label={criteriaLabels[key]?.label ?? key}
                          helperText={criteriaLabels[key]?.helper}
                          value={value}
                          slotProps={{
                            htmlInput: { min: 0, step: key === 'min_average_rating' ? 0.1 : 1 },
                          }}
                          onChange={(event) =>
                            updateCriterion(setting.badge_key, key, Number(event.target.value))
                          }
                        />
                      </Grid>
                    ))}
                  </Grid>

                  {!setting.is_enabled && (
                    <Alert severity="info" variant="outlined">
                      รางวัลนี้ปิดอยู่ การตั้งค่ายังแก้ไขและบันทึกได้ แต่จะไม่แสดงบนหน้าร้าน
                    </Alert>
                  )}
                </Stack>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Container>
  );
}
