'use client';

import type { RemixiconComponentType } from '@remixicon/react';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import {
  RiFireFill,
  RiStarFill,
  RiHeartFill,
  RiSave3Line,
  RiRocketLine,
  RiTrophyLine,
  RiSparklingLine,
} from 'src/components/remix-icon';

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

const iconByBadge: Record<BadgeKey, RemixiconComponentType> = {
  top_seller: RiTrophyLine,
  highly_rated: RiStarFill,
  best_seller: RiFireFill,
  rising_creator: RiRocketLine,
  customer_favorite: RiHeartFill,
  new_creator: RiSparklingLine,
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
      setMessage('บันทึกเกณฑ์รางวัลผู้ขายแล้ว Badge บนหน้าร้านจะคำนวณด้วยเกณฑ์ใหม่ทันที');
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
        <Box>
          <Button
            variant="contained"
            size="medium"
            startIcon={<RiSave3Line />}
            loading={saving}
            disabled={setupRequired || !settings.length}
            onClick={save}
          >
            บันทึกทั้งหมด
          </Button>
        </Box>
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

      <Grid container spacing={2.5} sx={{ mt: 3 }}>
        {settings.map((setting) => {
          const Icon = iconByBadge[setting.badge_key];
          return (
            <Grid key={setting.badge_key} size={{ xs: 12, lg: 6 }}>
              <Card
                variant="outlined"
                sx={{ p: { xs: 2.5, md: 3 }, height: 1, opacity: setting.is_enabled ? 1 : 0.68 }}
              >
                <Stack spacing={2.5}>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: 2,
                          color: setting.color,
                          bgcolor: `color-mix(in srgb, ${setting.color} 12%, transparent)`,
                        }}
                      >
                        <Icon size={24} />
                      </Box>
                      <Box>
                        <Typography variant="h6">{setting.label_th}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {setting.description_th}
                        </Typography>
                      </Box>
                    </Stack>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={setting.is_enabled}
                          onChange={(event) =>
                            updateSetting(setting.badge_key, { is_enabled: event.target.checked })
                          }
                        />
                      }
                      label={setting.is_enabled ? 'เปิด' : 'ปิด'}
                      labelPlacement="start"
                      sx={{ m: 0, flexShrink: 0 }}
                    />
                  </Stack>

                  <Chip
                    size="small"
                    variant="outlined"
                    label={setting.label_en}
                    sx={{
                      alignSelf: 'flex-start',
                      color: setting.color,
                      borderColor: setting.color,
                    }}
                  />
                  <Divider />

                  {setting.badge_key !== 'new_creator' && (
                    <TextField
                      type="number"
                      fullWidth
                      label="ช่วงข้อมูลที่ใช้คำนวณ (วัน)"
                      value={setting.evaluation_days}
                      disabled={!setting.is_enabled}
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
                          disabled={!setting.is_enabled}
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
                </Stack>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Container>
  );
}
