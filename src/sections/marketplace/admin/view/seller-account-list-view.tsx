'use client';

import type { MarketplaceSeller } from '../../shared/types';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { apiFetch as fetch } from 'src/lib/api-fetch';

import { RiEyeLine, RiSearchLine, RiStore3Line, RiPercentLine } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

const SellerReminderDialog = dynamic(() =>
  import('./seller-reminder-dialog').then((module) => module.SellerReminderDialog)
);

type SellerAccount = Pick<
  MarketplaceSeller,
  | 'id'
  | 'seller_type'
  | 'display_name'
  | 'slug'
  | 'logo_url'
  | 'seller_name'
  | 'phone'
  | 'contact_email'
  | 'status'
  | 'commission_rate_override'
  | 'submitted_at'
  | 'created_at'
  | 'updated_at'
  | 'wizard_step'
> & {
  product_count: number;
  sold_count: number;
  view_count: number;
};

const sellerSteps = ['ข้อมูลร้านค้า', 'ข้อมูลผู้ขาย', 'บัญชีรับเงิน', 'เอกสารยืนยัน', 'ข้อตกลง'];

const statusOptions = [
  { value: 'all', label: 'ทุกสถานะ' },
  { value: 'active', label: 'เปิดใช้งาน' },
  { value: 'pending', label: 'รอตรวจสอบ' },
  { value: 'draft', label: 'แบบร่าง' },
  { value: 'suspended', label: 'ระงับใช้งาน' },
  { value: 'rejected', label: 'ไม่อนุมัติ' },
];

const sellerTypeLabel: Record<MarketplaceSeller['seller_type'], string> = {
  individual: 'บุคคลทั่วไป',
  teacher: 'ครู',
  school: 'โรงเรียน',
  company: 'บริษัท',
  publisher: 'สำนักพิมพ์',
  university: 'มหาวิทยาลัย',
};

