'use client';

import type { MarketplaceOrder } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { RouterLink } from 'src/routes/components';

import { RiShoppingBag3Line, RiDownloadCloud2Line } from 'src/components/remix-icon';

import { getMyOrders, formatPrice } from '../../shared/api';

export function MarketplacePurchasesView() {
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyOrders()
      .then((result) => setOrders(result.orders))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'ไม่สามารถโหลดรายการซื้อได้')
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography component="h1" variant="h3">
        รายการซื้อของฉัน
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 4 }}>
        ประวัติคำสั่งซื้อและไฟล์ที่พร้อมดาวน์โหลด
      </Typography>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : orders.length ? (
        <Stack spacing={2}>
          {orders.map((order) => (
            <Card key={order.id} sx={{ p: 3 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                spacing={1}
              >
                <Box>
                  <Typography variant="subtitle1">
                    คำสั่งซื้อ #{order.id.slice(0, 8).toUpperCase()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Intl.DateTimeFormat('th-TH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(order.created_at))}
                    {' · '}
                    {order.seller?.display_name ?? 'ร้านค้า eKru'}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <OrderStatusChip status={order.status} />
                  {order.payment_session_id &&
                    ['pending_payment', 'payment_review', 'payment_rejected'].includes(
                      order.status
                    ) && (
                      <Button
                        component={RouterLink}
                        href={`/checkout/payment/${order.payment_session_id}`}
                        size="small"
                        variant="outlined"
                      >
                        {order.status === 'pending_payment' ? 'ชำระเงิน' : 'ดูการตรวจสอบ'}
                      </Button>
                    )}
                  <Typography variant="h6" color="primary.main">
                    {formatPrice(Number(order.total), order.currency)}
                  </Typography>
                </Stack>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={1.5}>
                {order.items?.map((item) => (
                  <Stack
                    key={item.id}
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ sm: 'center' }}
                    spacing={1}
                  >
                    <Box>
                      <Typography>{item.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        จำนวน {item.quantity} · {formatPrice(Number(item.unit_price))}
                      </Typography>
                    </Box>
                    {item.product?.resource_type === 'digital' &&
                      ['paid', 'completed'].includes(order.status) && (
                      <Button
                        size="small"
                        variant="outlined"
                        href={item.product.file_url || undefined}
                        disabled={!item.product.file_url}
                        startIcon={<RiDownloadCloud2Line />}
                      >
                        {item.product.file_url ? 'ดาวน์โหลด' : 'กำลังเตรียมไฟล์'}
                      </Button>
                    )}
                  </Stack>
                ))}
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : (
        <Card sx={{ py: 9, textAlign: 'center' }}>
          <RiShoppingBag3Line size={48} />
          <Typography variant="h5" sx={{ mt: 2 }}>
            ยังไม่มีรายการซื้อ
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
            เมื่อซื้อสื่อแล้ว รายการและลิงก์ดาวน์โหลดจะแสดงที่นี่
          </Typography>
          <Button component={RouterLink} href="/" variant="contained">
            เลือกดู Marketplace
          </Button>
        </Card>
      )}
    </Container>
  );
}

function OrderStatusChip({ status }: { status: MarketplaceOrder['status'] }) {
  if (['paid', 'completed'].includes(status)) {
    return <Chip color="success" size="small" label="ชำระแล้ว" />;
  }
  if (status === 'payment_review') {
    return <Chip color="warning" size="small" label="รอตรวจสลิป" />;
  }
  if (status === 'payment_rejected') {
    return <Chip color="error" size="small" label="สลิปไม่ผ่าน" />;
  }
  if (status === 'cancelled' || status === 'refunded') {
    return <Chip color="default" size="small" label="ยกเลิก/คืนเงิน" />;
  }
  return <Chip color="info" size="small" label="รอชำระเงิน" />;
}
