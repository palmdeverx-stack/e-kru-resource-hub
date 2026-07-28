'use client';

import type { MarketplaceSaleType, MarketplaceMediaType } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { useRouter } from 'src/routes/hooks';

import { RiUploadCloud2Line } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { MARKETPLACE_CATEGORIES } from '../../shared/constants';
import {
  getSaleTypes,
  getCategories,
  createProduct,
  getMediaTypes,
  updateProduct,
  getManagedProduct,
} from '../../shared/api';

type Props = {
  productId?: string;
};

export function MarketplaceProductFormView({ productId }: Props = {}) {
  const router = useRouter();
  const { user } = useAuthContext();
  const [categories, setCategories] = useState<string[]>(
    MARKETPLACE_CATEGORIES.filter((item) => item !== 'all')
  );
  const [mediaTypes, setMediaTypes] = useState<MarketplaceMediaType[]>([]);
  const [saleTypes, setSaleTypes] = useState<MarketplaceSaleType[]>([]);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(Boolean(productId));
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'ใบงาน',
    mediaTypeId: '',
    saleTypeId: '',
    price: '0',
    coverUrl: '',
    fileUrl: '',
  });

  useEffect(() => {
    Promise.all([
      getCategories(),
      getMediaTypes(),
      getSaleTypes(),
      productId ? getManagedProduct(productId) : Promise.resolve({ product: null }),
    ])
      .then(
        ([
          { categories: categoryRows },
          { items: mediaRows },
          { items: saleRows },
          { product },
        ]) => {
          if (!categoryRows.length) return;
          const names = categoryRows.map((category) => category.name);
          setCategories(names);
          setMediaTypes(mediaRows);
          setSaleTypes(saleRows);
          setForm((current) => ({
            ...current,
            title: product?.title ?? current.title,
            description: product?.description ?? current.description,
            category:
              product?.category ??
              (names.includes(current.category) ? current.category : names[0]),
            mediaTypeId:
              product?.media_type_id ?? (current.mediaTypeId || mediaRows[0]?.id || ''),
            saleTypeId: product?.sale_type_id ?? (current.saleTypeId || saleRows[0]?.id || ''),
            price: product ? String(product.price) : current.price,
            coverUrl: product?.cover_url ?? current.coverUrl,
            fileUrl: product?.file_url ?? current.fileUrl,
          }));
        }
      )
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลสินค้าไม่สำเร็จ');
      })
      .finally(() => setInitializing(false));
  }, [productId]);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const input = { ...form, price: Number(form.price) };
      if (productId) await updateProduct(productId, input);
      else await createProduct(input);
      router.push('/dashboard/seller');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ไม่สามารถลงสินค้าได้');
    } finally {
      setSaving(false);
    }
  };

  if (initializing) {
    return (
      <Box sx={{ minHeight: 480, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography component="h1" variant="h3">
        {productId ? 'แก้ไขสินค้า' : 'ลงสินค้าใหม่'}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 4 }}>
        {user?.role === 'master_admin'
          ? 'รายการนี้จะวางขายในนาม eKru ร้านค้าอย่างเป็นทางการของระบบ'
          : 'เพิ่มรายละเอียด ราคา และไฟล์สำหรับผู้ซื้อ'}
      </Typography>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={3}>
              <TextField
                required
                label="ชื่อสินค้า"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
              />
              <TextField
                required
                multiline
                minRows={6}
                label="รายละเอียดสินค้า"
                placeholder="อธิบายเนื้อหา จำนวนหน้า ระดับชั้น และสิ่งที่ผู้ซื้อจะได้รับ"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    select
                    fullWidth
                    label="หมวดหมู่"
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, category: event.target.value }))
                    }
                  >
                    {categories.map((item) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    select
                    fullWidth
                    label="ประเภทสื่อ"
                    value={form.mediaTypeId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        mediaTypeId: event.target.value,
                      }))
                    }
                  >
                    {mediaTypes.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    select
                    fullWidth
                    label="ประเภทการจำหน่าย"
                    value={form.saleTypeId}
                    onChange={(event) => {
                      const selected = saleTypes.find((item) => item.id === event.target.value);
                      setForm((current) => ({
                        ...current,
                        saleTypeId: event.target.value,
                        price: selected?.pricing_mode === 'free' ? '0' : current.price,
                      }));
                    }}
                  >
                    {saleTypes.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              <TextField
                type="number"
                label="ราคา (บาท)"
                value={form.price}
                disabled={
                  saleTypes.find((item) => item.id === form.saleTypeId)?.pricing_mode === 'free'
                }
                onChange={(event) =>
                  setForm((current) => ({ ...current, price: event.target.value }))
                }
              />
              <TextField
                label="URL รูปปก"
                placeholder="https://..."
                value={form.coverUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, coverUrl: event.target.value }))
                }
              />
              <TextField
                label="URL ไฟล์สินค้า"
                placeholder="ลิงก์ดาวน์โหลดสำหรับผู้ซื้อ"
                value={form.fileUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, fileUrl: event.target.value }))
                }
              />
            </Stack>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ p: 3, position: { md: 'sticky' }, top: 96 }}>
            <Stack spacing={2}>
              <RiUploadCloud2Line size={40} />
              <Typography variant="h5">พร้อมเผยแพร่?</Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.role === 'master_admin'
                  ? 'สินค้าจากร้าน eKru จะเผยแพร่ทันที'
                  : 'สินค้าจะถูกส่งให้ผู้ดูแลตรวจสอบก่อนแสดงใน Marketplace'}
              </Typography>
              <Button
                variant="contained"
                loading={saving}
                disabled={
                  form.title.trim().length < 3 ||
                  form.description.trim().length < 10 ||
                  !form.mediaTypeId ||
                  !form.saleTypeId ||
                  Number(form.price) < 0
                }
                onClick={submit}
              >
                {user?.role === 'master_admin'
                  ? 'เผยแพร่สินค้า'
                  : productId
                    ? 'บันทึกและส่งตรวจอีกครั้ง'
                    : 'ส่งตรวจอนุมัติ'}
              </Button>
              <Button color="inherit" onClick={() => router.back()}>
                ยกเลิก
              </Button>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
