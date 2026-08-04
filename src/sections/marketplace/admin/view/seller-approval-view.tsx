'use client';

import type { MarketplaceSeller } from '../../shared/types';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import {
  RiEyeLine,
  RiStore2Line,
  RiShieldCheckLine,
  RiArrowRightSLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

type ReviewStatus = 'pending' | 'active' | 'rejected';

const filters: Array<{ value: ReviewStatus; label: string }> = [
  { value: 'pending', label: 'รอตรวจสอบ' },
  { value: 'active', label: 'อนุมัติแล้ว' },
  { value: 'rejected', label: 'ไม่ผ่านการอนุมัติ' },
];

const sellerTypeLabel = {
  individual: 'บุคคลทั่วไป',
  teacher: 'ครู',
  school: 'โรงเรียน',
  company: 'บริษัท',
  publisher: 'สำนักพิมพ์',
  university: 'มหาวิทยาลัย',
};

export function MarketplaceSellerApprovalView() {
  const { user } = useAuthContext();
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [sellers, setSellers] = useState<MarketplaceSeller[]>([]);
  const [counts, setCounts] = useState<Record<ReviewStatus, number>>({
    pending: 0,
    active: 0,
    rejected: 0,
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        status,
        page: String(page + 1),
        pageSize: String(rowsPerPage),
      });
      const response = await fetch(`/api/marketplace/admin/sellers?${query}`, {
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'โหลดคำขอเปิดร้านไม่สำเร็จ');
      setSellers(result.sellers);
      setCounts(result.counts);
      setTotal(result.pagination.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดคำขอเปิดร้านไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, status]);

  useEffect(() => {
    if (user?.role === 'master_admin' || user?.role === 'marketplace_admin') load();
  }, [load, user?.role]);

  if (user?.role !== 'master_admin' && user?.role !== 'marketplace_admin') {
    return (
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Alert severity="error">หน้านี้สำหรับผู้ดูแล Marketplace เท่านั้น</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <RiStore2Line size={32} />
        <Box>
          <Typography component="h1" variant="h3">
            คำขอเปิดร้าน
          </Typography>
          <Typography color="text.secondary">
            เลือกร้านเพื่อดูข้อมูลผู้ขาย บัญชีรับเงิน เอกสาร และพิจารณาคำขอ
          </Typography>
        </Box>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ my: 3 }}>
        {filters.map((filter) => (
          <Button
            key={filter.value}
            variant={status === filter.value ? 'contained' : 'outlined'}
            color={filter.value === 'rejected' ? 'error' : 'primary'}
            onClick={() => {
              setStatus(filter.value);
              setPage(0);
            }}
          >
            {filter.label} ({counts[filter.value]})
          </Button>
        ))}
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card variant="outlined">
        <TableContainer>
          <Table sx={{ minWidth: 960 }}>
            <TableHead>
              <TableRow>
                <TableCell>ร้านค้า</TableCell>
                <TableCell>ประเภทผู้ขาย</TableCell>
                <TableCell>ข้อมูลผู้ขาย</TableCell>
                <TableCell>วันที่ส่งคำขอ</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                    <CircularProgress size={32} />
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      กำลังโหลดคำขอเปิดร้าน...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : sellers.length ? (
                sellers.map((seller) => (
                  <TableRow
                    key={seller.id}
                    hover
                    sx={{
                      '&:last-child td': { borderBottom: 0 },
                      '&:hover .detail-arrow': { transform: 'translateX(3px)' },
                    }}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          src={seller.logo_url ?? undefined}
                          variant="rounded"
                          sx={{ width: 48, height: 48 }}
                        >
                          <RiStore2Line />
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
                      <Chip
                        size="small"
                        variant="soft"
                        label={sellerTypeLabel[seller.seller_type]}
                      />
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
                      <Typography variant="body2">
                        {seller.submitted_at
                          ? new Date(seller.submitted_at).toLocaleDateString('th-TH', {
                              timeZone: 'Asia/Bangkok',
                            })
                          : '-'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {seller.submitted_at
                          ? new Date(seller.submitted_at).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Asia/Bangkok',
                            })
                          : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <SellerStatusChip status={seller.status} />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        component={RouterLink}
                        href={paths.marketplace.sellerApproval(seller.id)}
                        variant={seller.status === 'pending' ? 'contained' : 'outlined'}
                        size="small"
                        startIcon={<RiEyeLine />}
                        endIcon={
                          <RiArrowRightSLine
                            className="detail-arrow"
                            style={{ transition: 'transform 160ms ease' }}
                          />
                        }
                      >
                        ดูรายละเอียด
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                    <RiShieldCheckLine size={44} />
                    <Typography variant="h6" sx={{ mt: 2 }}>
                      ไม่มีรายการในสถานะนี้
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
    </Container>
  );
}

function SellerStatusChip({ status }: { status: MarketplaceSeller['status'] }) {
  if (status === 'active') return <Chip size="small" color="success" label="อนุมัติแล้ว" />;
  if (status === 'rejected') return <Chip size="small" color="error" label="ไม่อนุมัติ" />;
  if (status === 'pending') return <Chip size="small" color="warning" label="รอตรวจสอบ" />;
  if (status === 'suspended') return <Chip size="small" color="error" label="ระงับการใช้งาน" />;
  return <Chip size="small" color="default" label="แบบร่าง" />;
}
