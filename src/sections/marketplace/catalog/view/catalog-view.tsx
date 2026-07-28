'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
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

import { getProducts, getCategories } from '../../shared/api';
import { MarketplaceProductCard } from '../../shared/product-card';
import { SAMPLE_PRODUCTS, MARKETPLACE_CATEGORIES } from '../../shared/constants';

export function MarketplaceCatalogView() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([...MARKETPLACE_CATEGORIES]);

  useEffect(() => {
    getCategories()
      .then(({ categories: categoryRows }) => {
        if (categoryRows.length) {
          setCategories(['all', ...categoryRows.map((item) => item.name)]);
        }
      })
      .catch(() => {
        // Keep the built-in category fallback while the master schema is being installed.
      });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await getProducts({ q: search, category });
        setProducts(result.products.length ? result.products : SAMPLE_PRODUCTS);
      } catch {
        setProducts(SAMPLE_PRODUCTS);
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
          py: { xs: 7, md: 11 },
          background:
            'radial-gradient(circle at 85% 20%, rgba(21, 101, 245, 0.16), transparent 34%), linear-gradient(180deg, #F5F9FF 0%, #FFFFFF 100%)',
        })}
      >
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={3} alignItems={{ xs: 'center', md: 'flex-start' }}>
                <Chip icon={<RiGraduationCapLine />} label="จากครู เพื่อการเรียนรู้ที่ดีขึ้น" />
                <Typography
                  component="h1"
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
                  ค้นหา ซื้อ และขายแผนการสอน ใบงาน แบบทดสอบ และสื่อคุณภาพจากชุมชนการศึกษา eKru
                </Typography>
                <TextField
                  fullWidth
                  value={search}
                  placeholder="ค้นหาสื่อ วิชา หรือระดับชั้น..."
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
                    href={paths.marketplace.seller}
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
                  boxShadow: '0 32px 80px rgba(13, 63, 156, 0.24)',
                }}
              >
                <Stack spacing={3}>
                  <RiShieldCheckLine size={48} />
                  <Typography variant="h3">บัญชีเดียวกับ eKru</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.76)' }}>
                    ครูใช้บัญชีเดิมได้ทันที บุคคลทั่วไปสมัครใหม่ได้
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
            {categories.map((item) => (
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
          ) : visibleProducts.length ? (
            <Grid container spacing={3}>
              {visibleProducts.map((product, index) => (
                <Grid key={product.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <MarketplaceProductCard product={product} colorIndex={index} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box sx={{ py: 10, textAlign: 'center' }}>
              <Typography variant="h5">ไม่พบสื่อที่ค้นหา</Typography>
              <Typography color="text.secondary">ลองเปลี่ยนคำค้นหรือเลือกหมวดหมู่อื่น</Typography>
            </Box>
          )}
        </Stack>
      </Container>
    </>
  );
}
