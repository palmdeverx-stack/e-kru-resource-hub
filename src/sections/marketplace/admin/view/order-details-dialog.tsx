'use client';

import type { AdminOrder, AdminOrderDetails } from '../order-list';

import { useQuery } from '@tanstack/react-query';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';

import { apiFetch } from 'src/lib/api-fetch';

const dateTime = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
});

export function OrderDetailsDialog({
  order,
  userId,
  onClose,
}: {
  order: AdminOrder;
  userId: string;
  onClose: () => void;
}) {
  const { data, error, isFetching, refetch } = useQuery<AdminOrderDetails>({
    queryKey: ['marketplace-admin-order-detail', userId, order.id],
    staleTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await apiFetch(`/api/marketplace/admin/orders/${order.id}`, {
        cache: 'no-store',
        signal,
      });
      if (!response.ok) throw new Error('โหลดรายละเอียดคำสั่งซื้อไม่สำเร็จ');
      return response.json();
    },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="order-details-title">
      <DialogTitle id="order-details-title">
        คำสั่งซื้อ #{order.id.slice(0, 8).toUpperCase()}
      </DialogTitle>
      <DialogContent dividers>
        {isFetching && <LinearProgress aria-label="กำลังโหลดรายละเอียดคำสั่งซื้อ" />}
        {error && (
          <Alert severity="error" action={<Button onClick={() => refetch()}>ลองใหม่</Button>}>
            {error.message}
          </Alert>
        )}
        {data && !error && (
          <Stack spacing={3} sx={{ overflowWrap: 'anywhere' }}>
            <div>
              <Typography variant="body2">{order.buyer_name ?? 'ไม่พบชื่อผู้ซื้อ'}</Typography>
              {data.paymentMethod && (
                <Typography variant="body2" color="text.secondary">
                  {data.paymentMethod}
                </Typography>
              )}
            </div>
            <div>
              <Typography variant="h6" component="h2">
                ประวัติเหตุการณ์ที่บันทึกไว้
              </Typography>
              <Stack component="ol" spacing={1.5} sx={{ my: 1.5, pl: 3 }}>
                {data.events.map((event, index) => (
                  <li key={index}>
                    <Typography variant="subtitle2">{event.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {event.at ? dateTime.format(new Date(event.at)) : 'ไม่มีเวลาบันทึก'}
                    </Typography>
                    {event.detail && <Typography variant="body2">{event.detail}</Typography>}
                  </li>
                ))}
              </Stack>
            </div>
            <div>
              <Typography variant="h6" component="h2">
                สถานะสิ่งที่ผู้ซื้อได้รับ
              </Typography>
              {data.delivery.length ? (
                <Stack component="ul" spacing={1.5} sx={{ my: 1.5, pl: 3 }}>
                  {data.delivery.map((item) => (
                    <li key={item.id}>
                      <Typography variant="subtitle2">{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.status}
                      </Typography>
                    </li>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  ไม่พบรายการสินค้า
                </Typography>
              )}
            </div>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ปิด</Button>
      </DialogActions>
    </Dialog>
  );
}
