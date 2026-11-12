'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { apiFetch as fetch } from 'src/lib/api-fetch';

type Props = { sellerId: string; shopName: string; onClose: () => void };
type Preview = {
  replyTo?: string | null;
  fromEmail: string | null;
  to: string;
  subject: string;
  html: string;
};

export function SellerReminderDialog({ sellerId, shopName, onClose }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const endpoint = `/api/marketplace/admin/seller-accounts/${sellerId}/reminder`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        if (!controller.signal.aborted) setPreview(result);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'โหลดตัวอย่างอีเมลไม่สำเร็จ');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint]);
  const send = async () => {
    setSending(true);
    setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setSent(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'ส่งอีเมลไม่สำเร็จ');
    } finally {
      setSending(false);
    }
  };
  return (
    <Dialog open fullWidth maxWidth="md" onClose={sending ? undefined : onClose}>
      <DialogTitle>แจ้งแก้ไขปัญหาและเชิญเปิดร้านต่อ — {shopName}</DialogTitle>
      <DialogContent dividers>
        {!!error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {sent && (
          <Alert severity="success" sx={{ mb: 2 }}>
            ส่งอีเมลแล้ว
          </Alert>
        )}
        {loading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          preview && (
            <>
              <Typography variant="body2">ผู้รับ: {preview.to}</Typography>
              {preview.fromEmail ? (
                <Typography variant="body2">ผู้ส่ง: {preview.fromEmail}</Typography>
              ) : (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  ยังไม่ได้ตั้งค่าอีเมลผู้ส่ง RESEND_FROM_EMAIL
                </Alert>
              )}
              <Typography variant="body2">
                {preview.replyTo ? `ตอบกลับ: ${preview.replyTo}` : ''}
              </Typography>
              <Typography variant="subtitle2" sx={{ mt: 1, mb: 2 }}>
                หัวข้อ: {preview.subject}
              </Typography>
              <Box
                sx={{
                  bgcolor: '#f4f6f8',
                  borderRadius: 2,
                  overflow: 'auto',
                  '& a': { pointerEvents: 'none' },
                }}
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </>
          )
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" disabled={sending} onClick={onClose}>
          ปิด
        </Button>
        <Button
          variant="contained"
          loading={sending}
          disabled={loading || !preview?.fromEmail || sent}
          onClick={send}
        >
          {sent ? 'ส่งแล้ว' : 'ส่งอีเมล'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
