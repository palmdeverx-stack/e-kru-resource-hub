'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import {
  RiCloseLine,
  RiStore2Line,
  RiBookOpenLine,
  RiShieldCheckLine,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { stripHtml, formatPrice } from '../../shared/api';

type ReviewStatus = 'pending_review' | 'published' | 'rejected';
type ReviewProduct = MarketplaceProduct & {
  seller?: {
    id: string;
    display_name: string;
    seller_type: string;
    contact_email: string | null;
  } | null;
};

const filters: Array<{ value: ReviewStatus; label: string }> = [
  { value: 'pending_review', label: 'รอตรวจสอบ' },
  { value: 'published', label: 'อนุมัติแล้ว' },
  { value: 'rejected', label: 'ไม่ผ่านการอนุมัติ' },
];

export function MarketplaceProductApprovalView() {
  const { user } = useAuthContext();
  const [status, setStatus] = useState<ReviewStatus>('pending_review');
  const [products, setProducts] = useState<ReviewProduct[]>([]);
  const [counts, setCounts] = useState<Record<ReviewStatus, number>>({
    pending_review: 0,
    published: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<ReviewProduct | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/marketplace/admin/products?status=${status}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'โหลดรายการสินค้าไม่สำเร็จ');
      setProducts(result.products);
      setCounts(result.counts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดรายการสินค้าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (user?.role === 'master_admin') load();
  }, [load, user?.role]);

  if (user?.role !== 'master_admin') {
    return (
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Alert severity="error">หน้านี้สำหรับ Super Admin เท่านั้น</Alert>
      </Container>
    );
  }

  const review = async (product: ReviewProduct, action: 'approve' | 'reject') => {
    setSavingId(product.id);
    setError('');
    try {
      const response = await fetch(`/api/marketplace/admin/products/${product.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: action === 'reject' ? reason : undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'ตรวจสอบสินค้าไม่สำเร็จ');
      setRejecting(null);
      setReason('');
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'ตรวจสอบสินค้าไม่สำเร็จ');
    } finally {
      setSavingId('');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'center' }}
        spacing={2}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <RiShieldCheckLine size={32} />
            <Typography component="h1" variant="h3">
              อนุมัติสินค้า
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            ตรวจสอบคุณภาพและรายละเอียดก่อนเผยแพร่ใน Marketplace
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
          {filters.map((filter) => (
            <Chip
              key={filter.value}
              clickable
              color={status === filter.value ? 'primary' : 'default'}
              label={`${filter.label} (${counts[filter.value]})`}
              onClick={() => setStatus(filter.value)}
            />
          ))}
        </Stack>
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mt: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ minHeight: 420, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : products.length ? (
        <Grid container spacing={2.5} sx={{ mt: 1 }}>
          {products.map((product) => {
            const coverUrl =
              product.images?.find((image) => image.is_cover)?.url ??
              product.images?.[0]?.url ??
              product.cover_url ??
              undefined;
            return (
            <Grid key={product.id} size={{ xs: 12, lg: 6 }}>
              <Card sx={{ p: 3, height: 1 }}>
                <Stack direction="row" spacing={2}>
                  <Box
                    sx={{
                      width: 92,
                      height: 92,
                      flexShrink: 0,
                      display: 'grid',
                      borderRadius: 2.5,
                      placeItems: 'center',
                      bgcolor: 'primary.lighter',
                      backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {!coverUrl && <RiBookOpenLine size={34} />}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" noWrap>
                          {product.title}
                        </Typography>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <RiStore2Line size={16} />
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {product.seller?.display_name ?? 'ไม่พบชื่อร้าน'}
                          </Typography>
                        </Stack>
                      </Box>
                      <StatusChip status={product.status} />
                    </Stack>
                    <Stack direction="row" spacing={0.75} sx={{ mt: 1.25, flexWrap: 'wrap' }}>
                      <Chip size="small" label={product.category} variant="outlined" />
                      <Chip
                        size="small"
                        label={product.media_type?.name ?? product.resource_type}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={formatPrice(Number(product.price), product.currency)}
                        color="success"
                        variant="soft"
                      />
                    </Stack>
                  </Box>
                </Stack>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mt: 2,
                    display: '-webkit-box',
                    overflow: 'hidden',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {stripHtml(product.description)}
                </Typography>

                {product.rejection_reason && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    เหตุผล: {product.rejection_reason}
                  </Alert>
                )}

                <Divider sx={{ my: 2 }} />
                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                  {product.status !== 'rejected' && (
                    <Button
                      color="error"
                      variant="outlined"
                      startIcon={<RiCloseLine />}
                      onClick={() => {
                        setRejecting(product);
                        setReason('');
                      }}
                    >
                      ไม่อนุมัติ
                    </Button>
                  )}
                  {product.status !== 'published' && (
                    <Button
                      color="success"
                      variant="contained"
                      loading={savingId === product.id}
                      startIcon={<RiCheckboxCircleLine />}
                      onClick={() => review(product, 'approve')}
                    >
                      อนุมัติและเผยแพร่
                    </Button>
                  )}
                </Stack>
              </Card>
            </Grid>
            );
          })}
        </Grid>
      ) : (
        <Card sx={{ mt: 3, py: 10, textAlign: 'center', borderStyle: 'dashed' }}>
          <RiCheckboxCircleLine size={48} color="#2EAF6D" />
          <Typography variant="h5" sx={{ mt: 2 }}>
            ไม่มีสินค้าสถานะนี้
          </Typography>
          <Typography color="text.secondary">รายการใหม่จะแสดงที่นี่เมื่อผู้ขายส่งตรวจ</Typography>
        </Card>
      )}

      <Dialog open={Boolean(rejecting)} onClose={() => setRejecting(null)} fullWidth maxWidth="sm">
        <DialogTitle>ไม่อนุมัติสินค้า</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            ระบุสิ่งที่ผู้ขายต้องแก้ไขสำหรับ “{rejecting?.title}”
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={4}
            label="เหตุผลที่ไม่อนุมัติ"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setRejecting(null)}>
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={savingId === rejecting?.id}
            disabled={reason.trim().length < 3}
            onClick={() => rejecting && review(rejecting, 'reject')}
          >
            ยืนยันไม่อนุมัติ
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

function StatusChip({ status }: { status: MarketplaceProduct['status'] }) {
  if (status === 'published') {
    return <Chip size="small" color="success" label="เผยแพร่แล้ว" variant="soft" />;
  }
  if (status === 'rejected') {
    return <Chip size="small" color="error" label="ไม่ผ่าน" variant="soft" />;
  }
  return <Chip size="small" color="warning" label="รอตรวจสอบ" variant="soft" />;
}
