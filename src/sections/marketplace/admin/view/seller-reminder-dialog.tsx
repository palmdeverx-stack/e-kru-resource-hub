'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { apiFetch as fetch } from 'src/lib/api-fetch';

type Props = { sellerId?: string; shopName?: string; testOnly?: boolean; onClose: () => void };
type Preview = {
  replyTo?: string | null;
  fromEmail: string | null;
  to: string;
  subject: string;
  html: string;
};
const testEmailSchema = z.object({
  to: z.string().trim().max(254).email('กรุณาระบุอีเมลให้ถูกต้อง'),
});

export function SellerReminderDialog({ sellerId, shopName, testOnly = false, onClose }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [testSuccess, setTestSuccess] = useState('');
  const testForm = useForm<z.infer<typeof testEmailSchema>>({
    resolver: zodResolver(testEmailSchema),
    defaultValues: { to: '' },
  });
  const endpoint = testOnly
    ? '/api/marketplace/admin/seller-accounts/test-email'
    : `/api/marketplace/admin/seller-accounts/${sellerId}/reminder`;
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
  const send = async (testTo?: string) => {
    setSending(true);
    setError('');
    setTestSuccess('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        ...(testTo && {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'test', to: testTo }),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      if (testTo)
        setTestSuccess(`รับคำขอส่งตัวอย่างไปยัง ${testTo} แล้ว กรุณาตรวจกล่องจดหมายและสแปม`);
      else setSent(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'ส่งอีเมลไม่สำเร็จ');
    } finally {
      setSending(false);
    }
  };
  return (
    <Dialog open fullWidth maxWidth="md" onClose={sending ? undefined : onClose}>
      <DialogTitle>
        {testOnly ? 'ส่งอีเมลตัวอย่างเพื่อทดสอบ' : `แจ้งแก้ไขปัญหาและเชิญเปิดร้านต่อ — ${shopName}`}
      </DialogTitle>
      <DialogContent dividers>
        {!!error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {sent && (
          <Alert severity="success" sx={{ mb: 2 }}>
            ผู้ให้บริการรับคำขอส่งแล้ว กรุณาตรวจกล่องจดหมายและสแปมของผู้รับ
          </Alert>
        )}
        {!!testSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {testSuccess}
          </Alert>
        )}
        {loading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          preview && (
            <>
              {!testOnly && <Typography variant="body2">ผู้รับ: {preview.to}</Typography>}
              {testOnly && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  ใช้ข้อมูลร้านค้าตัวอย่าง ส่งไปยังอีเมลที่ระบุเท่านั้น
                </Alert>
              )}
              {testOnly && (
                <Box
                  component="form"
                  onSubmit={testForm.handleSubmit(({ to }) => send(to))}
                  sx={{
                    my: 2,
                    display: 'flex',
                    gap: 1,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                  }}
                >
                  <TextField
                    label="อีเมลรับตัวอย่าง"
                    type="email"
                    size="small"
                    {...testForm.register('to')}
                    error={!!testForm.formState.errors.to}
                    helperText={
                      testForm.formState.errors.to?.message ??
                      'ส่งเนื้อหาตัวอย่างของร้านนี้ไปยังอีเมลที่ระบุ'
                    }
                    disabled={sending}
                    sx={{ flex: 1, minWidth: 240 }}
                  />
                  <Button
                    type="submit"
                    variant="outlined"
                    loading={sending}
                    disabled={sending || !preview.fromEmail}
                  >
                    ส่งตัวอย่าง
                  </Button>
                </Box>
              )}
              {preview.fromEmail ? (
                <Typography variant="body2">ผู้ส่ง: {preview.fromEmail}</Typography>
              ) : (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  ยังไม่ได้ตั้งค่าอีเมลผู้ส่ง
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
        {!testOnly && (
          <Button
            variant="contained"
            loading={sending}
            disabled={loading || !preview?.fromEmail || sent || sending}
            onClick={() => send()}
          >
            {sent ? 'ส่งแล้ว' : 'ส่งอีเมล'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
