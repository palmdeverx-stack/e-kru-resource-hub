'use client';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Logo } from 'src/components/logo';
import { RiMailLine, RiShieldCheckLine, RiCustomerService2Line } from 'src/components/remix-icon';

type FooterLink = {
  label: string;
  href: string;
};

const marketplaceLinks: FooterLink[] = [
  { label: 'หน้าแรก Marketplace', href: paths.marketplace.root },
  { label: 'สื่อการสอนทั้งหมด', href: paths.marketplace.products },
  { label: 'ร้านค้าใน Marketplace', href: paths.marketplace.stores },
  { label: 'ตะกร้าสินค้า', href: paths.marketplace.cart },
  { label: 'รายการซื้อของฉัน', href: paths.marketplace.purchases },
];

const sellerLinks: FooterLink[] = [
  { label: 'เปิดร้านขายสื่อ', href: paths.marketplace.sellerSetup },
  { label: 'ร้านค้าของฉัน', href: paths.marketplace.seller },
  { label: 'ลงสินค้าใหม่', href: paths.marketplace.productNew },
  { label: 'รายได้ของร้าน', href: paths.marketplace.sellerFinance },
];

const supportLinks: FooterLink[] = [
  { label: 'เข้าสู่ระบบ', href: paths.auth.jwt.signIn },
  { label: 'Terms of Service', href: paths.legal.termsOfService },
  { label: 'Seller Agreement', href: paths.legal.sellerAgreement },
  { label: 'Privacy Policy (PDPA)', href: paths.legal.privacyPolicy },
  { label: 'Copyright & Takedown Policy', href: paths.legal.copyrightTakedown },
  { label: 'Refund Policy', href: paths.legal.refundPolicy },
];

export function MarketplaceFooter() {
  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        color: 'common.white',
        bgcolor: '#071B3A',
        backgroundImage:
          'radial-gradient(circle at 8% 8%, rgba(21,101,245,0.32), transparent 30%), radial-gradient(circle at 92% 92%, rgba(24,185,160,0.16), transparent 28%)',
      }}
    >
      <Container maxWidth="lg" sx={{ pt: { xs: 7, md: 9 }, pb: 3 }}>
        <Grid container spacing={{ xs: 5, md: 6 }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Box sx={{ maxWidth: 440 }}>
              <Stack direction="row" spacing={1.75} alignItems="center">
                <Box
                  sx={{
                    p: 0.75,
                    display: 'grid',
                    flexShrink: 0,
                    borderRadius: 2.25,
                    bgcolor: 'common.white',
                    placeItems: 'center',
                  }}
                >
                  <Logo />
                </Box>
                <Box>
                  <Typography variant="h5">E-KRU Marketplace</Typography>
                  <Typography variant="caption" sx={{ color: '#82B1FF', fontWeight: 700 }}>
                    จากครู เพื่อการเรียนรู้ที่ดีขึ้น
                  </Typography>
                </Box>
              </Stack>

              <Typography
                variant="body2"
                sx={{ mt: 2.5, maxWidth: 420, color: 'rgba(255,255,255,0.68)', lineHeight: 1.9 }}
              >
                พื้นที่ค้นหา ซื้อ และแบ่งปันสื่อการสอนคุณภาพจากครูและนักสร้างสรรค์ทั่วประเทศ
                เชื่อมต่อกับระบบ E-KRU ด้วยบัญชีเดียว
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2.5 }}>
                <FooterBadge label="บัญชีเดียวกับ E-KRU" />
                <FooterBadge label="สินค้าผ่านการตรวจสอบ" />
              </Stack>

              <Stack spacing={1.25} sx={{ mt: 3 }}>
                <ContactLink
                  icon={<RiMailLine size={18} />}
                  href="mailto:ekru.team@gmail.com"
                  label="ekru.team@gmail.com"
                />
                <ContactLink
                  icon={<RiCustomerService2Line size={18} />}
                  href="mailto:ekru.team@gmail.com?subject=E-KRU Marketplace Support"
                  label="ติดต่อฝ่ายช่วยเหลือ Marketplace"
                />
              </Stack>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
            <FooterLinkGroup title="Marketplace" links={marketplaceLinks} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2.25 }}>
            <FooterLinkGroup title="สำหรับผู้ขาย" links={sellerLinks} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2.25 }}>
            <FooterLinkGroup title="ช่วยเหลือและกฎหมาย" links={supportLinks} />
          </Grid>
        </Grid>

        <Divider sx={{ mt: { xs: 6, md: 8 }, mb: 3, borderColor: 'rgba(255,255,255,0.12)' }} />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
        >
          <Stack>
            <Typography variant="caption">
              © {year} E-KRU Marketplace. All rights reserved.
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Developed by CODE FOR CAT.
            </Typography>
          </Stack>

          <Stack direction="row" spacing={2}>
            <Link
              component={RouterLink}
              href={paths.legal.privacyPolicy}
              underline="hover"
              sx={{ typography: 'caption', color: 'rgba(255,255,255,0.5)' }}
            >
              Privacy
            </Link>
            <Link
              component={RouterLink}
              href={paths.legal.termsOfService}
              underline="hover"
              sx={{ typography: 'caption', color: 'rgba(255,255,255,0.5)' }}
            >
              Terms
            </Link>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function FooterBadge({ label }: { label: string }) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{
        px: 1.25,
        py: 0.75,
        borderRadius: 10,
        color: 'rgba(255,255,255,0.78)',
        bgcolor: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <RiShieldCheckLine size={15} color="#5BE1B5" />
      <Typography variant="caption">{label}</Typography>
    </Stack>
  );
}

function ContactLink({
  icon,
  href,
  label,
}: {
  icon: React.ReactNode;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      underline="hover"
      sx={{
        gap: 1,
        width: 'fit-content',
        display: 'flex',
        alignItems: 'center',
        color: 'rgba(255,255,255,0.68)',
        typography: 'body2',
        '&:hover': { color: 'common.white' },
      }}
    >
      {icon}
      {label}
    </Link>
  );
}

function FooterLinkGroup({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <Box component="nav" aria-label={title}>
      <Typography variant="subtitle2" sx={{ color: 'common.white' }}>
        {title}
      </Typography>
      <Stack spacing={1.5} sx={{ mt: 2 }}>
        {links.map((item) => (
          <Link
            key={`${item.href}-${item.label}`}
            component={RouterLink}
            href={item.href}
            underline="none"
            sx={{
              width: 'fit-content',
              color: 'rgba(255,255,255,0.62)',
              typography: 'body2',
              transition: 'color 160ms ease, transform 160ms ease',
              '&:hover': { color: 'common.white', transform: 'translateX(3px)' },
            }}
          >
            {item.label}
          </Link>
        ))}
      </Stack>
    </Box>
  );
}
