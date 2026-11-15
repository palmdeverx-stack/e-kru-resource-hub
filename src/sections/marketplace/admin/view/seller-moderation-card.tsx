'use client';

import type { MarketplaceSeller } from '../../shared/types';

import * as z from 'zod';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { apiFetch } from 'src/lib/api-fetch';

import { Form, Field } from 'src/components/hook-form';

const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'ระบุเหตุผลอย่างน้อย 3 ตัวอักษร')
    .max(1000, 'เหตุผลต้องไม่เกิน 1,000 ตัวอักษร'),
});
const labels = {
  hide: 'ซ่อนร้าน',
  show: 'แสดงร้าน',
  suspend: 'ระงับร้าน',
  restore: 'ยกเลิกการระงับ',
};
type Action = keyof typeof labels;

export function SellerModerationCard({
  seller,
  onUpdated,
}: {
  seller: MarketplaceSeller;
  onUpdated: () => Promise<void>;
}) {
  const status = seller.account_status ?? seller.status;
  const [action, setAction] = useState<Action | null>(null);
  const [error, setError] = useState('');
  const methods = useForm({ resolver: zodResolver(schema), defaultValues: { reason: '' } });
  const busy = methods.formState.isSubmitting;
  const open = (next: Action) => {
    methods.reset();
    setError('');
    setAction(next);
  };
  const submit = methods.handleSubmit(async ({ reason }) => {
    if (!action) return;
    try {
      const response = await apiFetch(
        `/api/marketplace/admin/seller-accounts/${seller.id}/moderation`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'บันทึกไม่สำเร็จ');
      setAction(null);
      await onUpdated();
      toast.success(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    }
  });
  return (
    <Card variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">จัดการสถานะร้านค้า</Typography>
        {/* <Alert severity={status === 'suspended' ? 'error' : seller.is_hidden ? 'warning' : 'info'}>
          {status === 'suspended'
            ? 'ร้านถูกระงับการใช้งาน'
            : seller.is_hidden
              ? 'ร้านถูกซ่อนจากสาธารณะ'
              : 'ร้านแสดงต่อสาธารณะตามสถานะอนุมัติ'}
        </Alert> */}
        <Typography variant="body2" color="text.secondary">
          ซ่อนร้าน: ปิดหน้าร้านและสินค้าจากสาธารณะและการสั่งซื้อใหม่ ผู้ขายยังแก้ไขข้อมูลได้
          ระงับร้าน: ปิดการขายและบล็อกการแก้ไขข้อมูลร้าน ไม่เปลี่ยนสิทธิ์ดาวน์โหลดของผู้ซื้อเดิม
        </Typography>
        {seller.moderation_reason && (
          <Typography variant="body2">เหตุผลล่าสุด: {seller.moderation_reason}</Typography>
        )}
        {/* {success && <Alert severity="success">{success}</Alert>}
        {!action && error && <Alert severity="error">{error}</Alert>} */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {status === 'active' && (
            <>
              <Button variant="outlined" onClick={() => open(seller.is_hidden ? 'show' : 'hide')}>
                {seller.is_hidden ? labels.show : labels.hide}
              </Button>
              <Button variant="outlined" color="error" onClick={() => open('suspend')}>
                {labels.suspend}
              </Button>
            </>
          )}
          {status === 'suspended' && (
            <Button variant="contained" onClick={() => open('restore')}>
              {labels.restore}
            </Button>
          )}
        </Stack>
      </Stack>
      <Dialog
        open={Boolean(action)}
        onClose={() => {
          if (!busy) setAction(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <Form methods={methods} onSubmit={submit}>
          <DialogTitle>{action ? labels[action] : ''}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography>ยืนยันการเปลี่ยนสถานะร้าน {seller.display_name}</Typography>
              {action === 'restore' && seller.is_hidden && (
                <Alert severity="info">หลังยกเลิกการระงับ ร้านจะยังถูกซ่อนจนกว่าจะกดแสดงร้าน</Alert>
              )}
              {error && <Alert severity="error">{error}</Alert>}
              <Field.Text name="reason" label="เหตุผล" multiline minRows={3} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setAction(null)}>
              ยกเลิก
            </Button>
            <Button
              type="submit"
              variant="contained"
              color={action === 'suspend' ? 'error' : 'primary'}
              loading={busy}
            >
              ยืนยัน
            </Button>
          </DialogActions>
        </Form>
      </Dialog>
    </Card>
  );
}
