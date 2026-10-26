'use client';

import Button from '@mui/material/Button';

export function LineLoginButton({ returnTo }: { returnTo?: string | null }) {
  if (!process.env.NEXT_PUBLIC_LIFF_ID) return null;
  const destination = `/auth/line${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
  return (
    <Button
      fullWidth
      href={destination}
      variant="outlined"
      sx={{ mt: 2, color: '#06C755', borderColor: '#06C755' }}
    >
      เข้าสู่ระบบ / เชื่อมบัญชีด้วย LINE
    </Button>
  );
}
