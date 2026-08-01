'use client';

import type { ReactNode } from 'react';
import type { MarketplaceProduct } from '../../shared/types';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import CircularProgress from '@mui/material/CircularProgress';

import {
  RiEyeLine,
  RiFileLine,
  RiCloseLine,
  RiStore2Line,
  RiBookOpenLine,
  RiShieldCheckLine,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { stripHtml, formatPrice } from '../../shared/api';
import { getMarketplacePricing } from '../../shared/pricing';
import { PurchaseBenefitsContent } from '../../shared/purchase-benefits-content';

type ReviewStatus = 'pending_review' | 'published' | 'rejected';
type ReviewRule = {
  id: string;
  name: string;
  description: string | null;
  review_scope: 'content' | 'file' | 'rights';
};
type ProductReviewSubmission = {
  id: string;
  submission_number: number;
  product_title_snapshot: string;
  status: ReviewStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  acceptance_version: string | null;
  seller_attestations: Record<string, { accepted?: boolean; label?: string } | boolean> | null;
  legal_document_versions: Record<string, { id?: string; title?: string; version?: string }> | null;
  accepted_by: string | null;
  accepted_at: string | null;
};
type ReviewProduct = MarketplaceProduct & {
  submission_count?: number;
  review_history?: ProductReviewSubmission[];
  seller?: {
    id: string;
    display_name: string;
    display_name_en?: string | null;
    seller_type: string;
    slug?: string | null;
    logo_url?: string | null;
    bio?: string | null;
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
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<ReviewProduct | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ReviewProduct | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState('');
  const [reviewRules, setReviewRules] = useState<ReviewRule[]>([]);
  const [reviewRulesLoading, setReviewRulesLoading] = useState(false);
  const [reviewRulesError, setReviewRulesError] = useState('');
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        status,
        page: String(page + 1),
        pageSize: String(rowsPerPage),
      });
      const response = await fetch(`/api/marketplace/admin/products?${query}`, {
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'โหลดรายการสินค้าไม่สำเร็จ');
      setProducts(result.products);
      setCounts(result.counts);
      setTotal(result.pagination.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดรายการสินค้าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, status]);

  useEffect(() => {
    if (user?.role === 'master_admin') load();
  }, [load, user?.role]);

  useEffect(() => {
    if (user?.role !== 'master_admin') return undefined;

    let active = true;
    const loadReviewRules = async () => {
      setReviewRulesLoading(true);
      setReviewRulesError('');
      try {
        const response = await fetch('/api/marketplace/media-review-rules', {
          cache: 'no-store',
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? 'โหลดเหตุผลจาก Master ไม่สำเร็จ');
        if (active) setReviewRules(result.items ?? []);
      } catch (rulesError) {
        if (active) {
          setReviewRulesError(
            rulesError instanceof Error ? rulesError.message : 'โหลดเหตุผลจาก Master ไม่สำเร็จ'
          );
        }
      } finally {
        if (active) setReviewRulesLoading(false);
      }
    };

    loadReviewRules();
    return () => {
      active = false;
    };
  }, [user?.role]);

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
      setSelectedProduct(null);
      setSelectedRuleId('');
      setReason('');
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'ตรวจสอบสินค้าไม่สำเร็จ');
    } finally {
      setSavingId('');
    }
  };

  const openDetails = async (product: ReviewProduct) => {
    setDetailLoadingId(product.id);
    setError('');
    try {
      const response = await fetch(`/api/marketplace/admin/products/${product.id}/review`, {
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'โหลดรายละเอียดสินค้าไม่สำเร็จ');
      setSelectedProduct(result.product);
    } catch (detailError) {
      setError(
        detailError instanceof Error ? detailError.message : 'โหลดรายละเอียดสินค้าไม่สำเร็จ'
      );
    } finally {
      setDetailLoadingId('');
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <RiShieldCheckLine size={32} />
        <Box>
          <Typography component="h1" variant="h3">
            อนุมัติสินค้า
          </Typography>
          <Typography color="text.secondary">
            ตรวจสอบคุณภาพและรายละเอียดก่อนเผยแพร่ใน Marketplace
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
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card variant="outlined">
        <TableContainer>
          <Table sx={{ minWidth: 1080 }}>
            <TableHead>
              <TableRow>
                <TableCell>สินค้า</TableCell>
                <TableCell>ร้านค้า</TableCell>
                <TableCell>หมวดหมู่/ประเภท</TableCell>
                <TableCell>ราคา</TableCell>
                <TableCell>วันที่ส่งตรวจ</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                    <CircularProgress size={32} />
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      กำลังโหลดรายการสินค้า...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : products.length ? (
                products.map((product) => {
                  const coverUrl =
                    product.images?.find((image) => image.is_cover)?.url ??
                    product.images?.[0]?.url ??
                    product.cover_url ??
                    undefined;
                  return (
                    <TableRow
                      key={product.id}
                      hover
                      sx={{ '&:last-child td': { borderBottom: 0 } }}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar
                            src={coverUrl}
                            variant="rounded"
                            sx={{ width: 56, height: 56, bgcolor: 'primary.lighter' }}
                          >
                            <RiBookOpenLine />
                          </Avatar>
                          <Box sx={{ minWidth: 0, maxWidth: 300 }}>
                            <Typography variant="subtitle2" noWrap>
                              {product.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {product.short_description ||
                                stripHtml(product.description).slice(0, 80) ||
                                'ไม่ได้ระบุคำอธิบาย'}
                            </Typography>
                            {!!product.rejection_reason && (
                              <Typography variant="caption" color="error" display="block" noWrap>
                                เหตุผล: {product.rejection_reason}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <RiStore2Line size={16} />
                          <Typography variant="body2">
                            {product.seller?.display_name ?? 'ไม่พบชื่อร้าน'}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {product.seller?.contact_email ?? '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{product.category}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {product.media_type?.name ?? product.resource_type}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="subtitle2" color="success.main">
                          {formatPrice(Number(product.price), product.currency)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {product.submitted_at
                            ? new Date(product.submitted_at).toLocaleDateString('th-TH', {
                                timeZone: 'Asia/Bangkok',
                              })
                            : '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {product.submitted_at
                            ? new Date(product.submitted_at).toLocaleTimeString('th-TH', {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Asia/Bangkok',
                              })
                            : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={product.status} />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant={product.status === 'pending_review' ? 'contained' : 'outlined'}
                          loading={detailLoadingId === product.id}
                          startIcon={<RiEyeLine />}
                          onClick={() => openDetails(product)}
                        >
                          ดูรายละเอียด
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                    <RiCheckboxCircleLine size={44} color="#2EAF6D" />
                    <Typography variant="h6" sx={{ mt: 2 }}>
                      ไม่มีสินค้าในสถานะนี้
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      รายการใหม่จะแสดงที่นี่เมื่อผู้ขายส่งตรวจ
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

      <Dialog
        open={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ pr: 7 }}>
          ตรวจรายละเอียดสินค้าก่อนอนุมัติ
          <Button
            color="inherit"
            onClick={() => setSelectedProduct(null)}
            sx={{ top: 10, right: 10, minWidth: 40, position: 'absolute' }}
          >
            <RiCloseLine />
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          {selectedProduct && <ProductReviewDetail product={selectedProduct} />}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button color="inherit" onClick={() => setSelectedProduct(null)}>
            ปิด
          </Button>
          <Box sx={{ flex: 1 }} />
          {selectedProduct?.status !== 'rejected' && (
            <Button
              color="error"
              variant="outlined"
              startIcon={<RiCloseLine />}
              onClick={() => {
                setRejecting(selectedProduct);
                setSelectedRuleId('');
                setReason('');
              }}
            >
              {selectedProduct?.status === 'published' ? 'ระงับชั่วคราว' : 'ไม่อนุมัติ'}
            </Button>
          )}
          {selectedProduct?.status !== 'published' && (
            <Button
              color="success"
              variant="contained"
              loading={savingId === selectedProduct?.id}
              startIcon={<RiCheckboxCircleLine />}
              onClick={() => selectedProduct && review(selectedProduct, 'approve')}
            >
              อนุมัติและเผยแพร่
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(rejecting)} onClose={() => setRejecting(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 7 }}>
          {rejecting?.status === 'published' ? 'ระงับสินค้าชั่วคราว' : 'ไม่อนุมัติสินค้า'}
          <Button
            color="inherit"
            onClick={() => setRejecting(null)}
            sx={{ top: 10, right: 10, minWidth: 40, position: 'absolute' }}
          >
            <RiCloseLine />
          </Button>
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2.5 }}>
            {rejecting?.status === 'published'
              ? `ระบุเหตุผลที่ต้องระงับ “${rejecting.title}” ชั่วคราว`
              : `ระบุสิ่งที่ผู้ขายต้องแก้ไขสำหรับ “${rejecting?.title}”`}
          </Typography>
          <Autocomplete
            options={reviewRules}
            value={reviewRules.find((rule) => rule.id === selectedRuleId) ?? null}
            loading={reviewRulesLoading}
            groupBy={(option) => reviewRuleScopeLabel(option.review_scope)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText="ยังไม่มีเหตุผลใน Master"
            onChange={(_, option) => {
              setSelectedRuleId(option?.id ?? '');
              if (option) {
                setReason(
                  option.description ? `${option.name}\n${option.description}` : option.name
                );
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="เลือกเหตุผลจาก Master"
                placeholder="ค้นหาเหตุผลที่กำหนดไว้"
              />
            )}
            renderOption={(props, option) => {
              const { key, ...optionProps } = props;
              return (
                <Box component="li" key={key} {...optionProps}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {option.name}
                    </Typography>
                    {!!option.description && (
                      <Typography variant="caption" color="text.secondary">
                        {option.description}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            }}
          />
          {!!reviewRulesError && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {reviewRulesError} — ยังสามารถพิมพ์เหตุผลเองได้
            </Alert>
          )}
          {!reviewRulesLoading && !reviewRulesError && reviewRules.length === 0 && (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              ยังไม่มีรายการใน Master › การตรวจสอบสื่อ แต่สามารถพิมพ์เหตุผลเองได้
            </Alert>
          )}
          <Divider sx={{ my: 2.5 }}>หรือพิมพ์และแก้ไขเอง</Divider>
          <TextField
            fullWidth
            multiline
            minRows={5}
            label={
              rejecting?.status === 'published'
                ? 'เหตุผลและรายละเอียดการระงับ'
                : 'รายละเอียดที่ต้องการให้ผู้ขายแก้ไข'
            }
            placeholder={
              rejecting?.status === 'published'
                ? 'อธิบายเหตุผลที่ระงับและสิ่งที่ผู้ขายต้องดำเนินการ'
                : 'อธิบายปัญหาและสิ่งที่ต้องแก้ไขให้ชัดเจน'
            }
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            helperText={`${reason.trim().length} ตัวอักษร · ผู้ขายจะเห็นข้อความนี้`}
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
            {rejecting?.status === 'published' ? 'ยืนยันระงับชั่วคราว' : 'ยืนยันไม่อนุมัติ'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

function ProductReviewDetail({ product }: { product: ReviewProduct }) {
  const pricing = getMarketplacePricing(product);
  const images = [...(product.images ?? [])].sort((a, b) => a.position - b.position);
  const cover =
    images.find((image) => image.is_cover)?.url ?? images[0]?.url ?? product.cover_url ?? '';
  const featureKeys = product.grants_feature_keys?.length
    ? product.grants_feature_keys
    : product.grants_feature_key
      ? [product.grants_feature_key]
      : [];
  const hasBenefits =
    Boolean(product.purchase_benefits_html?.trim()) || Boolean(product.purchase_benefits?.length);

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        ส่วน “ข้อมูลที่ลูกค้าเห็น” ด้านล่างใช้ข้อมูลเดียวกับหน้ารายละเอียดสินค้า กรุณาตรวจภาพ ราคา
        เนื้อหา สิทธิ์ และข้อมูลร้านค้าให้ครบก่อนอนุมัติ
      </Alert>

      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography variant="h5">ข้อมูลที่ลูกค้าเห็น</Typography>
        <StatusChip status={product.status} />
      </Stack>

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.35fr) minmax(280px, 0.65fr)' },
        }}
      >
        <Box>
          <Box
            sx={{
              width: 1,
              aspectRatio: '16 / 10',
              display: 'grid',
              overflow: 'hidden',
              borderRadius: 2.5,
              placeItems: 'center',
              bgcolor: 'background.neutral',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            {cover ? (
              <Box
                component="img"
                src={cover}
                alt={product.title}
                sx={{ width: 1, height: 1, objectFit: 'contain' }}
              />
            ) : (
              <RiBookOpenLine size={64} />
            )}
          </Box>
          {images.length > 1 && (
            <Box
              sx={{
                gap: 1,
                mt: 1.25,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
              }}
            >
              {images.map((image, index) => (
                <Box
                  key={image.id}
                  component="img"
                  src={image.url}
                  alt={`${product.title} รูปที่ ${index + 1}`}
                  sx={{
                    width: 1,
                    height: 72,
                    objectFit: 'cover',
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: image.is_cover ? 'primary.main' : 'divider',
                  }}
                />
              ))}
            </Box>
          )}
        </Box>

        <Stack spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ overflowWrap: 'anywhere' }}>
              {product.title}
            </Typography>
            {!!product.short_description && (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {product.short_description}
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={1.25} alignItems="center">
            <Avatar
              src={product.seller?.logo_url ?? undefined}
              alt={product.seller?.display_name ?? 'ร้านค้า'}
            >
              <RiStore2Line />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2">
                {product.seller?.display_name ?? 'ไม่พบชื่อร้าน'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {sellerTypeLabel(product.seller?.seller_type)}
              </Typography>
            </Box>
          </Stack>

          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h3" color="primary.main">
                {formatPrice(pricing.salePrice, product.currency)}
              </Typography>
              {pricing.hasDiscount && (
                <Chip size="small" color="error" label={`ลด ${pricing.discountPercent}%`} />
              )}
            </Stack>
            {pricing.hasDiscount && (
              <Typography color="text.disabled" sx={{ textDecoration: 'line-through' }}>
                ราคาเต็ม {formatPrice(pricing.listPrice, product.currency)}
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip size="small" color="primary" label={product.category} variant="soft" />
            <Chip
              size="small"
              label={product.media_type?.name ?? resourceTypeLabel(product.resource_type)}
              variant="outlined"
            />
            {!!product.sale_type?.name && (
              <Chip size="small" label={product.sale_type.name} variant="outlined" />
            )}
            {!!product.subject_label && (
              <Chip size="small" label={product.subject_label} variant="outlined" />
            )}
          </Stack>
        </Stack>
      </Box>

      <Divider />

      <Box>
        <Typography variant="h5">เกี่ยวกับสินค้านี้</Typography>
        <Typography
          color="text.secondary"
          sx={{ mt: 1.25, lineHeight: 1.9, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}
        >
          {stripHtml(product.description) || 'ไม่ได้ระบุรายละเอียด'}
        </Typography>
      </Box>

      {(product.title_en || product.short_description_en || product.description_en) && (
        <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
          <Typography variant="h6">เนื้อหาภาษาอังกฤษ</Typography>
          {!!product.title_en && (
            <Typography variant="subtitle1" sx={{ mt: 1 }}>
              {product.title_en}
            </Typography>
          )}
          {!!product.short_description_en && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {product.short_description_en}
            </Typography>
          )}
          {!!product.description_en && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1, whiteSpace: 'pre-line' }}
            >
              {stripHtml(product.description_en)}
            </Typography>
          )}
        </Card>
      )}

      {hasBenefits && (
        <Box
          sx={{
            p: 2.5,
            borderRadius: 2.5,
            bgcolor: 'success.lighter',
            border: '1px solid',
            borderColor: 'success.light',
          }}
        >
          <Typography variant="h5" sx={{ mb: 1.25 }}>
            สิ่งที่ลูกค้าจะได้รับหลังชำระเงินสำเร็จ
          </Typography>
          <PurchaseBenefitsContent
            html={product.purchase_benefits_html}
            legacyItems={product.purchase_benefits}
          />
        </Box>
      )}

      <Box>
        <Typography variant="h5" sx={{ mb: 1.5 }}>
          ไฮไลต์สินค้า
        </Typography>
        <Box
          sx={{
            gap: 1.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          <DetailField
            label="รูปแบบ"
            value={product.media_type?.name ?? resourceTypeLabel(product.resource_type)}
          />
          <DetailField
            label="ระดับชั้น"
            value={
              product.grade_levels?.map(({ grade_level }) => grade_level.name).join(', ') ||
              'ใช้ได้หลายระดับชั้น'
            }
          />
          <DetailField label="รายวิชา" value={product.subject_label || 'สื่อการเรียนรู้ทั่วไป'} />
          <DetailField label="หลักสูตร" value={product.curriculum?.name || 'ไม่ระบุหลักสูตร'} />
          <DetailField
            label="แท็ก"
            value={product.tags?.map(({ tag }) => tag.name).join(', ') || 'ไม่ได้ระบุแท็ก'}
          />
          <DetailField
            label="สิทธิ์การใช้งาน"
            value={
              product.resource_type === 'feature_unlock'
                ? `${licenseScopeLabel(product.license_scope)} · ${
                    product.grant_duration_days ? `${product.grant_duration_days} วัน` : 'ไม่จำกัด'
                  }`
                : 'สิทธิ์ใช้งานต่อรายการสั่งซื้อ'
            }
          />
        </Box>
      </Box>

      <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
        <Typography variant="h5">ข้อมูลร้านค้าที่ลูกค้าเห็น</Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.5 }}>
          <Avatar
            src={product.seller?.logo_url ?? undefined}
            alt={product.seller?.display_name ?? 'ร้านค้า'}
            sx={{ width: 56, height: 56 }}
          >
            <RiStore2Line />
          </Avatar>
          <Box>
            <Typography variant="subtitle1">
              {product.seller?.display_name ?? 'ไม่พบชื่อร้าน'}
            </Typography>
            {!!product.seller?.display_name_en && (
              <Typography variant="body2" color="text.secondary">
                {product.seller.display_name_en}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {sellerTypeLabel(product.seller?.seller_type)}
            </Typography>
          </Box>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, whiteSpace: 'pre-line' }}>
          {product.seller?.bio || 'ร้านค้าไม่ได้ระบุคำแนะนำตัว'}
        </Typography>
      </Card>

      <Box
        sx={{
          p: { xs: 1.5, sm: 2.5 },
          borderRadius: 3,
          bgcolor: 'primary.lighter',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ mb: 2.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 36,
                height: 36,
                display: 'grid',
                borderRadius: 1.25,
                placeItems: 'center',
                color: 'primary.main',
                bgcolor: 'primary.lighter',
              }}
            >
              <RiShieldCheckLine size={20} />
            </Box>
            <Box>
              <Typography variant="h5">ข้อมูลสำหรับผู้ตรวจ</Typography>
              <Typography variant="caption" color="text.secondary">
                ข้อมูลระบบและไฟล์ต้นฉบับที่ไม่แสดงต่อลูกค้า
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Box
          sx={{
            gap: 2,
            display: 'grid',
            alignItems: 'start',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          <ReviewInfoCard title="ข้อมูลรายการ" description="ข้อมูลอ้างอิงและสถานะการตรวจ">
            <ReviewInfoRow label="รหัสสินค้า" value={product.id} mono />
            <ReviewInfoRow
              label="จำนวนครั้งที่ส่งตรวจ"
              value={`${(product.submission_count ?? 0).toLocaleString('th-TH')} ครั้ง`}
            />
            <ReviewInfoRow label="สถานะปัจจุบัน" value={<StatusChip status={product.status} />} />
            <ReviewInfoRow
              label="วันที่ส่งตรวจ"
              value={formatDateTime(product.submitted_at) || 'ไม่ได้ระบุ'}
            />
          </ReviewInfoCard>

          <ReviewInfoCard title="ผู้ขายและการส่งมอบ" description="ข้อมูลติดต่อและวิธีรับสินค้า">
            <ReviewInfoRow
              label="อีเมลผู้ขาย"
              value={product.seller?.contact_email || 'ไม่ได้ระบุ'}
            />
            <ReviewInfoRow
              label="ประเภททรัพยากร"
              value={resourceTypeLabel(product.resource_type)}
            />
            <ReviewInfoRow
              label="วิธีส่งมอบ"
              value={product.media_type?.delivery_mode || 'ไม่ได้ระบุ'}
            />
            <ReviewInfoRow
              label="รูปแบบราคา"
              value={product.sale_type?.pricing_mode || 'ไม่ได้ระบุ'}
            />
          </ReviewInfoCard>

          {!!product.review_history?.length && (
            <ReviewInfoCard
              title="ประวัติการส่งตรวจ"
              description={`ทั้งหมด ${product.review_history.length.toLocaleString('th-TH')} ครั้ง · เรียงจากล่าสุด`}
              fullWidth
            >
              <Stack
                spacing={0}
                divider={<Divider flexItem />}
                sx={{ maxHeight: 440, overflowY: 'auto' }}
              >
                {product.review_history.map((submission) => (
                  <Box key={submission.id} sx={{ py: 2 }}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                    >
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          display: 'grid',
                          flexShrink: 0,
                          borderRadius: '50%',
                          placeItems: 'center',
                          color: 'primary.contrastText',
                          bgcolor: 'primary.main',
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        {submission.submission_number.toLocaleString('th-TH')}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          useFlexGap
                          flexWrap="wrap"
                        >
                          <Typography variant="subtitle2">
                            ส่งตรวจครั้งที่ {submission.submission_number.toLocaleString('th-TH')}
                          </Typography>
                          <StatusChip status={submission.status} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          ส่งเมื่อ {formatDateTime(submission.submitted_at)}
                          {submission.reviewed_at
                            ? ` · ตรวจเมื่อ ${formatDateTime(submission.reviewed_at)}`
                            : ' · ยังไม่ได้ตรวจ'}
                        </Typography>
                        {submission.product_title_snapshot !== product.title && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', mt: 0.5 }}
                          >
                            ชื่อสินค้าขณะส่ง: {submission.product_title_snapshot}
                          </Typography>
                        )}
                        {!!submission.rejection_reason && (
                          <Alert severity="error" sx={{ mt: 1.25, py: 0.25 }}>
                            {submission.rejection_reason}
                          </Alert>
                        )}
                        {submission.acceptance_version ? (
                          <Box
                            sx={{
                              p: 1.5,
                              mt: 1.25,
                              borderRadius: 1.5,
                              bgcolor: 'success.lighter',
                              border: '1px solid',
                              borderColor: 'success.light',
                            }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center">
                              <RiCheckboxCircleLine size={20} color="var(--palette-success-main)" />
                              <Typography variant="subtitle2" color="success.darker">
                                ผู้ขายตรวจสอบและยอมรับเงื่อนไขการเผยแพร่แล้ว · เวอร์ชัน{' '}
                                {submission.acceptance_version}
                              </Typography>
                            </Stack>
                            <Stack spacing={0.5} sx={{ mt: 1 }}>
                              {Object.values(submission.seller_attestations ?? {}).map(
                                (attestation, index) => {
                                  const label =
                                    typeof attestation === 'object'
                                      ? attestation.label
                                      : `การยืนยันข้อที่ ${index + 1}`;
                                  return (
                                    <Typography
                                      key={`${submission.id}-attestation-${index}`}
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      • {label}
                                    </Typography>
                                  );
                                }
                              )}
                            </Stack>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              sx={{ mt: 1 }}
                            >
                              ยืนยันเมื่อ {formatDateTime(submission.accepted_at)} · เอกสาร Master{' '}
                              {Object.keys(
                                submission.legal_document_versions ?? {}
                              ).length.toLocaleString('th-TH')}{' '}
                              ฉบับ
                            </Typography>
                            <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
                              {Object.entries(submission.legal_document_versions ?? {}).map(
                                ([documentType, document]) => (
                                  <Chip
                                    key={`${submission.id}-${documentType}`}
                                    size="small"
                                    variant="outlined"
                                    label={`${document.title ?? documentType} v${document.version ?? '-'}`}
                                  />
                                )
                              )}
                            </Stack>
                          </Box>
                        ) : (
                          <Alert severity="warning" variant="outlined" sx={{ mt: 1.25, py: 0.25 }}>
                            รอบการส่งเดิมก่อนเปิดใช้ระบบยืนยันรายสินค้า
                          </Alert>
                        )}
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </ReviewInfoCard>
          )}

          {product.resource_type === 'feature_unlock' && (
            <ReviewInfoCard
              title="License และฟีเจอร์ที่ปลดล็อก"
              description="ตรวจสิทธิ์ ระยะเวลา และโควตาก่อนอนุมัติ"
              fullWidth
            >
              <Box
                sx={{
                  display: 'grid',
                  columnGap: 4,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                }}
              >
                <Stack divider={<Divider flexItem />}>
                  <ReviewInfoRow
                    label="ขอบเขต License"
                    value={licenseScopeLabel(product.license_scope)}
                  />
                  <ReviewInfoRow
                    label="จำนวน Seat"
                    value={(product.license_seat_count ?? 1).toLocaleString('th-TH')}
                  />
                  <ReviewInfoRow
                    label="ระยะเวลา"
                    value={
                      product.grant_duration_days
                        ? `${product.grant_duration_days.toLocaleString('th-TH')} วัน`
                        : 'ไม่จำกัด'
                    }
                  />
                  <ReviewInfoRow
                    label="แพ็กเกจ"
                    value={product.grants_plan_code || 'ไม่ได้ผูกแพ็กเกจ'}
                  />
                  <ReviewInfoRow
                    label="ฟีเจอร์"
                    value={featureKeys.length ? featureKeys.join(', ') : 'ไม่ได้ระบุฟีเจอร์'}
                    vertical
                  />
                </Stack>
                <Stack divider={<Divider flexItem />}>
                  <ReviewInfoRow
                    label="โควตา LINE"
                    value={
                      product.license_line_quota == null
                        ? 'ไม่ได้กำหนด'
                        : `${product.license_line_quota.toLocaleString('th-TH')} ข้อความ`
                    }
                  />
                  <ReviewInfoRow
                    label="ครูสูงสุด"
                    value={product.license_max_teachers?.toLocaleString('th-TH') ?? 'ไม่ได้กำหนด'}
                  />
                  <ReviewInfoRow
                    label="นักเรียนสูงสุด"
                    value={product.license_max_students?.toLocaleString('th-TH') ?? 'ไม่ได้กำหนด'}
                  />
                  <ReviewInfoRow
                    label="ผู้ดูแลสูงสุด"
                    value={
                      product.license_max_school_admins?.toLocaleString('th-TH') ?? 'ไม่ได้กำหนด'
                    }
                  />
                </Stack>
              </Box>
            </ReviewInfoCard>
          )}

          {(Boolean(product.files?.length) || Boolean(product.external_links?.length)) && (
            <ReviewInfoCard
              title="ไฟล์และลิงก์สำหรับตรวจสอบ"
              description={`${product.files?.length ?? 0} ไฟล์ · ${
                product.external_links?.length ?? 0
              } ลิงก์`}
              fullWidth
            >
              <Stack spacing={1.25}>
                {product.files?.map((file) => (
                  <Stack
                    key={file.id}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: 'background.neutral',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        display: 'grid',
                        flexShrink: 0,
                        borderRadius: 1.25,
                        placeItems: 'center',
                        color: 'primary.main',
                        bgcolor: 'primary.lighter',
                      }}
                    >
                      <RiFileLine />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        alignItems="center"
                        useFlexGap
                        flexWrap="wrap"
                      >
                        <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                          {file.file_name}
                        </Typography>
                        {file.is_preview && (
                          <Chip size="small" color="info" variant="soft" label="ไฟล์ตัวอย่าง" />
                        )}
                        <Chip
                          size="small"
                          variant="soft"
                          label={file.scan_status ?? 'pending_scan'}
                          color={
                            file.scan_status === 'safe'
                              ? 'success'
                              : file.scan_status === 'rejected'
                                ? 'error'
                                : 'warning'
                          }
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {file.mime_type || 'ไม่ระบุชนิด'} · {formatFileSize(file.file_size)}
                      </Typography>
                    </Box>
                    <Button
                      component="a"
                      href={file.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      disabled={!file.url}
                      variant="outlined"
                      startIcon={<RiEyeLine />}
                      sx={{ flexShrink: 0 }}
                    >
                      เปิดไฟล์
                    </Button>
                  </Stack>
                ))}

                {product.external_links?.map((link, index) => (
                  <Stack
                    key={`${link.label}-${link.url}-${index}`}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: 'background.neutral',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle2">{link.label || 'ลิงก์ภายนอก'}</Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', overflowWrap: 'anywhere' }}
                      >
                        {link.url}
                      </Typography>
                    </Box>
                    <Button
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="outlined"
                      startIcon={<RiEyeLine />}
                      sx={{ flexShrink: 0 }}
                    >
                      เปิดลิงก์
                    </Button>
                  </Stack>
                ))}
              </Stack>
            </ReviewInfoCard>
          )}
        </Box>

        {!!product.rejection_reason && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="subtitle2">เหตุผลที่ไม่อนุมัติครั้งก่อน</Typography>
            <Typography variant="body2">{product.rejection_reason}</Typography>
          </Alert>
        )}
      </Box>
    </Stack>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 600, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Card>
  );
}

function ReviewInfoCard({
  title,
  description,
  children,
  fullWidth = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderRadius: 2.5,
        gridColumn: fullWidth ? { md: '1 / -1' } : undefined,
      }}
    >
      <Box sx={{ px: 2.25, py: 1.75, bgcolor: 'background.neutral' }}>
        <Typography variant="subtitle1">{title}</Typography>
        <Typography variant="caption" color="text.secondary">
          {description}
        </Typography>
      </Box>
      <Stack divider={<Divider flexItem />} sx={{ p: 2.25 }}>
        {children}
      </Stack>
    </Card>
  );
}

function ReviewInfoRow({
  label,
  value,
  mono = false,
  vertical = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  vertical?: boolean;
}) {
  return (
    <Stack
      direction={vertical ? 'column' : 'row'}
      spacing={vertical ? 0.5 : 2}
      alignItems={vertical ? 'stretch' : 'center'}
      justifyContent="space-between"
      sx={{ py: 1.5, minHeight: 52 }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Typography>
      {typeof value === 'string' ? (
        <Typography
          variant="body2"
          sx={{
            minWidth: 0,
            fontWeight: 600,
            textAlign: vertical ? 'left' : 'right',
            overflowWrap: 'anywhere',
          }}
        >
          {value}
        </Typography>
      ) : (
        value
      )}
    </Stack>
  );
}

function resourceTypeLabel(type: MarketplaceProduct['resource_type']) {
  const labels: Record<MarketplaceProduct['resource_type'], string> = {
    digital: 'สินค้าดิจิทัล',
    physical: 'สินค้าจัดส่ง',
    service: 'บริการ',
    feature_unlock: 'ปลดล็อกฟีเจอร์',
  };
  return labels[type];
}

function licenseScopeLabel(scope: MarketplaceProduct['license_scope']) {
  if (scope === 'individual') return 'License บุคคล';
  if (scope === 'teacher') return 'License รายครู';
  if (scope === 'school') return 'License โรงเรียน';
  if (scope === 'platform') return 'License ทุกคนในแพลตฟอร์ม';
  return 'ไม่ได้ระบุ';
}

function sellerTypeLabel(type?: string) {
  if (type === 'organization') return 'องค์กร';
  if (type === 'school') return 'โรงเรียน';
  if (type === 'individual') return 'ผู้ขายบุคคล';
  return type || 'ไม่ระบุประเภทผู้ขาย';
}

function reviewRuleScopeLabel(scope: ReviewRule['review_scope']) {
  if (scope === 'content') return 'เนื้อหาและคุณภาพ';
  if (scope === 'file') return 'ไฟล์และความปลอดภัย';
  return 'ลิขสิทธิ์และสิทธิ์ใช้งาน';
}

function formatDateTime(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  });
}

function formatFileSize(bytes: number) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
