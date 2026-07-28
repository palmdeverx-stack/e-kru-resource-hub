'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

import { RiCheckLine, RiDownloadCloud2Line } from 'src/components/remix-icon';

export function MarketplaceOrderSuccessView({ demo = false }: { demo?: boolean }) {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 8, md: 12 } }}>
      <Card sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
        <Box
          sx={{
            width: 88,
            height: 88,
            mx: 'auto',
            display: 'grid',
            borderRadius: '50%',
            placeItems: 'center',
            color: 'success.main',
            bgcolor: 'success.lighter',
          }}
        >
          <RiCheckLine size={48} />
        </Box>
        <Typography variant="h3" sx={{ mt: 3 }}>
          สั่งซื้อสำเร็จ
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {demo
            ? 'นี่เป็นคำสั่งซื้อสาธิต เมื่อมีสินค้าจริงระบบจะบันทึกลงรายการซื้อของคุณ'
            : 'บันทึกคำสั่งซื้อแล้ว คุณสามารถดาวน์โหลดสื่อดิจิทัลได้จากรายการซื้อ'}
        </Typography>
        <Stack spacing={1.5} sx={{ mt: 4 }}>
          <Button
            component={RouterLink}
            href="/dashboard/purchases"
            variant="contained"
            startIcon={<RiDownloadCloud2Line />}
          >
            ดูรายการซื้อของฉัน
          </Button>
          <Button component={RouterLink} href="/" color="inherit">
            กลับไปเลือกสื่อ
          </Button>
        </Stack>
      </Card>
    </Container>
  );
}
