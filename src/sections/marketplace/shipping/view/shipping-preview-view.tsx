'use client';

import type { MarketplaceShippingConfig } from '../server/config';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Step from '@mui/material/Step';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stepper from '@mui/material/Stepper';
import Container from '@mui/material/Container';
import StepLabel from '@mui/material/StepLabel';
import Typography from '@mui/material/Typography';

import {
  RiBox3Line,
  RiTruckLine,
  RiMapPinLine,
  RiFileList3Line,
  RiSettings3Line,
  RiArrowRightLine,
  RiShoppingCart2Line,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

type Props = { config: MarketplaceShippingConfig };

type Rate = {
  id: string;
  courier: string;
  service: string;
  price: number;
  eta: string;
};

const FLOW_STEPS = ['ข้อมูลพัสดุ', 'เปรียบเทียบราคา', 'ชำระเงิน', 'เตรียมจัดส่ง', 'ติดตามสถานะ'];

const MOCK_RATES: Rate[] = [
  { id: 'flash', courier: 'Flash Express', service: 'Standard', price: 35, eta: '1–3 วัน' },
  { id: 'ems', courier: 'Thailand Post', service: 'EMS', price: 42, eta: '1–2 วัน' },
  { id: 'kerry', courier: 'Kerry Express', service: 'Standard', price: 45, eta: '1–2 วัน' },
];

const TRACKING_EVENTS = [
  { label: 'สร้างรายการจัดส่งแล้ว', time: '10:05 น.' },
  { label: 'ขนส่งเข้ารับพัสดุ', time: '13:40 น.' },
  { label: 'พัสดุอยู่ระหว่างการขนส่ง', time: 'วันถัดไป 08:15 น.' },
  { label: 'จัดส่งสำเร็จ', time: 'วันถัดไป 15:20 น.' },
];

function formatPrice(value: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(value);
}

export function MarketplaceShippingPreviewView({ config }: Props) {
  const [selectedRateId, setSelectedRateId] = useState(MOCK_RATES[0].id);
  const [demoStage, setDemoStage] = useState<0 | 1 | 2>(0);
  const selectedRate = MOCK_RATES.find((rate) => rate.id === selectedRateId) ?? MOCK_RATES[0];

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3, md: 4 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'center' }}
        spacing={2}
      >
        <Box>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Typography component="h1" variant="h3">
              การจัดส่งสินค้า
            </Typography>
            <Chip color="warning" variant="soft" label="Preview" />
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            ตัวอย่าง Flow เชื่อม SHIPPOP ตั้งแต่ข้อมูลพัสดุจนถึง Webhook จัดส่งสำเร็จ
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip
            color={config.enabled ? 'success' : 'default'}
            label={config.enabled ? 'เปิดใช้งานแล้ว' : 'Feature ปิดอยู่'}
          />
          <Chip
            color={config.providerConfigured ? 'success' : 'warning'}
            variant="outlined"
            label={config.providerConfigured ? 'พร้อมเชื่อม API' : 'ยังไม่มี API Key'}
          />
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mt: 3 }}>
        หน้านี้ใช้ข้อมูลจำลองเท่านั้น ยังไม่เรียก SHIPPOP API ไม่คิดค่าขนส่ง
        และไม่เปลี่ยนแปลงคำสั่งซื้อจริง
      </Alert>

      <Card variant="outlined" sx={{ mt: 3, p: { xs: 2, md: 3 } }}>
        <Stepper activeStep={demoStage === 0 ? 1 : demoStage === 1 ? 3 : 4} alternativeLabel>
          {FLOW_STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Card>

      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={3}>
            <FlowCard
              number="1"
              icon={<RiBox3Line size={24} />}
              title="ผู้ขายกำหนดข้อมูลพัสดุ"
              description="บันทึกข้อมูลไว้กับสินค้าจัดส่ง เพื่อใช้คำนวณราคาใน Checkout"
            >
              <Grid container spacing={1.5}>
                {[
                  ['น้ำหนัก', '850 กรัม'],
                  ['กว้าง', '20 ซม.'],
                  ['ยาว', '28 ซม.'],
                  ['สูง', '8 ซม.'],
                ].map(([label, value]) => (
                  <Grid key={label} size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.neutral' }}>
                      <Typography variant="caption" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography variant="subtitle2">{value}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </FlowCard>

            <FlowCard
              number="2"
              icon={<RiShoppingCart2Line size={24} />}
              title="แยกพัสดุตามผู้ขาย"
              description="หนึ่งตะกร้าสามารถมีหลายร้าน ระบบคำนวณและสร้าง Shipment แยกกัน"
            >
              <Stack divider={<Divider flexItem />}>
                <ShipmentGroup seller="ร้านครูเมย์" items="สมุดกิจกรรม × 1" origin="กรุงเทพฯ" />
                <ShipmentGroup seller="บ้านสื่อเรียนรู้" items="บัตรคำ × 2" origin="เชียงใหม่" />
              </Stack>
            </FlowCard>

            <FlowCard
              number="3"
              icon={<RiTruckLine size={24} />}
              title="Checkout เปรียบเทียบค่าขนส่ง"
              description="SHIPPOP ส่งราคาและระยะเวลาโดยประมาณกลับมาให้ผู้ซื้อเลือกต่อร้าน"
            >
              <Stack spacing={1.25}>
                {MOCK_RATES.map((rate) => {
                  const selected = selectedRateId === rate.id;
                  return (
                    <Card
                      key={rate.id}
                      variant="outlined"
                      onClick={() => setSelectedRateId(rate.id)}
                      sx={{
                        p: 1.5,
                        cursor: 'pointer',
                        borderColor: selected ? 'primary.main' : 'divider',
                        bgcolor: selected ? 'primary.lighter' : 'background.paper',
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Radio checked={selected} value={rate.id} />
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography variant="subtitle2">{rate.courier}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {rate.service} · ประมาณ {rate.eta}
                          </Typography>
                        </Box>
                        <Typography variant="subtitle1" color="primary.main">
                          {formatPrice(rate.price)}
                        </Typography>
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            </FlowCard>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={3} sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
            <Card sx={{ p: 3 }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box sx={{ color: 'primary.main' }}>
                  <RiFileList3Line size={26} />
                </Box>
                <Box>
                  <Typography variant="h6">จำลองหลังชำระเงิน</Typography>
                  <Typography variant="caption" color="text.secondary">
                    ออเดอร์ MKP-2026-00125
                  </Typography>
                </Box>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={1.25}>
                <SummaryRow label="ขนส่งที่เลือก" value={selectedRate.courier} />
                <SummaryRow label="ค่าขนส่ง" value={formatPrice(selectedRate.price)} />
                <SummaryRow label="สถานะชำระเงิน" value="ชำระแล้ว" />
              </Stack>

              {demoStage === 0 && (
                <Button
                  fullWidth
                  variant="contained"
                  endIcon={<RiArrowRightLine />}
                  onClick={() => setDemoStage(1)}
                  sx={{ mt: 2.5 }}
                >
                  ผู้ขายกดเตรียมจัดส่ง
                </Button>
              )}

              {demoStage >= 1 && (
                <Alert severity="success" sx={{ mt: 2.5 }}>
                  <Typography variant="subtitle2">สร้าง Tracking สำเร็จ</Typography>
                  <Typography variant="body2">TH0123456789</Typography>
                </Alert>
              )}

              {demoStage === 1 && (
                <Stack spacing={1} sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<RiFileList3Line />}>
                    ดูตัวอย่างใบปะหน้า
                  </Button>
                  <Button variant="contained" onClick={() => setDemoStage(2)}>
                    จำลอง Webhook จัดส่งสำเร็จ
                  </Button>
                </Stack>
              )}

              {demoStage === 2 && (
                <Button fullWidth color="inherit" onClick={() => setDemoStage(0)} sx={{ mt: 2 }}>
                  เริ่มตัวอย่างใหม่
                </Button>
              )}
            </Card>

            <Card variant="outlined" sx={{ p: 3 }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <RiCheckboxCircleLine size={25} />
                <Typography variant="h6">สถานะจาก Webhook</Typography>
              </Stack>
              <Stack spacing={2} sx={{ mt: 2.5 }}>
                {TRACKING_EVENTS.map((event, index) => {
                  const visible = demoStage === 2 || index === 0 || (demoStage === 1 && index < 2);
                  return (
                    <Stack
                      key={event.label}
                      direction="row"
                      spacing={1.5}
                      sx={{ opacity: visible ? 1 : 0.35 }}
                    >
                      <Box
                        sx={{
                          mt: 0.5,
                          width: 10,
                          height: 10,
                          flexShrink: 0,
                          borderRadius: '50%',
                          bgcolor: visible ? 'success.main' : 'text.disabled',
                        }}
                      />
                      <Box>
                        <Typography variant="subtitle2">{event.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {visible ? event.time : 'รออัปเดต'}
                        </Typography>
                      </Box>
                    </Stack>
                  );
                })}
              </Stack>
            </Card>

            <Alert severity="warning" icon={<RiSettings3Line />}>
              เปิดใช้งานจริงภายหลังด้วยตัวแปร <strong>MARKETPLACE_SHIPPING_ENABLED=true</strong>
              และเพิ่ม SHIPPOP API Key ฝั่ง Server
            </Alert>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

function FlowCard({
  number,
  icon,
  title,
  description,
  children,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          sx={{
            width: 42,
            height: 42,
            display: 'grid',
            flexShrink: 0,
            borderRadius: 2,
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: 'primary.lighter',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="overline" color="primary.main">
            ขั้นตอนที่ {number}
          </Typography>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        </Box>
      </Stack>
      <Box sx={{ mt: 2.5 }}>{children}</Box>
    </Card>
  );
}

function ShipmentGroup({
  seller,
  items,
  origin,
}: {
  seller: string;
  items: string;
  origin: string;
}) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.5 }}>
      <Box sx={{ color: 'text.secondary' }}>
        <RiMapPinLine size={22} />
      </Box>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle2">{seller}</Typography>
        <Typography variant="caption" color="text.secondary">
          {items} · ต้นทาง {origin}
        </Typography>
      </Box>
      <Chip size="small" variant="soft" label="1 พัสดุ" />
    </Stack>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle2" sx={{ textAlign: 'right' }}>
        {value}
      </Typography>
    </Stack>
  );
}
