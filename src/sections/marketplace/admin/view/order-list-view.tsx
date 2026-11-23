'use client';

import type { AdminOrder } from '../order-list';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';

import { useTranslate } from 'src/locales';
import { apiFetch } from 'src/lib/api-fetch';

import { useAuthContext } from 'src/auth/hooks';

import { formatPrice } from '../../shared/api';
import { OrderDetailsDialog } from './order-details-dialog';
import { orderStatus, getOrderOutcome, adminOrdersPageSize } from '../order-list';

const dateTime = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
});

export function MarketplaceAdminOrderListView({ initialOrderId }: { initialOrderId: string }) {
  const { user, loading } = useAuthContext();
  const { t } = useTranslate('marketplace');
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');
  const [orderId, setOrderId] = useState(initialOrderId);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const isMasterAdmin = user?.role === 'master_admin';

  const { data, error, isFetching, refetch } = useQuery<{ orders: AdminOrder[]; total: number }>({
    queryKey: ['marketplace-admin-orders', user?.id, user?.role, page, status, orderId, search],
    enabled: Boolean(user?.id) && isMasterAdmin,
    retry: false,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ page: String(page), status, id: orderId, search });
      const response = await apiFetch(`/api/marketplace/admin/orders?${params}`, {
        cache: 'no-store',
        signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'โหลดคำสั่งซื้อไม่สำเร็จ');
      return result;
    },
  });

  const lastPage = Math.max(0, Math.ceil((data?.total ?? 0) / adminOrdersPageSize) - 1);

  return (
    <Container maxWidth="xl">
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          คำสั่งซื้อทั้งหมด
        </Typography>
        {loading && <LinearProgress aria-label="กำลังตรวจสอบสิทธิ์" />}
        {!loading && !isMasterAdmin && (
          <Alert severity="warning">สำหรับ Super Admin เท่านั้น</Alert>
        )}
        {isMasterAdmin && (
          <Card variant="outlined">
            <Stack direction="row" alignItems="center" flexWrap="wrap" gap={2} sx={{ p: 2 }}>
              <Stack
                component="form"
                direction="row"
                spacing={1}
                onSubmit={(event) => {
                  event.preventDefault();
                  setOrderId('');
                  setSearch(searchInput.trim());
                  setPage(0);
                }}
                sx={{ flex: '1 1 320px' }}
              >
                <TextField
                  fullWidth
                  size="small"
                  label="เลขคำสั่งซื้อหรือชื่อผู้ซื้อ"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                />
                <Button type="submit" variant="contained">
                  ค้นหา
                </Button>
                {search && (
                  <Button
                    onClick={() => {
                      setSearchInput('');
                      setSearch('');
                      setPage(0);
                    }}
                  >
                    ล้าง
                  </Button>
                )}
              </Stack>
              <TextField
                select
                size="small"
                label="สถานะคำสั่งซื้อ"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 210 }}
              >
                <MenuItem value="">ทุกสถานะ</MenuItem>
                {Object.entries(orderStatus).map(([value, display]) => (
                  <MenuItem key={value} value={value}>
                    {t(display.label, { defaultValue: display.label })}
                  </MenuItem>
                ))}
              </TextField>
              {orderId && (
                <Chip
                  label={`#${orderId.slice(0, 8).toUpperCase()}`}
                  aria-label="ล้างตัวกรองเลขคำสั่งซื้อ"
                  onDelete={() => {
                    setOrderId('');
                    setPage(0);
                  }}
                />
              )}
            </Stack>
            {isFetching && <LinearProgress aria-label="กำลังโหลดคำสั่งซื้อ" />}
            {error && (
              <Alert severity="error" action={<Button onClick={() => refetch()}>ลองใหม่</Button>}>
                {error.message}
              </Alert>
            )}
            {!error && data && (
              <>
                <TableContainer>
                  <Table aria-label="คำสั่งซื้อทั้งหมด" sx={{ minWidth: 980 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>คำสั่งซื้อ / วันที่</TableCell>
                        <TableCell>ผู้ซื้อ</TableCell>
                        <TableCell>ร้านค้า / สินค้า</TableCell>
                        <TableCell align="right">ยอดรวม</TableCell>
                        <TableCell>สถานะ</TableCell>
                        <TableCell>ผลการชำระและเหตุผล</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.orders.map((order) => {
                        const display = Object.hasOwn(orderStatus, order.status)
                          ? orderStatus[order.status]
                          : undefined;
                        return (
                          <TableRow key={order.id}>
                            <TableCell>
                              <Button
                                size="small"
                                title={order.id}
                                onClick={() => setSelectedOrder(order)}
                                aria-label={`ดูรายละเอียดคำสั่งซื้อ #${order.id.slice(0, 8).toUpperCase()}`}
                                sx={{ display: 'block', minWidth: 0, p: 0 }}
                              >
                                #{order.id.slice(0, 8).toUpperCase()}
                              </Button>
                              <Typography variant="caption" color="text.secondary">
                                {dateTime.format(new Date(order.created_at))}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ overflowWrap: 'anywhere' }}>
                              <Typography variant="subtitle2">
                                {order.buyer_name ?? 'ไม่พบชื่อผู้ซื้อ'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                #{order.buyer_reference}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="subtitle2">
                                {order.seller?.display_name ?? '—'}
                              </Typography>
                              {order.items.map((item) => (
                                <Typography key={item.id} variant="body2" color="text.secondary">
                                  {item.title} × {item.quantity}
                                </Typography>
                              ))}
                            </TableCell>
                            <TableCell align="right">
                              {formatPrice(Number(order.total), order.currency, 'th-TH')}
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                variant="soft"
                                color={display?.color ?? 'default'}
                                label={
                                  display
                                    ? t(display.label, { defaultValue: display.label })
                                    : order.status
                                }
                              />
                            </TableCell>
                            <TableCell sx={{ maxWidth: 340, overflowWrap: 'anywhere' }}>
                              {getOrderOutcome(order)}
                              {order.paid_at && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                >
                                  ชำระเมื่อ {dateTime.format(new Date(order.paid_at))}
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                {!data.orders.length && (
                  <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                    ไม่พบคำสั่งซื้อตามตัวกรอง
                    {page > lastPage && (
                      <Button onClick={() => setPage(lastPage)}>กลับไปหน้าที่มีรายการ</Button>
                    )}
                  </Box>
                )}
                <TablePagination
                  component="div"
                  count={data.total}
                  page={Math.min(page, lastPage)}
                  rowsPerPage={adminOrdersPageSize}
                  rowsPerPageOptions={[]}
                  onPageChange={(_, nextPage) => setPage(nextPage)}
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count} รายการ`}
                  getItemAriaLabel={(type) => (type === 'next' ? 'หน้าถัดไป' : 'หน้าก่อนหน้า')}
                />
              </>
            )}
          </Card>
        )}
      </Stack>
      {isMasterAdmin && user?.id && selectedOrder && (
        <OrderDetailsDialog
          order={selectedOrder}
          userId={user.id}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </Container>
  );
}