export function MarketplaceSellerAccountListView() {
  const { user } = useAuthContext();
  const [reminderSeller, setReminderSeller] = useState<SellerAccount | null>(null);
  const [sellers, setSellers] = useState<SellerAccount[]>([]);
  const [defaultCommissionRate, setDefaultCommissionRate] = useState(0);
  const [status, setStatus] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError('');
      setStatsError('');
      setStatsLoading(true);
      try {
        const query = new URLSearchParams({
          includeStats: 'false',
          status,
          search,
          page: String(page + 1),
          pageSize: String(rowsPerPage),
        });
        const response = await fetch(`/api/marketplace/admin/seller-accounts?${query}`, {
          cache: 'no-store',
          signal,
        });
        const result = await response.json();
        if (signal.aborted) return;
        if (!response.ok) throw new Error(result.message ?? 'โหลดบัญชีร้านค้าไม่สำเร็จ');
        setSellers(result.sellers ?? []);
        setDefaultCommissionRate(Number(result.defaultCommissionRate ?? 0));
        setTotal(Number(result.pagination?.total ?? 0));
        setLoading(false);
        const sellerIds = (result.sellers ?? []).map((seller: SellerAccount) => seller.id);
        if (sellerIds.length) {
          try {
            const statsResponse = await fetch(
              `/api/marketplace/admin/seller-accounts/stats?ids=${sellerIds.join(',')}`,
              { cache: 'no-store', signal }
            );
            const statsResult = await statsResponse.json();
            if (signal.aborted) return;
            if (!statsResponse.ok)
              throw new Error(statsResult.message ?? 'โหลดสถิติร้านค้าไม่สำเร็จ');
            const statsById = new Map<string, SellerAccount>(
              (statsResult.stats ?? []).map((item: SellerAccount & { seller_id: string }) => [
                item.seller_id,
                item,
              ])
            );
            setSellers((current) =>
              current.map((seller) => {
                const stats = statsById.get(seller.id);
                return {
                  ...seller,
                  product_count: Number(stats?.product_count ?? 0),
                  sold_count: Number(stats?.sold_count ?? 0),
                  view_count: Number(stats?.view_count ?? 0),
                };
              })
            );
          } catch (statsLoadError) {
            if (!signal.aborted)
              setStatsError(
                statsLoadError instanceof Error
                  ? statsLoadError.message
                  : 'โหลดสถิติร้านค้าไม่สำเร็จ'
              );
          }
        }
      } catch (loadError) {
        if (signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'โหลดบัญชีร้านค้าไม่สำเร็จ');
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setStatsLoading(false);
        }
      }
    },
    [page, rowsPerPage, search, status]
  );

  useEffect(() => {
    const controller = new AbortController();
    if (user?.role === 'master_admin') load(controller.signal);
    return () => controller.abort();
  }, [load, user?.role]);

  if (user?.role !== 'master_admin') {
    return (
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Alert severity="error">หน้านี้สำหรับ Master Admin เท่านั้น</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'flex-end' }}
        spacing={2}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <RiStore3Line size={32} />
          <Box>
            <Typography component="h1" variant="h3">
              บัญชีร้านค้าในระบบ
            </Typography>
            <Typography color="text.secondary">
              ตรวจสอบข้อมูลร้าน สถานะ และค่าธรรมเนียมที่แต่ละร้านใช้งาน
            </Typography>
          </Box>
        </Stack>
        <Chip
          icon={<RiPercentLine />}
          color="primary"
          variant="soft"
          label={`ค่าธรรมเนียม Default ${defaultCommissionRate}%`}
        />
      </Stack>

      <Card variant="outlined" sx={{ p: 2, mt: 3, mb: 2, borderRadius: 3 }}>
        <Stack
          component="form"
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          onSubmit={(event) => {
            event.preventDefault();
            setPage(0);
            setSearch(searchInput.trim());
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="ค้นหาชื่อร้าน ผู้ขาย อีเมล หรือเบอร์โทร"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <RiSearchLine />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            size="small"
            label="สถานะ"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
            sx={{ minWidth: { md: 190 } }}
          >
            {statusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Button type="submit" variant="contained" sx={{ minWidth: 100 }}>
            ค้นหา
          </Button>
        </Stack>
      </Card>

      {!!error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!!statsError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {statsError}
        </Alert>
      )}
      <Card variant="outlined">
        <TableContainer>
          <Table sx={{ minWidth: 1360 }}>
            <TableHead>
              <TableRow>
                <TableCell>ร้านค้า</TableCell>
                <TableCell>ผู้ขาย/การติดต่อ</TableCell>
                <TableCell>ประเภท</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell>ขั้นตอนล่าสุด</TableCell>
                <TableCell>ค่าธรรมเนียม</TableCell>
                <TableCell align="right">สินค้า</TableCell>
                <TableCell align="right">ขายแล้ว</TableCell>
                <TableCell align="right">ผู้เข้าชมรวม</TableCell>
                <TableCell>อัปเดตล่าสุด</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 10 }}>
                    <CircularProgress size={32} />
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      กำลังโหลดบัญชีร้านค้า...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : sellers.length ? (
                sellers.map((seller) => {
                  const step = Math.min(5, Math.max(1, seller.wizard_step || 1));
                  const isCustomRate = seller.commission_rate_override != null;
                  const effectiveRate = isCustomRate
                    ? Number(seller.commission_rate_override)
                    : defaultCommissionRate;
                  return (
                    <TableRow key={seller.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar
                            src={seller.logo_url ?? undefined}
                            variant="rounded"
                            sx={{ width: 46, height: 46 }}
                          >
                            <RiStore3Line />
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2">{seller.display_name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              /store/{seller.slug || '-'}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{seller.seller_name || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {seller.contact_email || '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {seller.phone || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="soft"
                          label={sellerTypeLabel[seller.seller_type]}
                        />
                      </TableCell>
                      <TableCell>
                        <SellerAccountStatus status={seller.status} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 160 }}>
                        <Chip
                          size="small"
                          variant="soft"
                          color="info"
                          label={`ขั้นตอนที่ ${step}/5`}
                        />
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.5 }}
                        >
                          {sellerSteps[step - 1]}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="subtitle2"
                          color={isCustomRate ? 'success.main' : 'text.primary'}
                        >
                          {effectiveRate}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {isCustomRate ? 'เรทเฉพาะร้าน' : 'เรท Default'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2">
                          {statsLoading
                            ? '…'
                            : statsError
                              ? '—'
                              : seller.product_count.toLocaleString('th-TH')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          รายการ
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2" color="success.main">
                          {statsLoading
                            ? '…'
                            : statsError
                              ? '—'
                              : seller.sold_count.toLocaleString('th-TH')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ชิ้น
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2">
                          {statsLoading
                            ? '…'
                            : statsError
                              ? '—'
                              : seller.view_count.toLocaleString('th-TH')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ครั้ง
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(seller.updated_at).toLocaleDateString('th-TH', {
                            dateStyle: 'medium',
                            timeZone: 'Asia/Bangkok',
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          component={RouterLink}
                          href={paths.marketplace.sellerAccount(seller.id)}
                          size="small"
                          variant="outlined"
                          startIcon={<RiEyeLine />}
                        >
                          ดูรายละเอียด
                        </Button>
                        {['draft', 'rejected'].includes(seller.status) && (
                          <Button
                            size="small"
                            onClick={() => setReminderSeller(seller)}
                            sx={{ mt: 0.5 }}
                          >
                            ส่งอีเมลเตือน
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 10 }}>
                    <RiStore3Line size={42} />
                    <Typography variant="h6" sx={{ mt: 1 }}>
                      ไม่พบบัญชีร้านค้า
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          labelRowsPerPage="แสดงต่อหน้า"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
        />
      </Card>
      {reminderSeller && (
        <SellerReminderDialog
          sellerId={reminderSeller.id}
          shopName={reminderSeller.display_name}
          onClose={() => setReminderSeller(null)}
        />
      )}
    </Container>
  );
}

function SellerAccountStatus({ status }: { status: MarketplaceSeller['status'] }) {
  if (status === 'active') return <Chip size="small" color="success" label="เปิดใช้งาน" />;
  if (status === 'pending') return <Chip size="small" color="warning" label="รอตรวจสอบ" />;
  if (status === 'rejected') return <Chip size="small" color="error" label="ไม่อนุมัติ" />;
  if (status === 'suspended') return <Chip size="small" color="error" label="ระงับใช้งาน" />;
  return <Chip size="small" label="แบบร่าง" />;
}
