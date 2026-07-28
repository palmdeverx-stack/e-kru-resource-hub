'use client';

import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

import {
  RiStore2Line,
  RiBookOpenLine,
  RiArrowRightLine,
  RiShoppingBag3Line,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

const actions = [
  {
    title: 'เลือกซื้อสื่อการสอน',
    description: 'ค้นหาใบงาน แผนการสอน และสื่อใหม่จากชุมชน',
    href: '/',
    icon: RiBookOpenLine,
    color: 'primary.lighter',
  },
  {
    title: 'รายการซื้อของฉัน',
    description: 'ตรวจสอบคำสั่งซื้อและดาวน์โหลดไฟล์ที่ซื้อแล้ว',
    href: '/dashboard/purchases',
    icon: RiShoppingBag3Line,
    color: 'info.lighter',
  },
  {
    title: 'ร้านค้าของฉัน',
    description: 'เปิดร้าน ลงสินค้า และจัดการผลงานของคุณ',
    href: '/dashboard/seller',
    icon: RiStore2Line,
    color: 'warning.lighter',
  },
] as const;

export function MarketplaceDashboardOverviewView() {
  const { user } = useAuthContext();

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography component="h1" variant="h3">
        สวัสดี {user?.displayName || user?.username}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
        ยินดีต้อนรับสู่ eKru Marketplace
      </Typography>

      <Grid container spacing={3} sx={{ mt: 3 }}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Grid key={action.href} size={{ xs: 12, md: 4 }}>
              <Card sx={{ p: 3, height: 1 }}>
                <Stack spacing={2}>
                  <Stack
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 2,
                      placeItems: 'center',
                      display: 'inline-grid',
                      bgcolor: action.color,
                    }}
                  >
                    <Icon size={28} />
                  </Stack>
                  <Typography variant="h5">{action.title}</Typography>
                  <Typography color="text.secondary">{action.description}</Typography>
                  <Button
                    component={RouterLink}
                    href={action.href}
                    endIcon={<RiArrowRightLine />}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    ไปที่หน้านี้
                  </Button>
                </Stack>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Container>
  );
}
