'use client';

import type { MarketplaceSeller, MarketplaceProduct } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { RouterLink } from 'src/routes/components';

import {
  RiAddLine,
  RiEditLine,
  RiStore2Line,
  RiBookOpenLine,
  RiShieldStarLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { getSeller, getProducts, formatPrice } from '../../shared/api';

export function MarketplaceSellerDashboardView() {
  const { user } = useAuthContext();
  const isSystemStore = user?.role === 'master_admin';
  const [seller, setSeller] = useState<MarketplaceSeller | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getSeller(), getProducts({ mine: true })])
      .then(([sellerResult, productResult]) => {
        setSeller(sellerResult.seller);
        setProducts(productResult.products);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'ไม่สามารถโหลดข้อมูลร้านได้')
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ minHeight: 480, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!seller ? (
        <Card sx={{ p: { xs: 3, md: 6 }, textAlign: 'center' }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              mx: 'auto',
              display: 'grid',
              borderRadius: 3,
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: 'primary.lighter',
            }}
          >
            <RiStore2Line size={40} />
          </Box>
          <Typography variant="h3" sx={{ mt: 3 }}>
            เปิดร้านบน eKru Marketplace
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', mt: 1, mb: 3 }}>
            ครู บุคคลทั่วไป และองค์กรสามารถสร้างร้าน แบ่งปันสื่อการสอน
            และจัดการผลงานได้จากพื้นที่เดียว
          </Typography>
          <Button component={RouterLink} href="/dashboard/seller/setup" variant="contained">
            เริ่มเปิดร้าน
          </Button>
        </Card>
      ) : !isSystemStore && seller.status !== 'active' ? (
        <SellerReviewState seller={seller} />
      ) : (
        <Stack spacing={4}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            spacing={2}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography component="h1" variant="h3">
                  {seller.display_name}
                </Typography>
                {isSystemStore && (
                  <Chip
                    color="primary"
                    size="small"
                    icon={<RiShieldStarLine />}
                    label="ร้านทางการ"
                  />
                )}
                <Chip color="success" size="small" label="เปิดขายแล้ว" />
              </Stack>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {seller.bio || 'ร้านค้าบน eKru Marketplace'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button component={RouterLink} href="/dashboard/seller/setup" color="inherit">
                แก้ไขร้าน
              </Button>
              <Button
                component={RouterLink}
                href="/dashboard/seller/products/new"
                variant="contained"
                startIcon={<RiAddLine />}
              >
                ลงสินค้าใหม่
              </Button>
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ p: 3 }}>
                <Typography variant="overline" color="text.secondary">
                  สินค้าทั้งหมด
                </Typography>
                <Typography variant="h2">{products.length}</Typography>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ p: 3 }}>
                <Typography variant="overline" color="text.secondary">
                  สถานะร้าน
                </Typography>
                <Typography variant="h4" color="success.main" sx={{ mt: 1 }}>
                  พร้อมขาย
                </Typography>
              </Card>
            </Grid>
          </Grid>

          <Box>
            <Typography variant="h4">สินค้าของฉัน</Typography>
            <Typography color="text.secondary">
              ติดตามสถานะการตรวจสอบและรายการที่เผยแพร่ใน Marketplace
            </Typography>
          </Box>

          {products.length ? (
            <Grid container spacing={2}>
              {products.map((product) => (
                <Grid key={product.id} size={{ xs: 12, md: 6 }}>
                  <Card sx={{ p: 2.5 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 68,
                          height: 68,
                          flexShrink: 0,
                          display: 'grid',
                          borderRadius: 2,
                          placeItems: 'center',
                          bgcolor: 'primary.lighter',
                        }}
                      >
                        <RiBookOpenLine />
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" noWrap>
                          {product.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {product.category} · {formatPrice(Number(product.price))}
                        </Typography>
                      </Box>
                      <ProductStatusChip product={product} />
                    </Stack>
                    {product.rejection_reason && (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          justifyContent="space-between"
                          alignItems={{ sm: 'center' }}
                          spacing={1}
                        >
                          <span>ไม่ผ่านการอนุมัติ: {product.rejection_reason}</span>
                          <Button
                            component={RouterLink}
                            href={`/dashboard/seller/products/${product.id}/edit`}
                            size="small"
                            color="error"
                            variant="outlined"
                            startIcon={<RiEditLine />}
                          >
                            แก้ไขและส่งใหม่
                          </Button>
                        </Stack>
                      </Alert>
                    )}
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Card sx={{ py: 8, textAlign: 'center', borderStyle: 'dashed' }}>
              <RiBookOpenLine size={42} />
              <Typography variant="h6" sx={{ mt: 2 }}>
                ยังไม่มีสินค้า
              </Typography>
              <Button
                component={RouterLink}
                href="/dashboard/seller/products/new"
                variant="contained"
                sx={{ mt: 2 }}
              >
                ลงสินค้าชิ้นแรก
              </Button>
            </Card>
          )}
        </Stack>
      )}
    </Container>
  );
}

