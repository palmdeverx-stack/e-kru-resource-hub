'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { RiFilePaper2Line, RiShieldCheckLine } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { formatPrice } from '../../shared/api';
import { useMarketplaceCart } from '../../cart/cart-context';

type Deal = {
  id: string;
  status: string;
  school_name: string;
  school_email: string;
  contact_name: string;
  negotiated_price: number;
  list_price: number;
  discount_amount: number;
  terms_snapshot: string;
  expires_at: string;
  seller: { display_name: string; logo_url: string | null } | null;
  product: MarketplaceProduct | null;
};

export function QuoteAcceptanceView({ token }: { token: string }) {
  const router = useRouter();
  const { authenticated, user } = useAuthContext();
  const { addItem, clearCart } = useMarketplaceCart();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [canCheckout, setCanCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerPosition, setSignerPosition] = useState('');
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pdpaAccepted, setPdpaAccepted] = useState(false);

  useEffect(() => {
    fetch(`/api/marketplace/quotes/${token}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? 'โหลดข้อเสนอไม่สำเร็จ');
        setDeal(result.deal);
        setCanCheckout(Boolean(result.canCheckout));
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'โหลดข้อเสนอไม่สำเร็จ')
      )
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (user && !signerName) {
      setSignerName(
        [user.first_name, user.last_name].filter(Boolean).join(' ') ||
          user.displayName ||
          user.username
      );
    }
  }, [signerName, user]);

  const goToCheckout = (product: MarketplaceProduct) => {
    clearCart();
    addItem({ ...product, price: Number(deal?.negotiated_price ?? product.price) });
    router.push(`${paths.marketplace.dashboardCheckout}?dealToken=${encodeURIComponent(token)}`);
  };

  const accept = async () => {
    if (!authenticated) {
      router.push(`${paths.auth.jwt.signIn}?returnTo=${encodeURIComponent(`/quotes/${token}`)}`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/marketplace/quotes/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerName,
          signerPosition,
          authorityConfirmed,
          termsAccepted,
          pdpaAccepted,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'ยอมรับข้อเสนอไม่สำเร็จ');
      setDeal(result.deal);
      setCanCheckout(true);
      if (result.deal.product) goToCheckout(result.deal.product);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'ยอมรับข้อเสนอไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!deal) {
    return (
      <Container maxWidth="sm" sx={{ py: 10 }}>
        <Alert severity="error">{error || 'ไม่พบข้อเสนอ'}</Alert>
      </Container>
    );
  }

  const actionable = ['sent', 'viewed'].includes(deal.status);
  const expired = deal.status === 'expired' || deal.status === 'cancelled';

  return (
    <Container maxWidth="md" sx={{ py: { xs: 5, md: 9 } }}>
      <Card variant="outlined" sx={{ overflow: 'hidden', borderRadius: 4 }}>
        <Box sx={{ p: { xs: 3, md: 5 }, bgcolor: 'primary.lighter' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <RiFilePaper2Line size={34} />
            <Box>
              <Typography variant="overline">ข้อเสนอขายสำหรับโรงเรียน</Typography>
              <Typography component="h1" variant="h3">
                {deal.school_name}
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack spacing={3} sx={{ p: { xs: 3, md: 5 } }}>
          {!!error && <Alert severity="error">{error}</Alert>}
          <Box>
            <Typography variant="h4">{deal.product?.title}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              เสนอโดย {deal.seller?.display_name} · ผู้ติดต่อ {deal.contact_name}
            </Typography>
          </Box>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
            <Box>
              <Typography variant="caption" color="text.secondary">
                ราคาตามข้อเสนอ
              </Typography>
              <Typography variant="h3" color="primary.main">
                {formatPrice(Number(deal.negotiated_price))}
              </Typography>
            </Box>
            {Number(deal.discount_amount) > 0 && (
              <Chip
                color="success"
                label={`ประหยัด ${formatPrice(Number(deal.discount_amount))}`}
              />
            )}
          </Stack>
          <Alert severity="info">
            ข้อเสนอใช้ได้ถึง{' '}
            {new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' }).format(
              new Date(deal.expires_at)
            )}
          </Alert>
          <Divider />
          <Box>
            <Typography variant="h6">เงื่อนไขข้อเสนอ</Typography>
            <Typography sx={{ mt: 1, whiteSpace: 'pre-line' }}>{deal.terms_snapshot}</Typography>
          </Box>

          {actionable && (
            <Stack spacing={1.5}>
              <TextField
                required
                label="ชื่อผู้ลงนาม"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
              />
              <TextField
                label="ตำแหน่ง"
                value={signerPosition}
                onChange={(e) => setSignerPosition(e.target.value)}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={authorityConfirmed}
                    onChange={(e) => setAuthorityConfirmed(e.target.checked)}
                  />
                }
                label="ยืนยันว่าเป็นผู้มีอำนาจหรือได้รับมอบหมายจากโรงเรียน"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                  />
                }
                label="ยอมรับราคา เงื่อนไข และข้อตกลงการใช้บริการ"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={pdpaAccepted}
                    onChange={(e) => setPdpaAccepted(e.target.checked)}
                  />
                }
                label="ยอมรับนโยบายความเป็นส่วนตัว (PDPA)"
              />
              <Button
                size="large"
                variant="contained"
                loading={saving}
                startIcon={<RiShieldCheckLine />}
                onClick={accept}
              >
                {authenticated ? 'ยอมรับและไปชำระเงิน' : 'เข้าสู่ระบบเพื่อยอมรับข้อเสนอ'}
              </Button>
            </Stack>
          )}
          {canCheckout && deal.product && (
            <Button size="large" variant="contained" onClick={() => goToCheckout(deal.product!)}>
              ไปหน้าชำระเงิน
            </Button>
          )}
          {expired && <Alert severity="warning">ข้อเสนอนี้หมดอายุหรือถูกยกเลิกแล้ว</Alert>}
          {!actionable && !canCheckout && !expired && (
            <Alert severity="success">ข้อเสนอนี้ได้รับการยอมรับหรือดำเนินการแล้ว</Alert>
          )}
        </Stack>
      </Card>
    </Container>
  );
}
