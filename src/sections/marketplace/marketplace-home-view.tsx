'use client';

import type { MarketplaceProduct } from 'src/types/marketplace';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import {
  RiSearchLine,
  RiStore2Line,
  RiBookOpenLine,
  RiShieldCheckLine,
  RiGraduationCapLine,
} from 'src/components/remix-icon';

const CATEGORIES = ['all', 'แผนการสอน', 'ใบงาน', 'สื่อประกอบ', 'แบบทดสอบ', 'คอร์สเรียน'];

const FALLBACK_PRODUCTS: MarketplaceProduct[] = [
  {
    id: 'sample-1',
    seller_id: 'sample',
    title: 'ชุดใบงานคณิตศาสตร์ ป.4',
    description: 'ใบงานพร้อมเฉลย ใช้ได้ทั้งในห้องเรียนและการบ้าน',
    category: 'ใบงาน',
    resource_type: 'digital',
    price: 129,
    currency: 'THB',
    cover_url: null,
    status: 'published',
    created_at: new Date().toISOString(),
    seller: { id: 'sample', display_name: 'ครูมินตรา', seller_type: 'teacher' },
  },
  {
    id: 'sample-2',
    seller_id: 'sample',
    title: 'แผนการสอนวิทยาศาสตร์ Active Learning',
    description: 'แผนการสอน 10 คาบ พร้อมกิจกรรมและเกณฑ์ประเมิน',
    category: 'แผนการสอน',
    resource_type: 'digital',
    price: 249,
    currency: 'THB',
    cover_url: null,
    status: 'published',
    created_at: new Date().toISOString(),
    seller: { id: 'sample', display_name: 'Science Lab', seller_type: 'external' },
  },
  {
    id: 'sample-3',
    seller_id: 'sample',
    title: 'เกมคำศัพท์ภาษาอังกฤษในห้องเรียน',
    description: 'สไลด์เกมพร้อมเล่น 5 รูปแบบ สำหรับประถมศึกษา',
    category: 'สื่อประกอบ',
    resource_type: 'digital',
    price: 89,
    currency: 'THB',
    cover_url: null,
    status: 'published',
    created_at: new Date().toISOString(),
    seller: { id: 'sample', display_name: 'Happy English', seller_type: 'teacher' },
  },
];

