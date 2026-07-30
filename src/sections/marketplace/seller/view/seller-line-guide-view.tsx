'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RiArrowLeftLine, RiExternalLinkLine } from 'src/components/remix-icon';

const STEPS = [
  {
    title: 'สร้าง LINE Official Account และเปิด Messaging API',
    detail:
      'สร้างบัญชีผ่าน LINE Official Account Manager แล้วเปิดใช้งาน Messaging API ระบบจะสร้าง Messaging API channel ให้',
  },
  {
    title: 'เพิ่ม Official Account เป็นเพื่อน',
    detail:
      'ในแท็บ Messaging API ให้สแกน QR code ด้วย LINE ของผู้รับแจ้งเตือน หากยังไม่ได้เป็นเพื่อน Bot จะส่งข้อความไม่ได้',
  },
  {
    title: 'ออก Channel access token',
    detail:
      'ไปที่ LINE Developers Console > Messaging API channel > แท็บ Messaging API > Channel access token แล้วกด Issue แนะนำ Long-lived token',
  },
  {
    title: 'คัดลอก Your user ID',
    detail:
      'ไปที่แท็บ Basic settings แล้วคัดลอกค่า Your user ID ซึ่งขึ้นต้นด้วย U และมีทั้งหมด 33 ตัวอักษร อย่าใช้ LINE ID หรือ @Basic ID',
  },
  {
    title: 'บันทึกและทดสอบใน E-KRU Marketplace',
    detail:
      'วาง Token กับ User ID ในหน้าตั้งค่า กดบันทึก แล้วกดส่งข้อความทดสอบ เมื่อได้รับข้อความจึงเปิดใช้งานการแจ้งเตือน',
  },
];

export function MarketplaceSellerLineGuideView() {
  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Button
        component={RouterLink}
        href={paths.marketplace.sellerLineSettings}
        color="inherit"
        startIcon={<RiArrowLeftLine />}
        sx={{ mb: 3 }}
      >
        กลับไปตั้งค่า LINE
      </Button>
      <Typography component="h1" variant="h3">
        วิธีเตรียมข้อมูล LINE
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>
        สำหรับผู้ขายที่ต้องการรับแจ้งเตือนยอดขายด้วย LINE Official Account ของตนเอง
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        คุณต้องมีสิทธิ์ Admin ของ LINE Official Account และ LINE Developers provider ที่ใช้สร้าง
        Channel
      </Alert>

      <Stack spacing={2}>
        {STEPS.map((step, index) => (
          <Card key={step.title} variant="outlined" sx={{ p: 3 }}>
            <Stack direction="row" spacing={2.5} alignItems="flex-start">
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  borderRadius: '50%',
                  color: 'primary.contrastText',
                  bgcolor: 'primary.main',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 700,
                }}
              >
                {index + 1}
              </Box>
              <Box>
                <Typography variant="h6">{step.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {step.detail}
                </Typography>
              </Box>
            </Stack>
          </Card>
        ))}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
        <Button
          href="https://manager.line.biz/"
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
          endIcon={<RiExternalLinkLine />}
        >
          LINE Official Account Manager
        </Button>
        <Button
          href="https://developers.line.biz/console/"
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
          endIcon={<RiExternalLinkLine />}
        >
          LINE Developers Console
        </Button>
      </Stack>

      <Alert severity="warning" sx={{ mt: 3 }}>
        Channel access token เป็นข้อมูลลับ หากสงสัยว่ารั่วไหลให้ Revoke/Issue ใหม่ใน LINE Developers
        แล้วนำ Token ใหม่มาบันทึกทันที
      </Alert>
    </Container>
  );
}
