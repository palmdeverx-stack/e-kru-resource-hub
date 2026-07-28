"use client";

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Logo } from 'src/components/logo';
import {
  RiHome5Line,
  RiStore2Line,
  RiDashboardLine,
  RiAddCircleLine,
  RiShoppingCart2Line,
  RiCustomerService2Line,
} from 'src/components/remix-icon';

const marketplaceLinks = [
  { label: 'หน้าหลัก Marketplace', href: paths.marketplace.root, icon: RiHome5Line },
  { label: 'ตะกร้าสินค้า', href: paths.marketplace.cart, icon: RiShoppingCart2Line },
  { label: 'แดชบอร์ดของฉัน', href: paths.marketplace.dashboard, icon: RiDashboardLine },
] as const;

const sellerLinks = [
  { label: 'ร้านค้าของฉัน', href: paths.marketplace.seller, icon: RiStore2Line },
  { label: 'ลงสินค้าใหม่', href: paths.marketplace.productNew, icon: RiAddCircleLine },
] as const;

export function MarketplaceFooter() {
  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        color: 'common.white',
        bgcolor: 'transparent',
        backgroundImage:
          'radial-gradient(circle at 12% 12%, rgba(44, 126, 255, 0.28), transparent 32%), radial-gradient(circle at 88% 84%, rgba(24, 185, 160, 0.14), transparent 28%)',
      }}
    >
      <Container maxWidth="lg" sx={{ pt: { xs: 6, md: 8 }, pb: 3 }}>
        <Box
          sx={{
            gap: { xs: 5, md: 8 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(300px, 1.3fr) 1fr 1fr' },
          }}
        >
          <Box sx={{ maxWidth: 440 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  p: 0.75,
                  display: 'grid',
                  borderRadius: 2,
                  bgcolor: 'common.white',
                  placeItems: 'center',
                }}
              >
                <Logo />
              </Box>
              <Box>
                <Typography variant="h5">eKru Marketplace</Typography>
                <Typography variant="caption" sx={{ color: '#74A8FF', fontWeight: 700 }}>
                  ตลาดสื่อการสอนสำหรับทุกคน
                </Typography>
              </Box>
            </Stack>
            <Typography
              variant="body2"
              sx={{ mt: 2.5, color: 'rgba(255,255,255,0.68)', lineHeight: 1.9 }}
            >
              พื้นที่ค้นหา ซื้อ และแบ่งปันสื่อการสอนคุณภาพจากครู ผู้สร้างสรรค์ และองค์กรการศึกษา
              เชื่อมต่อด้วยบัญชีเดียวกับ eKru
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2.5 }}>
              <RiCustomerService2Line color="#74A8FF" />
              <Link
                href="mailto:ekru.team@gmail.com"
                color="inherit"
                underline="hover"
                sx={{ typography: 'body2' }}
              >
                ekru.team@gmail.com
              </Link>
            </Stack>
          </Box>

          <FooterLinkGroup title="Marketplace" links={marketplaceLinks} />
          <FooterLinkGroup title="สำหรับผู้ขาย" links={sellerLinks} />
        </Box>

        <Divider sx={{ mt: { xs: 5, md: 7 }, mb: 3, borderColor: 'rgba(255,255,255,0.12)' }} />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
        >
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.52)' }}>
            © {year} eKru Marketplace. All rights reserved.
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.52)' }}>
            จากครู เพื่อการเรียนรู้ที่ดีขึ้น
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}

function FooterLinkGroup({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{
    label: string;
    href: string;
    icon: typeof RiHome5Line;
  }>;
}) {
  return (
    <Box component="nav" aria-label={title}>
      <Typography variant="overline" sx={{ color: '#74A8FF', letterSpacing: 1 }}>
        {title}
      </Typography>
      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              component={RouterLink}
              href={item.href}
              underline="none"
              sx={{
                gap: 1,
                width: 'fit-content',
                display: 'flex',
                alignItems: 'center',
                color: 'rgba(255,255,255,0.68)',
                typography: 'body2',
                transition: 'color 160ms ease',
                '&:hover': { color: 'common.white' },
              }}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </Stack>
    </Box>
  );
}
