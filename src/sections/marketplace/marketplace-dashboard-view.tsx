'use client';

import type { MarketplaceSeller, MarketplaceProduct } from 'src/types/marketplace';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { useRouter } from 'src/routes/hooks';

import {
  RiAddLine,
  RiStore2Line,
  RiBookOpenLine,
  RiLogoutBoxLine,
} from 'src/components/remix-icon';

import { signOut } from 'src/auth/context/jwt';
import { useAuthContext } from 'src/auth/hooks';

type SellerForm = {
  displayName: string;
  bio: string;
  contactEmail: string;
  sellerType: 'external' | 'organization';
};

type ProductForm = {
  title: string;
  description: string;
  category: string;
  resourceType: 'digital' | 'physical' | 'service';
  price: string;
  coverUrl: string;
  fileUrl: string;
};

const emptySellerForm: SellerForm = {
  displayName: '',
  bio: '',
  contactEmail: '',
  sellerType: 'external',
};

const emptyProductForm: ProductForm = {
  title: '',
  description: '',
  category: 'ใบงาน',
  resourceType: 'digital',
  price: '0',
  coverUrl: '',
  fileUrl: '',
};

export function MarketplaceDashboardView() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [seller, setSeller] = useState<MarketplaceSeller | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sellerDialog, setSellerDialog] = useState(false);
  const [productDialog, setProductDialog] = useState(false);
  const [sellerForm, setSellerForm] = useState(emptySellerForm);
  const [productForm, setProductForm] = useState(emptyProductForm);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [sellerResponse, productResponse] = await Promise.all([
        fetch('/api/marketplace/seller'),
        fetch('/api/marketplace/products?mine=1'),
      ]);
      const sellerResult = await sellerResponse.json();
      const productResult = await productResponse.json();
      setSeller(sellerResult.seller ?? null);
      setProducts(productResult.products ?? []);
      if (!sellerResponse.ok) setError(sellerResult.message ?? 'ไม่สามารถโหลดข้อมูลร้านค้าได้');
    } catch {
      setError('ไม่สามารถเชื่อมต่อระบบ Marketplace ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const openSellerDialog = () => {
    setSellerForm({
      displayName: seller?.display_name ?? '',
      bio: seller?.bio ?? '',
      contactEmail: seller?.contact_email ?? user?.email ?? '',
      sellerType: seller?.seller_type === 'organization' ? 'organization' : 'external',
    });
    setSellerDialog(true);
  };

  const saveSeller = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/marketplace/seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sellerForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setSeller(result.seller);
      setSellerDialog(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ไม่สามารถบันทึกร้านค้าได้');
    } finally {
      setSaving(false);
    }
  };

  const saveProduct = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...productForm, price: Number(productForm.price) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setProducts((current) => [result.product, ...current]);
      setProductForm(emptyProductForm);
      setProductDialog(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ไม่สามารถลงสินค้าได้');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
    router.refresh();
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: 480, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={4}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Typography variant="h3">Marketplace Dashboard</Typography>
            <Typography sx={{ mt: 0.5, color: 'text.secondary' }}>
              สวัสดี {user?.displayName || user?.username} · {roleLabel(user?.role)}
            </Typography>
          </Box>
          <Button color="inherit" startIcon={<RiLogoutBoxLine />} onClick={handleSignOut}>
            ออกจากระบบ
          </Button>
        </Stack>

        {!!error && <Alert severity="error">{error}</Alert>}

        {!seller ? (
          <Card
            sx={{
              p: { xs: 3, md: 5 },
              border: '1px solid',
              borderColor: 'primary.light',
              bgcolor: 'primary.lighter',
            }}
          >
            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 12, md: 8 }}>
                <Stack spacing={1.5}>
                  <RiStore2Line size={44} />
                  <Typography variant="h4">เปิดร้านของคุณบน eKru</Typography>
                  <Typography color="text.secondary">
                    {user?.role === 'teacher'
                      ? 'บัญชีครูของคุณพร้อมเชื่อมต่อ เปิดร้านและเริ่มแบ่งปันสื่อการสอนได้เลย'
                      : 'บุคคลทั่วไปและองค์กรสามารถเปิดร้าน ลงสื่อการสอน และสร้างรายได้จากผลงานได้'}
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }} sx={{ textAlign: { md: 'right' } }}>
                <Button
                  size="large"
                  variant="contained"
                  startIcon={<RiStore2Line />}
                  onClick={openSellerDialog}
                >
                  เปิดร้านฟรี
                </Button>
              </Grid>
            </Grid>
          </Card>
        ) : (
          <>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Card sx={{ p: 3, height: 1 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        display: 'grid',
                        borderRadius: 2,
                        placeItems: 'center',
                        color: 'primary.main',
                        bgcolor: 'primary.lighter',
                      }}
                    >
                      <RiStore2Line size={32} />
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="h5">{seller.display_name}</Typography>
                        <Chip size="small" color="success" label="เปิดขายแล้ว" />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {seller.bio || 'ร้านค้าบน eKru Marketplace'}
                      </Typography>
                    </Box>
                    <Button onClick={openSellerDialog}>แก้ไขร้าน</Button>
                  </Stack>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ p: 3, height: 1 }}>
                  <Typography variant="overline" color="text.secondary">
                    สินค้าในร้าน
                  </Typography>
                  <Typography variant="h2">{products.length}</Typography>
                </Card>
              </Grid>
            </Grid>

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h4">สินค้าของฉัน</Typography>
                <Typography variant="body2" color="text.secondary">
                  จัดการสื่อและผลงานที่เปิดขาย
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<RiAddLine />}
                onClick={() => setProductDialog(true)}
              >
                ลงสินค้าใหม่
              </Button>
            </Stack>

            {products.length ? (
              <Grid container spacing={2}>
                {products.map((product) => (
                  <Grid key={product.id} size={{ xs: 12, md: 6 }}>
                    <Card sx={{ p: 2.5 }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box
                          sx={{
                            width: 64,
                            height: 64,
                            display: 'grid',
                            borderRadius: 2,
                            placeItems: 'center',
                            bgcolor: 'background.neutral',
                          }}
                        >
                          <RiBookOpenLine />
                        </Box>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography variant="subtitle1" noWrap>
                            {product.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {product.category} · ฿{Number(product.price).toLocaleString('th-TH')}
                          </Typography>
                        </Box>
                        <Chip size="small" color="success" label="เผยแพร่" />
                      </Stack>
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
                <Typography variant="body2" color="text.secondary">
                  ลงสื่อชิ้นแรกเพื่อเริ่มต้นร้านของคุณ
                </Typography>
              </Card>
            )}
          </>
        )}
      </Stack>

      <Dialog open={sellerDialog} onClose={() => setSellerDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{seller ? 'แก้ไขข้อมูลร้าน' : 'เปิดร้านบน eKru'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              label="ชื่อร้าน"
              value={sellerForm.displayName}
              onChange={(event) =>
                setSellerForm((current) => ({ ...current, displayName: event.target.value }))
              }
            />
            {user?.role !== 'teacher' && (
              <TextField
                select
                label="ประเภทผู้ขาย"
                value={sellerForm.sellerType}
                onChange={(event) =>
                  setSellerForm((current) => ({
                    ...current,
                    sellerType: event.target.value as SellerForm['sellerType'],
                  }))
                }
              >
                <MenuItem value="external">บุคคลทั่วไป</MenuItem>
                <MenuItem value="organization">องค์กร / บริษัท</MenuItem>
              </TextField>
            )}
            <TextField
              label="อีเมลติดต่อ"
              value={sellerForm.contactEmail}
              onChange={(event) =>
                setSellerForm((current) => ({ ...current, contactEmail: event.target.value }))
              }
            />
            <TextField
              multiline
              minRows={3}
              label="เกี่ยวกับร้าน"
              value={sellerForm.bio}
              onChange={(event) =>
                setSellerForm((current) => ({ ...current, bio: event.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setSellerDialog(false)}>
            ยกเลิก
          </Button>
          <Button variant="contained" loading={saving} onClick={saveSeller}>
            บันทึกร้าน
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={productDialog} onClose={() => setProductDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>ลงสินค้าใหม่</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              label="ชื่อสินค้า"
              value={productForm.title}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, title: event.target.value }))
              }
            />
            <TextField
              multiline
              minRows={3}
              label="รายละเอียด"
              value={productForm.description}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, description: event.target.value }))
              }
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="หมวดหมู่"
                  value={productForm.category}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, category: event.target.value }))
                  }
                >
                  {['แผนการสอน', 'ใบงาน', 'สื่อประกอบ', 'แบบทดสอบ', 'คอร์สเรียน'].map((item) => (
                    <MenuItem key={item} value={item}>
                      {item}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="ราคา (บาท)"
                  value={productForm.price}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, price: event.target.value }))
                  }
                />
              </Grid>
            </Grid>
            <TextField
              label="URL รูปปก (ไม่บังคับ)"
              value={productForm.coverUrl}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, coverUrl: event.target.value }))
              }
            />
            <TextField
              label="URL ไฟล์สินค้า (ไม่บังคับ)"
              value={productForm.fileUrl}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, fileUrl: event.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setProductDialog(false)}>
            ยกเลิก
          </Button>
          <Button variant="contained" loading={saving} onClick={saveProduct}>
            เผยแพร่สินค้า
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

function roleLabel(role?: string) {
  if (role === 'teacher') return 'ครู eKru';
  if (role === 'school_admin') return 'ผู้ดูแลโรงเรียน';
  if (role === 'master_admin') return 'ผู้ดูแลระบบ';
  if (role === 'student') return 'นักเรียน';
  return 'สมาชิก Marketplace';
}
