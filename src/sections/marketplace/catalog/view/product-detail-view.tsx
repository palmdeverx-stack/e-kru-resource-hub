'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { RouterLink } from 'src/routes/components';

import {
  RiAddLine,
  RiStore2Line,
  RiBookOpenLine,
  RiArrowLeftLine,
  RiShieldCheckLine,
  RiDownloadCloud2Line,
} from 'src/components/remix-icon';

import { getProduct, formatPrice } from '../../shared/api';
import { findSampleProduct } from '../../shared/constants';
import { useMarketplaceCart } from '../../cart/cart-context';

export function MarketplaceProductDetailView({ productId }: { productId: string }) {
  const { addItem } = useMarketplaceCart();
  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const sample = findSampleProduct(productId);
    if (sample) {
      setProduct(sample);
      setLoading(false);
      return;
    }
    getProduct(productId)
      .then((result) => setProduct(result.product))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <Box sx={{ minHeight: 500, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!product) {
    return (
      <Container maxWidth="md" sx={{ py: 10 }}>
        <Alert severity="warning">ไม่พบสินค้านี้ หรือสินค้าถูกนำออกจาก Marketplace</Alert>
        <Button component={RouterLink} href="/" startIcon={<RiArrowLeftLine />} sx={{ mt: 3 }}>
          กลับไปเลือกสินค้า
        </Button>
      </Container>
    );
  }

  const handleAdd = () => {
    addItem(product);
    setAdded(true);
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
      <Button component={RouterLink} href="/" color="inherit" startIcon={<RiArrowLeftLine />}>
        กลับไป Marketplace
      </Button>

      <Grid container spacing={{ xs: 4, md: 7 }} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box
            sx={{
              minHeight: { xs: 320, md: 520 },
              display: 'grid',
              borderRadius: 4,
              placeItems: 'center',
              bgcolor: 'primary.lighter',
              backgroundImage: product.cover_url ? `url(${product.cover_url})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {!product.cover_url && <RiBookOpenLine size={120} color="#1565F5" />}
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={1}>
              <Chip label={product.category} color="primary" variant="soft" />
              <Chip
                label={
                  product.media_type?.name ??
                  (product.resource_type === 'digital'
                    ? 'ไฟล์ดิจิทัล'
                    : product.resource_type === 'service'
                      ? 'บริการ'
                      : 'สินค้าจัดส่ง')
                }
                variant="outlined"
              />
              {product.sale_type?.name && (
                <Chip label={product.sale_type.name} color="success" variant="soft" />
              )}
            </Stack>
            <Typography component="h1" variant="h2">
              {product.title}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <RiStore2Line />
              <Typography color="text.secondary">
                โดย {product.seller?.display_name ?? 'ผู้ขาย eKru'}
              </Typography>
              {product.seller?.seller_type === 'teacher' && (
                <Chip size="small" icon={<RiShieldCheckLine />} label="ครู eKru" />
              )}
            </Stack>
            <Typography variant="h3" color="primary.main">
              {formatPrice(Number(product.price), product.currency)}
            </Typography>
            <Divider />
            <Typography sx={{ whiteSpace: 'pre-line', color: 'text.secondary', lineHeight: 1.9 }}>
              {product.description}
            </Typography>
            {product.resource_type === 'digital' && (
              <Alert severity="info" icon={<RiDownloadCloud2Line />}>
                ดาวน์โหลดไฟล์ได้จากหน้ารายการซื้อทันทีหลังชำระเงิน
              </Alert>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                fullWidth
                size="large"
                variant="contained"
                startIcon={<RiAddLine />}
                onClick={handleAdd}
              >
                {added ? 'เพิ่มลงตะกร้าแล้ว' : 'เพิ่มลงตะกร้า'}
              </Button>
              <Button fullWidth size="large" variant="outlined" component={RouterLink} href="/cart">
                ไปที่ตะกร้า
              </Button>
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
