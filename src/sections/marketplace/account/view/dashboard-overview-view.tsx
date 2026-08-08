'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import {
  RiHeart3Line,
  RiStore2Line,
  RiBookmarkLine,
  RiBookOpenLine,
  RiArrowRightLine,
  RiShoppingBag3Line,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { getProductCollections } from '../../shared/api';
import { MarketplaceProductCard } from '../../shared/product-card';
import { MarketplaceProductDetailDialog } from '../../catalog/components/product-detail-dialog';

const actions = [
  {
    title: 'เลือกซื้อสื่อการสอน',
    description: 'ค้นหาใบงาน แผนการสอน และสื่อใหม่จากชุมชน',
    href: paths.marketplace.dashboardProducts,
    icon: RiBookOpenLine,
    color: 'primary.lighter',
  },
  {
    title: 'รายการซื้อของฉัน',
    description: 'ตรวจสอบคำสั่งซื้อและดาวน์โหลดไฟล์ที่ซื้อแล้ว',
    href: '/dashboard/purchases',
    icon: RiShoppingBag3Line,
    color: 'info.lighter',
  },
  {
    title: 'ร้านค้าของฉัน',
    description: 'เปิดร้าน ลงสินค้า และจัดการผลงานของคุณ',
    href: '/dashboard/seller',
    icon: RiStore2Line,
    color: 'warning.lighter',
  },
] as const;

export function MarketplaceDashboardOverviewView() {
  const { user } = useAuthContext();
  const isPlatformAdmin = user?.role === 'master_admin' || user?.role === 'marketplace_admin';

  return (
    <>
      <Container maxWidth={false} sx={{ py: { xs: 3, md: 3 } }}>
        <Card
          sx={{
            p: { xs: 3, md: 4.5 },
            overflow: 'hidden',
            position: 'relative',
            borderRadius: 4,
            color: 'common.white',
            background: 'linear-gradient(125deg, #0B3B8F 0%, #1565F5 52%, #53A2FF 100%)',
          }}
        >
          <Box
            sx={{
              width: 260,
              height: 260,
              top: -130,
              right: -40,
              position: 'absolute',
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.10)',
            }}
          />
          <Chip
            label="E-KRU Marketplace"
            sx={{ mb: 2, color: 'common.white', bgcolor: 'rgba(255,255,255,0.16)' }}
          />
          <Typography component="h1" variant="h2" sx={{ position: 'relative' }}>
            สวัสดีคุณ {user?.displayName || user?.username}
          </Typography>
          <Typography sx={{ mt: 1, maxWidth: 620, color: 'rgba(255,255,255,0.78)' }}>
            ค้นพบสื่อใหม่ เก็บรายการที่สนใจ และกลับมาจัดการทุกอย่างได้จากพื้นที่ของคุณ
          </Typography>
          <Button
            component={RouterLink}
            href={paths.marketplace.dashboardProducts}
            variant="contained"
            color="white"
            endIcon={<RiArrowRightLine />}
            sx={{ mt: 3, color: 'primary.darker', bgcolor: 'common.white' }}
          >
            เลือกดูสินค้าทั้งหมด
          </Button>
        </Card>

        <Grid container spacing={2.5} sx={{ mt: 3 }}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Grid key={action.href} size={{ xs: 12, md: 4 }}>
                <Card variant="outlined" sx={{ p: 2.5, height: 1, borderRadius: 3 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        flexShrink: 0,
                        borderRadius: 2,
                        placeItems: 'center',
                        display: 'inline-grid',
                        bgcolor: action.color,
                      }}
                    >
                      <Icon size={25} />
                    </Box>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="subtitle1">{action.title}</Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 0.25,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {action.description}
                      </Typography>
                    </Box>
                    <Button
                      component={RouterLink}
                      href={action.href}
                      color="inherit"
                      aria-label={`ไปที่ ${action.title}`}
                      sx={{ minWidth: 36, px: 1 }}
                    >
                      <RiArrowRightLine />
                    </Button>
                  </Stack>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>

      {!isPlatformAdmin && <MarketplaceDashboardCollectionsSection />}
    </>
  );
}

export function MarketplaceDashboardCollectionsSection() {
  const [favorites, setFavorites] = useState<MarketplaceProduct[]>([]);
  const [bookmarks, setBookmarks] = useState<MarketplaceProduct[]>([]);
  const [activeList, setActiveList] = useState<'favorite' | 'bookmark'>('favorite');
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCollections = () => {
      getProductCollections()
        .then((result) => {
          setFavorites(result.favorites);
          setBookmarks(result.bookmarks);
        })
        .catch(() => {
          setFavorites([]);
          setBookmarks([]);
        })
        .finally(() => setLoading(false));
    };

    loadCollections();
    window.addEventListener('marketplace-collections-changed', loadCollections);
    return () => window.removeEventListener('marketplace-collections-changed', loadCollections);
  }, []);

  const products = activeList === 'favorite' ? favorites : bookmarks;

  return (
    <Container maxWidth={false} sx={{ pb: { xs: 5, md: 7 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'flex-end' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4">รายการที่คุณสนใจ</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            สินค้าที่กดหัวใจและบันทึกไว้จะรวมอยู่ที่นี่
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          href={paths.marketplace.dashboardProducts}
          endIcon={<RiArrowRightLine />}
        >
          ดูสินค้าทั้งหมด
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        <Button
          variant={activeList === 'favorite' ? 'contained' : 'outlined'}
          color={activeList === 'favorite' ? 'error' : 'inherit'}
          startIcon={<RiHeart3Line />}
          onClick={() => setActiveList('favorite')}
          sx={{ borderRadius: 8 }}
        >
          ถูกใจ ({favorites.length.toLocaleString('th-TH')})
        </Button>
        <Button
          variant={activeList === 'bookmark' ? 'contained' : 'outlined'}
          color={activeList === 'bookmark' ? 'primary' : 'inherit'}
          startIcon={<RiBookmarkLine />}
          onClick={() => setActiveList('bookmark')}
          sx={{ borderRadius: 8 }}
        >
          บุ๊กมาร์ก ({bookmarks.length.toLocaleString('th-TH')})
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : products.length ? (
        <Grid container spacing={2.5}>
          {products.slice(0, 8).map((product, index) => (
            <Grid
              key={product.id}
              size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}
              onClickCapture={(event) => {
                if ((event.target as HTMLElement).closest('[data-marketplace-seller-link]')) return;
                event.preventDefault();
                event.stopPropagation();
                setSelectedProduct(product);
              }}
            >
              <MarketplaceProductCard product={product} colorIndex={index} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Card
          variant="outlined"
          sx={{ py: 7, px: 3, textAlign: 'center', borderRadius: 3, borderStyle: 'dashed' }}
        >
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
            {activeList === 'favorite' ? <RiHeart3Line size={46} /> : <RiBookmarkLine size={46} />}
          </Box>
          <Typography variant="h6" sx={{ mt: 3 }}>
            {activeList === 'favorite' ? 'ยังไม่มีสินค้าที่กดหัวใจ' : 'ยังไม่มีสินค้าที่บุ๊กมาร์ก'}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
            กดไอคอนในหน้ารายละเอียดสินค้า แล้วรายการจะมาแสดงที่ Dashboard
          </Typography>
          <Button
            component={RouterLink}
            href={paths.marketplace.dashboardProducts}
            variant="contained"
            color="primary"
          >
            เลือกดูสินค้า
          </Button>
        </Card>
      )}

      <MarketplaceProductDetailDialog
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </Container>
  );
}
