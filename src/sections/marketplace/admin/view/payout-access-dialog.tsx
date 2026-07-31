'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';

import { Logo } from 'src/components/logo';

type Props = {
  open: boolean;
  onClose: () => void;
  onGranted: () => void;
};

export function MarketplacePayoutAccessDialog({ open, onClose, onGranted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setCode('');
      setError('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/marketplace/admin/payout-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      onGranted();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ยืนยันรหัสไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        paper: {
          sx: {
            m: 2,
            maxWidth: 420,
            borderRadius: 4,
            boxShadow: '0 24px 80px rgba(21, 101, 245, 0.24)',
          },
        },
        backdrop: {
          sx: {
            bgcolor: 'rgba(80, 145, 230, 0.28)',
            backdropFilter: 'blur(5px)',
          },
        },
      }}
    >
      <Box component="form" onSubmit={submit} sx={{ p: { xs: 3, sm: 4 } }}>
        <Logo disabled isSingle={false} sx={{ width: 112, height: 42, mb: 3.5 }} />

        <Typography component="h2" variant="h5">
          ยืนยัน PIN
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          กรอก PIN ผู้ดูแลระบบ 4 หลักเพื่อเข้าสู่หน้าโอนเงินให้ผู้ขาย
        </Typography>

        {!!error && (
          <Alert severity="error" sx={{ mt: 2.5 }}>
            {error}
          </Alert>
        )}

        <Box
          onClick={() => inputRef.current?.focus()}
          sx={{
            gap: 1.25,
            mt: 3,
            display: 'grid',
            cursor: 'text',
            position: 'relative',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          }}
        >
          <Box
            ref={inputRef}
            component="input"
            aria-label="PIN ผู้ดูแลระบบ 4 หลัก"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={code}
            disabled={loading}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
            sx={{
              inset: 0,
              width: 1,
              height: 1,
              opacity: 0,
              border: 0,
              position: 'absolute',
              cursor: 'text',
            }}
          />
          {[0, 1, 2, 3].map((index) => {
            const activeIndex = Math.min(code.length, 3);
            const active = index === activeIndex;
            return (
              <Box
                key={index}
                aria-hidden="true"
                sx={{
                  height: 54,
                  display: 'grid',
                  borderRadius: 1.5,
                  placeItems: 'center',
                  color: code[index] ? 'text.primary' : 'text.disabled',
                  bgcolor: 'background.neutral',
                  border: '1.5px solid',
                  borderColor: active ? 'text.primary' : 'divider',
                  fontSize: 22,
                  fontWeight: 700,
                  transition: 'border-color 150ms ease, box-shadow 150ms ease',
                  ...(active && { boxShadow: '0 0 0 2px rgba(21, 101, 245, 0.08)' }),
                }}
              >
                {code[index] ? '●' : '–'}
              </Box>
            );
          })}
        </Box>

        <Button
          fullWidth
          type="submit"
          size="large"
          variant="contained"
          loading={loading}
          disabled={code.length !== 4}
          sx={{ mt: 3.5, py: 1.35, boxShadow: '0 10px 24px rgba(21, 101, 245, 0.24)' }}
        >
          ยืนยัน PIN
        </Button>
        <Button fullWidth color="inherit" onClick={onClose} disabled={loading} sx={{ mt: 1.5 }}>
          กลับไปหน้าแดชบอร์ด
        </Button>
      </Box>
    </Dialog>
  );
}