function ProductStatusChip({ product }: { product: MarketplaceProduct }) {
  if (product.status === 'published') {
    return <Chip size="small" color="success" label="เผยแพร่แล้ว" variant="soft" />;
  }
  if (product.status === 'rejected') {
    return <Chip size="small" color="error" label="ไม่ผ่าน" variant="soft" />;
  }
  if (product.status === 'pending_review') {
    return <Chip size="small" color="warning" label="รอตรวจสอบ" variant="soft" />;
  }
  return <Chip size="small" label="ฉบับร่าง" variant="soft" />;
}

function SellerReviewState({ seller }: { seller: MarketplaceSeller }) {
  const isRejected = seller.status === 'rejected';
  const isSuspended = seller.status === 'suspended';
  const isDraft = seller.status === 'draft';

  return (
    <Card sx={{ p: { xs: 3, md: 6 }, textAlign: 'center' }}>
      <Box
        sx={{
          width: 80,
          height: 80,
          mx: 'auto',
          display: 'grid',
          borderRadius: 3,
          placeItems: 'center',
          color: isRejected || isSuspended ? 'error.main' : 'warning.main',
          bgcolor: isRejected || isSuspended ? 'error.lighter' : 'warning.lighter',
        }}
      >
        <RiStore2Line size={40} />
      </Box>
      <Typography variant="h3" sx={{ mt: 3 }}>
        {isDraft
          ? 'แบบร่างการสมัครเปิดร้าน'
          : isRejected
          ? 'คำขอเปิดร้านไม่ผ่านการอนุมัติ'
          : isSuspended
            ? 'ร้านถูกระงับการใช้งาน'
            : 'ส่งคำขอเปิดร้านแล้ว'}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 620, mx: 'auto', mt: 1 }}>
        {isDraft
          ? 'ข้อมูลยังไม่ถูกส่งให้ผู้ดูแล กรุณากรอก Wizard ให้ครบแล้วส่งคำขอ'
          : isRejected
          ? seller.rejection_reason || 'กรุณาตรวจสอบและแก้ไขข้อมูลร้านก่อนส่งคำขอใหม่'
          : isSuspended
            ? 'กรุณาติดต่อผู้ดูแลระบบเพื่อสอบถามรายละเอียด'
            : 'ผู้ดูแลระบบกำลังตรวจสอบข้อมูลร้าน เมื่ออนุมัติแล้วคุณจึงจะสามารถสร้างและส่งสินค้าได้'}
      </Typography>
      {!isSuspended && (
        <Button
          component={RouterLink}
          href="/dashboard/seller/setup"
          variant={isRejected ? 'contained' : 'outlined'}
          color={isRejected ? 'error' : 'primary'}
          sx={{ mt: 3 }}
        >
          {isDraft
            ? 'กรอกข้อมูลสมัครต่อ'
            : isRejected
              ? 'แก้ไขและส่งคำขอใหม่'
              : 'ดูหรือแก้ไขคำขอ'}
        </Button>
      )}
    </Card>
  );
}