export function MarketplaceHomeView() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (category !== 'all') params.set('category', category);

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/marketplace/products?${params}`);
        const result = await response.json();
        setProducts(result.products?.length ? result.products : FALLBACK_PRODUCTS);
      } catch {
        setProducts(FALLBACK_PRODUCTS);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [category, search]);

  const visibleProducts = products.filter(
    (product) =>
      (category === 'all' || product.category === category) &&
      (!search || product.title.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <Box
        sx={(theme) => ({
          py: { xs: 8, md: 12 },
          borderBottom: `1px solid ${theme.vars.palette.divider}`,
          background:
            'radial-gradient(circle at 85% 20%, rgba(0, 167, 111, 0.16), transparent 34%), linear-gradient(180deg, #F7FFF9 0%, #FFFFFF 100%)',
        })}
      >
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={3} alignItems={{ xs: 'center', md: 'flex-start' }}>
                <Chip icon={<RiGraduationCapLine />} label="จากครู เพื่อการเรียนรู้ที่ดีขึ้น" />
                <Typography
                  variant="h1"
                  sx={{ fontSize: { xs: 42, md: 68 }, textAlign: { xs: 'center', md: 'left' } }}
                >
                  สื่อการสอนดี ๆ
                  <Box component="span" sx={{ color: 'primary.main' }}>
                    {' '}
                    อยู่ที่นี่
                  </Box>
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    maxWidth: 660,
                    color: 'text.secondary',
                    fontWeight: 400,
                    textAlign: { xs: 'center', md: 'left' },
                  }}
                >
                  ค้นหาสื่อ แผนการสอน ใบงาน และคอร์สคุณภาพจากครู eKru
                  และนักสร้างสรรค์การศึกษาทั่วประเทศ
                </Typography>
                <TextField
                  fullWidth
                  value={search}
                  placeholder="ค้นหาสื่อการสอน..."
                  onChange={(event) => setSearch(event.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <RiSearchLine />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{ maxWidth: 620, bgcolor: 'background.paper' }}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    size="large"
                    variant="contained"
                    href="#products"
                    startIcon={<RiBookOpenLine />}
                  >
                    เลือกดูสื่อ
                  </Button>
                  <Button
                    size="large"
                    variant="outlined"
                    component={RouterLink}
                    href={paths.marketplace.dashboard}
                    startIcon={<RiStore2Line />}
                  >
                    เปิดร้านขายสื่อ
                  </Button>
                </Stack>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Box
                sx={{
                  p: 4,
                  borderRadius: 5,
                  color: 'common.white',
                  bgcolor: 'primary.darker',
                  boxShadow: '0 32px 80px rgba(0, 75, 60, 0.24)',
                }}
              >
                <Stack spacing={3}>
                  <RiShieldCheckLine size={48} />
                  <Typography variant="h3">บัญชีเดียวกับ eKru</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.76)' }}>
                    ครูเข้าสู่ระบบด้วยบัญชีเดิมได้ทันที บุคคลทั่วไปสมัครใหม่ได้
                    และทุกคนสามารถเปิดร้านขายผลงานของตัวเอง
                  </Typography>
                  <Stack direction="row" spacing={4}>
                    <Box>
                      <Typography variant="h3">0%</Typography>
                      <Typography variant="caption">ค่าเปิดร้าน</Typography>
                    </Box>
                    <Box>
                      <Typography variant="h3">1 บัญชี</Typography>
                      <Typography variant="caption">ใช้ร่วมกับ eKru</Typography>
                    </Box>
                  </Stack>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container id="products" maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
        <Stack spacing={4}>
          <Box>
            <Typography variant="h3">เลือกสื่อที่เหมาะกับห้องเรียน</Typography>
            <Typography sx={{ mt: 1, color: 'text.secondary' }}>
              ผลงานใหม่จากผู้ขายในชุมชน eKru
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
            {CATEGORIES.map((item) => (
              <Chip
                key={item}
                clickable
                color={category === item ? 'primary' : 'default'}
                label={item === 'all' ? 'ทั้งหมด' : item}
                onClick={() => setCategory(item)}
              />
            ))}
          </Stack>

          {loading ? (
            <Box sx={{ py: 10, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {visibleProducts.map((product, index) => (
                <Grid key={product.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <ProductCard product={product} colorIndex={index} />
                </Grid>
              ))}
            </Grid>
          )}
        </Stack>
      </Container>
    </>
  );
}

function ProductCard({ product, colorIndex }: { product: MarketplaceProduct; colorIndex: number }) {
  const colors = ['#E8F8EF', '#FFF4DE', '#E9F2FF'];

  return (
    <Card sx={{ height: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
      <Box
        sx={{
          height: 210,
          p: 3,
          display: 'grid',
          placeItems: 'center',
          bgcolor: colors[colorIndex % colors.length],
          backgroundImage: product.cover_url ? `url(${product.cover_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {!product.cover_url && <RiBookOpenLine size={64} color="#007B55" />}
      </Box>
      <Stack spacing={1.5} sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Chip size="small" label={product.category} />
          <Typography variant="h5" color="primary.main">
            {product.price === 0 ? 'ฟรี' : `฿${Number(product.price).toLocaleString('th-TH')}`}
          </Typography>
        </Stack>
        <Typography variant="h6">{product.title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ minHeight: 44 }}>
          {product.description}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          โดย {product.seller?.display_name ?? 'ผู้ขาย eKru'}
        </Typography>
      </Stack>
    </Card>
  );
}
