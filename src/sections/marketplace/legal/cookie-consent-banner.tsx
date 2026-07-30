'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RiShieldCheckLine } from 'src/components/remix-icon';

import {
  readCookieConsent,
  writeCookieConsent,
  OPEN_COOKIE_SETTINGS_EVENT,
} from './cookie-consent';

const VISITOR_STORAGE_KEY = 'ekru_marketplace_visitor_id';

export function MarketplaceCookieConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(!readCookieConsent());
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  const choose = (choice: 'all' | 'necessary') => {
    if (choice === 'necessary') window.localStorage.removeItem(VISITOR_STORAGE_KEY);
    writeCookieConsent(choice);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2.5 },
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 1500,
        position: 'fixed',
        pointerEvents: 'none',
      }}
    >
      <Paper
        role="dialog"
        aria-label="ตั้งค่าคุกกี้"
        elevation={16}
        sx={{
          p: { xs: 2.25, sm: 2.75 },
          mx: 'auto',
          maxWidth: 1040,
          borderRadius: 2.5,
          pointerEvents: 'auto',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2.5}
          alignItems={{ md: 'center' }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box
              sx={{
                p: 1,
                mt: 0.25,
                display: 'flex',
                flexShrink: 0,
                borderRadius: 1.5,
                color: 'primary.main',
                bgcolor: 'primary.lighter',
              }}
            >
              <RiShieldCheckLine size={22} />
            </Box>
            <Box>
              <Typography variant="subtitle1">เราให้ความสำคัญกับความเป็นส่วนตัว</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.7 }}>
                E-KRU ใช้คุกกี้ที่จำเป็นเพื่อการเข้าสู่ระบบ ความปลอดภัย ตะกร้าสินค้า
                และการตั้งค่าหน้าจอ ส่วนข้อมูลการเข้าชมจะใช้เมื่อคุณยอมรับทั้งหมดเท่านั้น{' '}
                <Typography
                  component={RouterLink}
                  href={paths.legal.cookiePolicy}
                  variant="body2"
                  color="primary"
                  sx={{ textDecoration: 'underline' }}
                >
                  อ่าน Cookie Policy
                </Typography>
              </Typography>
            </Box>
          </Stack>
          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            spacing={1}
            sx={{ flexShrink: 0 }}
          >
            <Button color="inherit" variant="outlined" onClick={() => choose('necessary')}>
              เฉพาะที่จำเป็น
            </Button>
            <Button variant="contained" onClick={() => choose('all')}>
              ยอมรับทั้งหมด
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
