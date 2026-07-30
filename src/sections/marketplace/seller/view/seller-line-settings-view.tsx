'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { RiBookOpenLine, RiSendPlaneLine, RiShoppingCart2Line } from 'src/components/remix-icon';

import { getProduct, formatPrice } from '../../shared/api';
import { useMarketplaceCart } from '../../cart/cart-context';

type SettingsResult = {
  seller: { display_name: string };
  settings: {
    lineUserId: string;
    isEnabled: boolean;
    notifyPaymentReceived: boolean;
    hasAccessToken: boolean;
  };
  recentDeliveries: Array<{
    id: string;
    event_type: 'payment_received' | 'test';
    amount: number | null;
    status: 'sent' | 'failed';
    last_error: string | null;
    created_at: string;
  }>;
};

type AccessResult = {
  allowed: boolean;
  entitled: boolean;
  purchaseProductId: string | null;
  purchasePrice: number | null;
  purchaseOptions: PurchaseOption[];
};

type PurchaseOption = {
  key: string;
  productId: string;
  price: number;
  description: string;
  quota: number | null;
};

async function readJson(response: Response) {
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.message ?? 'ระบบไม่สามารถดำเนินการได้');
  }
  return result;
}

export function MarketplaceSellerLineSettingsView() {
  const router = useRouter();
  const { addItem } = useMarketplaceCart();
  const [data, setData] = useState<SettingsResult | null>(null);
  const [lineUserId, setLineUserId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [notifyPaymentReceived, setNotifyPaymentReceived] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [purchaseRequired, setPurchaseRequired] = useState(false);
  const [purchaseProductId, setPurchaseProductId] = useState<string | null>(null);
  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);
  const [purchaseOptions, setPurchaseOptions] = useState<PurchaseOption[]>([]);

  const load = useCallback(async () => {
    setError('');
    try {
      const access = (await readJson(
        await fetch('/api/marketplace/seller/line-settings?access=1', { cache: 'no-store' })
      )) as AccessResult;
      if (!access.allowed) {
        throw new Error('Super Admin ยังไม่อนุญาตให้ใช้ LINE แจ้งเตือนร้านค้า');
      }
      if (!access.entitled) {
        setPurchaseProductId(access.purchaseProductId);
        setPurchasePrice(access.purchasePrice);
        setPurchaseOptions(access.purchaseOptions ?? []);
        setPurchaseRequired(true);
        return;
      }
      setPurchaseRequired(false);
      setPurchaseProductId(null);

      const result = (await readJson(
        await fetch('/api/marketplace/seller/line-settings', { cache: 'no-store' })
      )) as SettingsResult;
      setData(result);
      setLineUserId(result.settings.lineUserId);
      setIsEnabled(result.settings.isEnabled);
      setNotifyPaymentReceived(result.settings.notifyPaymentReceived);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buyNow = async (productId = purchaseProductId) => {
    if (!productId) return;
    setBuying(true);
    setError('');
    try {
      const { product } = await getProduct(productId);
      addItem(product);
      router.push(paths.marketplace.dashboardCheckout);
    } catch (buyError) {
      setError(buyError instanceof Error ? buyError.message : 'ไม่สามารถเริ่มการซื้อได้');
      setBuying(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await readJson(
        await fetch('/api/marketplace/seller/line-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineUserId,
            accessToken,
            isEnabled,
            notifyPaymentReceived,
          }),
        })
      );
      setAccessToken('');
      setSuccess(isEnabled ? 'บันทึกและเปิด LINE แจ้งเตือนแล้ว' : 'บันทึกการตั้งค่าแล้ว');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setError('');
    setSuccess('');
    try {
      await readJson(
        await fetch('/api/marketplace/seller/line-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'test' }),
        })
      );
      setSuccess('ส่งข้อความทดสอบไปที่ LINE ของคุณแล้ว');
      await load();
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'ส่งข้อความทดสอบไม่สำเร็จ');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (purchaseRequired) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
        <Dialog open disableEscapeKeyDown maxWidth="xs" fullWidth>
          <DialogTitle>ซื้อฟีเจอร์ก่อนใช้งาน</DialogTitle>
          <DialogContent>
            <Typography color="text.secondary">
              LINE แจ้งเตือนยอดขายเป็นฟีเจอร์เสริมแบบซื้อขาด
              กรุณาซื้อและชำระเงินให้สำเร็จก่อนเริ่มตั้งค่า
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              {(purchaseOptions.length
                ? purchaseOptions
                : purchaseProductId && purchasePrice !== null
                  ? [
                      {
                        key: 'byoa',
                        productId: purchaseProductId,
                        price: purchasePrice,
                        description: 'ใช้ LINE OA ของตัวเอง',
                        quota: null,
                      },
                    ]
                  : []
              ).map((option) => (
                <Box
                  key={option.productId}
                  sx={{
                    p: 2,
                    borderRadius: 1.5,
                    bgcolor: 'primary.lighter',
                    border: '1px solid',
                    borderColor: 'primary.light',
                  }}
                >
                  <Typography variant="subtitle1">
                    {option.quota ? 'ใช้ LINE ของระบบ E-KRU' : 'ใช้ LINE OA ของตัวเอง'}
                  </Typography>
                  <Typography variant="h5" color="primary.darker" sx={{ mt: 0.5 }}>
                    {formatPrice(option.price)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {option.description}
                    {option.quota ? ` · ${option.quota} ข้อความ` : ' · ซื้อขาด'}
                  </Typography>
                  <Button
                    fullWidth
                    variant="contained"
                    loading={buying}
                    startIcon={<RiShoppingCart2Line />}
                    onClick={() => buyNow(option.productId)}
                    sx={{ mt: 1.5 }}
                  >
                    ซื้อเลย
                  </Button>
                </Box>
              ))}
            </Stack>
            {!!error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
            {!purchaseProductId && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                ยังไม่มีสินค้าสำหรับฟีเจอร์นี้ กรุณาติดต่อผู้ดูแลระบบ
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ gap: 2 }}>
            <Button component={RouterLink} href={paths.marketplace.seller} color="inherit">
              กลับร้านค้าของฉัน
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: { xs: 4, md: 6 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 4 }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            LINE แจ้งเตือนร้านค้า
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            รับข้อความเมื่อระบบยืนยันเงินจากผู้ซื้อของร้าน {data?.seller.display_name}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            color={data?.settings.isEnabled ? 'success' : 'default'}
            label={data?.settings.isEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
          />
          <Button
            component={RouterLink}
            href={paths.marketplace.sellerLineGuide}
            variant="outlined"
            startIcon={<RiBookOpenLine />}
          >
            วิธีเอาข้อมูล LINE
          </Button>
        </Stack>
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {!!success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' },
        }}
      >
        <Stack spacing={3}>
          <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h6">ข้อมูลเชื่อมต่อของร้าน</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
              ใช้ Credentials ของ LINE Official Account ที่ผู้ขายสร้างเอง Token
              จะถูกเข้ารหัสและไม่แสดงกลับบนหน้าจอ
            </Typography>
            <Stack spacing={2.5}>
              <TextField
                required
                label="LINE User ID"
                placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={lineUserId}
                onChange={(event) => setLineUserId(event.target.value.trim())}
                helperText="Your user ID จากแท็บ Basic settings ไม่ใช่ LINE ID หรือ @Basic ID"
              />
              <TextField
                required={!data?.settings.hasAccessToken}
                type="password"
                label="Channel access token"
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
                placeholder={
                  data?.settings.hasAccessToken
                    ? 'บันทึกไว้แล้ว — กรอกเฉพาะเมื่อต้องการเปลี่ยน'
                    : 'วาง Long-lived channel access token'
                }
                helperText={
                  data?.settings.hasAccessToken
                    ? 'ระบบเก็บ Token เดิมไว้แบบเข้ารหัส'
                    : 'ออก Token จากแท็บ Messaging API ใน LINE Developers Console'
                }
              />
            </Stack>
          </Card>

          <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h6">เปิด–ปิดการแจ้งเตือน</Typography>
            <Stack divider={<Divider flexItem />} sx={{ mt: 1.5 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isEnabled}
                    onChange={(event) => setIsEnabled(event.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="subtitle2">เปิดใช้ LINE สำหรับร้านนี้</Typography>
                    <Typography variant="caption" color="text.secondary">
                      ปิดได้ทุกเมื่อโดยไม่ลบ Token ที่บันทึกไว้
                    </Typography>
                  </Box>
                }
                sx={{ py: 1, mx: 0, justifyContent: 'space-between' }}
                labelPlacement="start"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={notifyPaymentReceived}
                    onChange={(event) => setNotifyPaymentReceived(event.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="subtitle2">แจ้งเมื่อผู้ซื้อชำระเงินแล้ว</Typography>
                    <Typography variant="caption" color="text.secondary">
                      ส่งหลังระบบยืนยันการชำระออนไลน์ หรือผู้ดูแลอนุมัติสลิปแล้วเท่านั้น
                    </Typography>
                  </Box>
                }
                sx={{ py: 1, mx: 0, justifyContent: 'space-between' }}
                labelPlacement="start"
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
              <Button variant="contained" loading={saving} onClick={save}>
                บันทึกการตั้งค่า
              </Button>
              <Button
                variant="outlined"
                startIcon={<RiSendPlaneLine />}
                loading={testing}
                disabled={!data?.settings.hasAccessToken || !data.settings.lineUserId}
                onClick={test}
              >
                ส่งข้อความทดสอบ
              </Button>
            </Stack>
            {accessToken && (
              <Alert severity="info" sx={{ mt: 2 }}>
                กดบันทึกก่อน แล้วจึงส่งข้อความทดสอบด้วย Token ใหม่
              </Alert>
            )}
          </Card>
        </Stack>

        <Card variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6">ประวัติการส่งล่าสุด</Typography>
          <Divider sx={{ my: 2 }} />
          <Stack divider={<Divider flexItem />}>
            {data?.recentDeliveries.length ? (
              data.recentDeliveries.map((delivery) => (
                <Box key={delivery.id} sx={{ py: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="subtitle2">
                      {delivery.event_type === 'test' ? 'ข้อความทดสอบ' : 'ผู้ซื้อชำระเงิน'}
                    </Typography>
                    <Chip
                      size="small"
                      color={delivery.status === 'sent' ? 'success' : 'error'}
                      label={delivery.status === 'sent' ? 'ส่งสำเร็จ' : 'ส่งไม่สำเร็จ'}
                    />
                  </Stack>
                  {delivery.amount !== null && (
                    <Typography variant="body2">{formatPrice(Number(delivery.amount))}</Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {new Date(delivery.created_at).toLocaleString('th-TH', {
                      timeZone: 'Asia/Bangkok',
                    })}
                  </Typography>
                  {!!delivery.last_error && (
                    <Typography variant="caption" color="error" display="block">
                      {delivery.last_error}
                    </Typography>
                  )}
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                ยังไม่มีประวัติการส่ง
              </Typography>
            )}
          </Stack>
        </Card>
      </Box>
    </Container>
  );
}
