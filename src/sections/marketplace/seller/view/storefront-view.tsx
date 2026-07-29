'use client';

import type { MarketplaceSeller, MarketplaceProduct } from '../../shared/types';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Rating from '@mui/material/Rating';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import {
  RiStore2Line,
  RiShieldCheckLine,
  RiShoppingBag3Line,
  RiVerifiedBadgeLine,
} from 'src/components/remix-icon';

import { MarketplaceProductCard } from '../../shared/product-card';
import { MarketplaceProductDetailDialog } from '../../catalog/components/product-detail-dialog';

const sellerTypeLabels: Record<string, string> = {
  teacher: 'ครูผู้สอน',
  individual: 'บุคคลทั่วไป',
  school: 'โรงเรียน',
  company: 'บริษัท',
  publisher: 'สำนักพิมพ์',
  university: 'มหาวิทยาลัย',
};

type Props = {
  slug: string;
  dashboardMode?: boolean;
};

export function MarketplaceStorefrontView({ slug, dashboardMode = false }: Props) {
  const [seller, setSeller] = useState<MarketplaceSeller | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [category, setCategory] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/marketplace/stores/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setSeller(result.seller);
        setProducts(result.products);
      })
      .catch((loadError) => setError(loadError.message));
  }, [slug]);

  const categories = useMemo(
    () => ['all', ...new Set(products.map((product) => product.category).filter(Boolean))],
    [products]
  );
  const visibleProducts = useMemo(
    () =>
      category === 'all' ? products : products.filter((product) => product.category === category),
    [category, products]
  );
  const totalReviews = products.reduce(
    (total, product) => total + (product.engagement?.reviewCount ?? 0),
    0
  );
  const averageRating = totalReviews
    ? products.reduce(
        (total, product) =>
          total + (product.engagement?.averageRating ?? 0) * (product.engagement?.reviewCount ?? 0),
        0
      ) / totalReviews
    : 0;

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 10 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!seller) {
    return (
      <Box sx={{ minHeight: 500, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container
      maxWidth={dashboardMode ? false : 'xl'}
      sx={{ py: { xs: 3, md: dashboardMode ? 5 : 7 } }}
    >
      <Card
        variant="outlined"
        sx={{
          p: { xs: 2.5, md: 4 },
          overflow: 'hidden',
          borderRadius: 4,
          bgcolor: 'background.paper',
        }}
      >
        <Grid container spacing={{ xs: 4, lg: 7 }} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 6 }}>
            <Stack sx={{ height: 1 }} justifyContent="center" alignItems="flex-start">
              <Avatar
                src={seller.logo_url ?? undefined}
                alt={seller.display_name}
                sx={{
                  width: { xs: 72, md: 88 },
                  height: { xs: 72, md: 88 },
                  mb: 2.5,
                  bgcolor: 'primary.lighter',
                  color: 'primary.main',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <RiStore2Line size={38} />
              </Avatar>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography component="h1" variant="h3">
                  {seller.display_name}
                </Typography>
                <RiVerifiedBadgeLine size={26} color="#1565F5" />
              </Stack>

              {seller.display_name_en && (
                <Typography variant="h6" color="text.secondary" sx={{ mt: 0.5 }}>
                  {seller.display_name_en}
                </Typography>
              )}

              <Typography
                variant="h4"
                sx={{ mt: 2.5, maxWidth: 620, lineHeight: 1.35, whiteSpace: 'pre-line' }}
              >
                {seller.bio || 'ร้านค้าสื่อการสอนคุณภาพสำหรับครูและโรงเรียน'}
              </Typography>

              <Stack
                direction="row"
                spacing={{ xs: 2.5, md: 4 }}
                sx={{ mt: 3, color: 'text.secondary' }}
              >
                <Box>
                  <Typography variant="h6" color="text.primary">
                    {products.length.toLocaleString('th-TH')}
                  </Typography>
                  <Typography variant="body2">สินค้า</Typography>
                </Box>
                <Box>
                  <Typography variant="h6" color="text.primary">
                    {totalReviews.toLocaleString('th-TH')}
                  </Typography>
                  <Typography variant="body2">รีวิว</Typography>
                </Box>
                <Box>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography variant="h6" color="text.primary">
                      {averageRating ? averageRating.toFixed(1) : 'ใหม่'}
                    </Typography>
                    {!!averageRating && <Rating size="small" value={averageRating} readOnly />}
                  </Stack>
                  <Typography variant="body2">คะแนนร้าน</Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1.25} sx={{ mt: 3.5 }}>
                <Chip
                  icon={<RiShieldCheckLine />}
                  color="primary"
                  variant="soft"
                  label="ร้านค้าที่ผ่านการตรวจสอบ"
                />
                <Chip
                  variant="outlined"
                  label={sellerTypeLabels[seller.seller_type] ?? 'ผู้ขาย E-KRU'}
                />
              </Stack>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, lg: 6 }}>
            <Box
              sx={{
                height: 1,
                minHeight: { xs: 240, md: 360 },
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 3,
                bgcolor: '#073F46',
                backgroundImage: seller.cover_url
                  ? `linear-gradient(90deg, rgba(1,35,40,0.2), rgba(1,35,40,0.02)), url(${seller.cover_url})`
                  : 'radial-gradient(circle at 80% 20%, #1B8588 0%, #075158 35%, #032F35 75%)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <Box
                sx={{
                  inset: 0,
                  position: 'absolute',
                  background:
                    'linear-gradient(180deg, transparent 35%, rgba(2, 29, 34, 0.82) 100%)',
                }}
              />
              <Stack
                spacing={1}
                sx={{
                  left: 28,
                  right: 28,
                  bottom: 26,
                  zIndex: 1,
                  position: 'absolute',
                  color: 'common.white',
                }}
              >
                <Typography variant="h4">สื่อคุณภาพจาก {seller.display_name}</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.76)' }}>
                  เลือกซื้อ ดาวน์โหลด และนำไปใช้กับการเรียนการสอนได้ทันที
                </Typography>
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Card>

      <Box component="section" sx={{ pt: { xs: 5, md: 7 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography variant="h4">สินค้าทั้งหมดจากร้านนี้</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              พบ {visibleProducts.length.toLocaleString('th-TH')} รายการ
            </Typography>
          </Box>
          <Chip
            icon={<RiShoppingBag3Line />}
            label={`${products.length.toLocaleString('th-TH')} สินค้า`}
            variant="outlined"
          />
        </Stack>

        <Box component="nav" aria-label="หมวดหมู่สินค้าของร้าน" sx={{ mt: 3, overflowX: 'auto' }}>
          <Stack direction="row" spacing={1} sx={{ width: 'max-content' }}>
            {categories.map((item) => {
              const active = item === category;
              return (
                <Button
                  key={item}
                  color={active ? 'primary' : 'inherit'}
                  variant={active ? 'contained' : 'text'}
                  onClick={() => setCategory(item)}
                  sx={{ px: 2.25, borderRadius: 8 }}
                >
                  {item === 'all' ? 'ทั้งหมด' : item}
                </Button>
              );
            })}
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }} />

        {visibleProducts.length ? (
          <Grid container spacing={2.5}>
            {visibleProducts.map((product, index) => (
              <Grid
                key={product.id}
                size={{ xs: 12, sm: 6, md: 4, xl: 3 }}
                onClickCapture={
                  dashboardMode
                    ? (event) => {
                        if (
                          (event.target as HTMLElement).closest('[data-marketplace-seller-link]')
                        ) {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedProduct(product);
                      }
                    : undefined
                }
              >
                <MarketplaceProductCard product={product} colorIndex={index} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Card variant="outlined" sx={{ py: 9, textAlign: 'center', borderRadius: 3 }}>
            <RiStore2Line size={42} />
            <Typography variant="h6" sx={{ mt: 1.5 }}>
              ไม่พบสินค้าในหมวดหมู่นี้
            </Typography>
            <Typography color="text.secondary">เลือกหมวดหมู่อื่นเพื่อดูสินค้าของร้าน</Typography>
          </Card>
        )}
      </Box>

      {dashboardMode && (
        <MarketplaceProductDetailDialog
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </Container>
  );
}
