import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { RiHome5Line, RiDashboardLine } from 'src/components/remix-icon';

type StarterPageProps = {
  mode: 'main' | 'dashboard';
};

const pageContent = {
  main: {
    eyebrow: 'MAIN PAGE',
    title: 'เริ่มต้นโปรเจกต์ eKru ใหม่',
    description: 'พื้นที่หน้าเว็บหลักพร้อมแล้วสำหรับออกแบบและพัฒนาฟีเจอร์ใหม่',
    icon: RiHome5Line,
  },
  dashboard: {
    eyebrow: 'DASHBOARD',
    title: 'Dashboard เริ่มต้น',
    description: 'โครง Dashboard พร้อมแล้วสำหรับเพิ่มข้อมูล เครื่องมือ และการจัดการระบบ',
    icon: RiDashboardLine,
  },
} as const;

export function StarterPage({ mode }: StarterPageProps) {
  const content = pageContent[mode];
  const PageIcon = content.icon;

  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          minHeight: mode === 'main' ? 'calc(100vh - 96px)' : 'calc(100vh - 120px)',
          py: { xs: 8, md: 12 },
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Stack spacing={3} sx={{ maxWidth: 680, textAlign: 'center', alignItems: 'center' }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              display: 'grid',
              borderRadius: 3,
              color: 'primary.main',
              placeItems: 'center',
              bgcolor: 'primary.lighter',
            }}
          >
            <PageIcon size={36} />
          </Box>

          <Chip label={content.eyebrow} color="primary" variant="soft" />

          <Typography variant="h2" component="h1">
            {content.title}
          </Typography>

          <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 400 }}>
            {content.description}
          </Typography>
        </Stack>
      </Box>
    </Container>
  );
}
