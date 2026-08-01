'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Pagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import {
  RiCloseLine,
  RiTimerLine,
  RiBookOpenLine,
  RiSendPlaneLine,
  RiShoppingCart2Line,
} from 'src/components/remix-icon';

import { getProduct, formatPrice } from '../../shared/api';
import { useMarketplaceCart } from '../../cart/cart-context';
import { MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY } from '../line-feature';

type SettingsResult = {
  seller: { display_name: string };
  mode: 'byoa' | 'managed' | 'system';
  usage: {
    planLabel: string;
    quotaTotal: number | null;
    quotaUsed: number;
    startsAt: string;
    expiresAt: string | null;
    durationDays: number | null;
    quotaSource: 'line' | 'package';
    quotaError: string | null;
  } | null;
  settings: {
    lineUserId: string;
    isEnabled: boolean;
    notifyPaymentReceived: boolean;
    hasAccessToken: boolean;
  };
  lineConnection: {
    displayName: string | null;
    linkedAt: string | null;
    systemAvailable: boolean;
  };
  recentDeliveries: Array<{
    id: string;
    event_type: 'payment_received' | 'test';
    amount: number | null;
    status: 'sent' | 'failed';
    last_error: string | null;
    created_at: string;
  }>;
  deliveryPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type AccessResult = {
  allowed: boolean;
  entitled: boolean;
  mode: 'byoa' | 'managed' | 'system' | null;
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
  durationDays: number | null;
};

type LineInvitation = {
  code: string;
  expiresAt: string;
  addFriendUrl: string;
  lineChatUrl: string;
  qrCodeUrl: string;
};

const DELIVERY_PAGE_SIZE = 5;

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
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [buying, setBuying] = useState(false);
  const [invitation, setInvitation] = useState<LineInvitation | null>(null);
  const [error, setError] = useState('');
  const [subscriptionAccepted, setSubscriptionAccepted] = useState(false);
  const [success, setSuccess] = useState('');
  const [purchaseRequired, setPurchaseRequired] = useState(false);
  const [purchaseProductId, setPurchaseProductId] = useState<string | null>(null);
  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);
  const [purchaseOptions, setPurchaseOptions] = useState<PurchaseOption[]>([]);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const usesManagedLine = data?.mode === 'managed';
  const usage = data?.usage;
  const remainingDays = usage?.expiresAt
    ? Math.max(
        0,
        Math.ceil((new Date(usage.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
    : null;
  const quotaRemaining =
    usage?.quotaTotal !== null && usage?.quotaTotal !== undefined
      ? Math.max(0, usage.quotaTotal - usage.quotaUsed)
      : null;
  const quotaPercent =
    usage?.quotaTotal && usage.quotaTotal > 0
      ? Math.min(100, Math.round((usage.quotaUsed / usage.quotaTotal) * 100))
      : 0;

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
        await fetch(
          `/api/marketplace/seller/line-settings?deliveryPage=${deliveryPage}&deliveryLimit=${DELIVERY_PAGE_SIZE}`,
          { cache: 'no-store' }
        )
      )) as SettingsResult;
      if (
        result.deliveryPagination.totalPages > 0 &&
        deliveryPage > result.deliveryPagination.totalPages
      ) {
        setDeliveryPage(result.deliveryPagination.totalPages);
        return;
      }
      setData(result);
      setLineUserId(result.settings.lineUserId);
      setIsEnabled(result.settings.isEnabled);
      setNotifyPaymentReceived(result.settings.notifyPaymentReceived);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [deliveryPage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!invitation || data?.lineConnection.linkedAt) return undefined;
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [data?.lineConnection.linkedAt, invitation, load]);

  const createInvitation = async () => {
    setLinking(true);
    setError('');
    try {
      const result = (await readJson(
        await fetch('/api/marketplace/seller/line-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'invite' }),
        })
      )) as { invitation: LineInvitation };
      setInvitation(result.invitation);
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : 'สร้างรหัสผูก LINE ไม่สำเร็จ');
    } finally {
      setLinking(false);
    }
  };

  const unlinkLine = async () => {
    setUnlinking(true);
    setError('');
    try {
      await readJson(
        await fetch('/api/marketplace/seller/line-settings', {
          method: 'DELETE',
        })
      );
      setInvitation(null);
      setSuccess('ยกเลิกการผูก LINE แล้ว');
      await load();
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : 'ยกเลิกการผูก LINE ไม่สำเร็จ');
    } finally {
      setUnlinking(false);
    }
  };

  const buyNow = async (productId = purchaseProductId) => {
    if (!productId) return;
    if (!subscriptionAccepted) {
      setError('กรุณายอมรับนโยบายแพ็กเกจก่อนซื้อ');
      return;
    }
    setBuying(true);
    setError('');
    try {
      const { product } = await getProduct(productId);
      if (product.purchase_access?.canPurchase === false) {
        throw new Error(product.purchase_access.message ?? 'ไม่สามารถเลือกแพ็กเกจนี้ได้');
      }
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
          <DialogTitle sx={{ pr: 7 }}>
            ปลดล็อคฟีเจอร์ก่อนใช้งาน
            <IconButton
              aria-label="ปิดหน้าต่าง"
              onClick={() => router.push(paths.marketplace.seller)}
              sx={{
                top: 8,
                right: 8,
                position: 'absolute',
                color: 'text.secondary',
              }}
            >
              <RiCloseLine />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Typography color="text.secondary">
              LINE แจ้งเตือนยอดขายเป็นฟีเจอร์เสริมแบบซื้อขาด
              กรุณาซื้อและชำระเงินให้สำเร็จก่อนเริ่มตั้งค่า
            </Typography>

            <FormControlLabel
              sx={{
                mt: 2,
                mx: 0,
                p: 1.5,
                alignItems: 'flex-start',
                borderRadius: 1.5,
                bgcolor: 'background.neutral',
                width: '100%',
              }}
              control={
                <Checkbox
                  checked={subscriptionAccepted}
                  onChange={(event) => setSubscriptionAccepted(event.target.checked)}
                  sx={{ mt: -0.75 }}
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  ฉันยอมรับ{' '}
                  <Link
                    component={RouterLink}
                    href={paths.legal.subscriptionPolicy}
                    target="_blank"
                  >
                    นโยบายแพ็กเกจ การต่ออายุ และการยกเลิก
                  </Link>
                  <br />
                  <Typography component="span" variant="caption">
                    ติ๊กช่องนี้เพื่อเปิดปุ่มดำเนินการ
                  </Typography>
                </Typography>
              }
            />

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
                        durationDays: null,
                      },
                    ]
                  : []
              ).map((option) => {
                const isTrial = option.key === MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY;
                return (
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
                      {isTrial
                        ? 'ทดลองใช้งาน'
                        : option.quota
                          ? 'ใช้ LINE ของระบบ E-KRU'
                          : 'ใช้ LINE OA ของตัวเอง'}
                    </Typography>
                    <Typography variant="h5" color="primary.darker" sx={{ mt: 0.5 }}>
                      {formatPrice(option.price)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {option.description}
                      {isTrial
                        ? ` · ${option.durationDays ?? 7} วัน${
                            option.quota ? ` · ${option.quota} ข้อความ` : ''
                          }`
                        : option.quota
                          ? ` · ${option.quota} ข้อความ`
                          : ' · ซื้อขาด'}
                    </Typography>
                    <Button
                      fullWidth
                      variant="contained"
                      loading={buying}
                      disabled={!subscriptionAccepted}
                      startIcon={isTrial ? <RiTimerLine /> : <RiShoppingCart2Line />}
                      onClick={() => buyNow(option.productId)}
                      sx={{ mt: 1.5 }}
                    >
                      {isTrial ? 'เริ่มทดลองใช้' : 'ซื้อเลย'}
                    </Button>
                  </Box>
                );
              })}
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
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
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
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            color={data?.settings.isEnabled ? 'success' : 'default'}
            label={data?.settings.isEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
          />
          {!!data?.lineConnection.linkedAt && (
            <Button
              variant="contained"
              startIcon={<RiSendPlaneLine />}
              loading={testing}
              onClick={test}
            >
              ทดลองส่ง
            </Button>
          )}
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
          {!usesManagedLine && (
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
          )}

          <DeliveryHistoryCard
            deliveries={data?.recentDeliveries ?? []}
            pagination={data?.deliveryPagination}
            page={deliveryPage}
            onPageChange={setDeliveryPage}
          />
        </Stack>

        <Stack spacing={3}>
          <Card variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6">เปิด–ปิดการแจ้งเตือน</Typography>
            {usesManagedLine && !data?.lineConnection.linkedAt && (
              <Alert severity="info" sx={{ mt: 2 }}>
                แพ็กเกจนี้ไม่ต้องกรอก LINE User ID กรุณาผูกบัญชีผ่าน QR
                แล้วระบบจะเปิดแจ้งเตือนให้อัตโนมัติ
              </Alert>
            )}
            <Stack divider={<Divider flexItem />} sx={{ mt: 1.5 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isEnabled}
                    disabled={usesManagedLine && !data?.lineConnection.linkedAt}
                    onChange={(event) => setIsEnabled(event.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="subtitle2">เปิดใช้ LINE สำหรับร้านนี้</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {usesManagedLine && !data?.lineConnection.linkedAt
                        ? 'ระบบจะเปิดให้อัตโนมัติหลังผูก LINE ผ่าน QR สำเร็จ'
                        : 'ปิดได้ทุกเมื่อโดยไม่ลบข้อมูลการเชื่อมต่อที่บันทึกไว้'}
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
            <Stack direction="column" spacing={1.5} sx={{ mt: 3 }}>
              <Button
                fullWidth
                variant="contained"
                loading={saving}
                disabled={usesManagedLine && !data?.lineConnection.linkedAt}
                onClick={save}
              >
                บันทึกการตั้งค่า
              </Button>
              {!usesManagedLine && (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<RiSendPlaneLine />}
                  loading={testing}
                  disabled={!lineUserId || (!accessToken && !data?.settings.hasAccessToken)}
                  onClick={test}
                >
                  ส่งข้อความทดสอบ
                </Button>
              )}
            </Stack>
            {accessToken && (
              <Alert severity="info" sx={{ mt: 2 }}>
                เมื่อกดส่งข้อความทดสอบ ระบบจะบันทึก Token ใหม่นี้ให้อัตโนมัติ
              </Alert>
            )}
          </Card>

          {usage && (
            <Card variant="outlined" sx={{ p: 3 }}>
              <Typography variant="h6">โควต้าข้อความเดือนนี้</Typography>
              <Box
                sx={{
                  mt: 2,
                  gap: 2,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    ส่งไปแล้ว
                  </Typography>
                  <Typography variant="h3">{usage.quotaUsed.toLocaleString('th-TH')}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    ข้อความ
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    คงเหลือ
                  </Typography>
                  <Typography variant="h3" color="success.main">
                    {quotaRemaining === null ? 'ไม่จำกัด' : quotaRemaining.toLocaleString('th-TH')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ข้อความ
                  </Typography>
                </Box>
              </Box>

              {usage.quotaTotal !== null && (
                <>
                  <LinearProgress
                    variant="determinate"
                    value={quotaPercent}
                    color={
                      quotaPercent >= 90 ? 'error' : quotaPercent >= 70 ? 'warning' : 'primary'
                    }
                    sx={{ mt: 2.5, height: 8, borderRadius: 1 }}
                  />
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      ใช้แล้ว {quotaPercent}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      โควต้า {usage.quotaTotal.toLocaleString('th-TH')} ข้อความ
                    </Typography>
                  </Box>
                </>
              )}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1.5, display: 'block' }}
              >
                {usage.quotaSource === 'line'
                  ? 'จำนวนจาก LINE Messaging API และรวมข้อความที่ส่งผ่าน LINE Official Account Manager'
                  : 'นับเฉพาะข้อความแจ้งเตือนยอดขายที่ระบบส่งสำเร็จ'}
                {' · '}แพ็กเกจ {usage.planLabel}
                {usage.expiresAt
                  ? ` · เหลือ ${remainingDays ?? 0} วัน (หมดอายุ ${new Date(
                      usage.expiresAt
                    ).toLocaleDateString('th-TH', {
                      dateStyle: 'medium',
                      timeZone: 'Asia/Bangkok',
                    })})`
                  : ' · ไม่มีวันหมดอายุ'}
              </Typography>
              {!!usage.quotaError && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  โหลดโควต้าจาก LINE ไม่สำเร็จ: {usage.quotaError}
                </Alert>
              )}
            </Card>
          )}

          {usesManagedLine && (
            <Card variant="outlined" sx={{ p: 3 }}>
              <Typography variant="h6">LINE ผู้รับแจ้งเตือน</Typography>
              {data?.lineConnection.linkedAt ? (
                <>
                  <Alert severity="success" sx={{ my: 2 }}>
                    ผูกกับ {data.lineConnection.displayName || 'บัญชี LINE'} แล้ว
                  </Alert>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button color="error" loading={unlinking} onClick={unlinkLine}>
                      ยกเลิกการผูก
                    </Button>
                  </Stack>
                </>
              ) : (
                <>
                  <Alert
                    severity={data?.lineConnection.systemAvailable ? 'info' : 'warning'}
                    sx={{ mt: 2 }}
                  >
                    {data?.lineConnection.systemAvailable
                      ? 'สแกน QR แล้วส่งข้อความที่เตรียมไว้ เพื่อผูกบัญชี LINE รับแจ้งเตือน'
                      : 'ผู้ดูแลระบบยังตั้งค่า LINE OA ของระบบไม่ครบ'}
                  </Alert>
                  <Button
                    fullWidth
                    variant="contained"
                    loading={linking}
                    disabled={!data?.lineConnection.systemAvailable}
                    onClick={createInvitation}
                    sx={{ mt: 2 }}
                  >
                    สร้างรหัสผูก LINE
                  </Button>
                  {invitation && (
                    <Card sx={{ mt: 2, p: 2 }}>
                      <Typography variant="subtitle2" sx={{ textAlign: 'center' }}>
                        ขั้นตอนที่ 1: สแกน QR และเพิ่ม LINE OA เป็นเพื่อน
                      </Typography>
                      {!!invitation.qrCodeUrl && (
                        <Box
                          component="img"
                          src={invitation.qrCodeUrl}
                          alt="QR สำหรับผูกบัญชี LINE ผู้ขาย"
                          sx={{
                            width: '100%',
                            maxWidth: 240,
                            mx: 'auto',
                            my: 2,
                            p: 1,
                            display: 'block',
                            bgcolor: 'common.white',
                            borderRadius: 1.5,
                          }}
                        />
                      )}
                      <Typography variant="body2" sx={{ textAlign: 'center' }}>
                        ขั้นตอนที่ 2: ส่งข้อความ <strong>SELLER {invitation.code}</strong>
                      </Typography>
                      <Button
                        fullWidth
                        variant="contained"
                        href={invitation.lineChatUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ mt: 1.5 }}
                      >
                        เปิดแชตและส่งรหัส
                      </Button>
                    </Card>
                  )}
                </>
              )}
            </Card>
          )}
        </Stack>
      </Box>
    </Container>
  );
}

function DeliveryHistoryCard({
  deliveries,
  pagination,
  page,
  onPageChange,
}: {
  deliveries: SettingsResult['recentDeliveries'];
  pagination?: SettingsResult['deliveryPagination'];
  page: number;
  onPageChange: (page: number) => void;
}) {
  const total = pagination?.total ?? deliveries.length;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  const limit = pagination?.limit ?? DELIVERY_PAGE_SIZE;

  return (
    <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
      <Typography variant="h6">ประวัติการส่งข้อความ LINE ล่าสุด</Typography>
      <Alert severity="info" sx={{ mt: 2 }}>
        สถานะด้านล่างเป็นผลการส่งข้อความ LINE เท่านั้น
        รายการขายและการชำระเงินที่ยืนยันแล้วถือว่าสำเร็จตามปกติ
      </Alert>
      <Divider sx={{ my: 2 }} />
      <Stack divider={<Divider flexItem />}>
        {deliveries.length ? (
          deliveries.map((delivery) => (
            <Box key={delivery.id} sx={{ py: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography variant="subtitle2">
                  {delivery.event_type === 'test' ? 'ข้อความทดสอบ' : 'ผู้ซื้อชำระเงิน'}
                </Typography>
                <Chip
                  size="small"
                  color={delivery.status === 'sent' ? 'success' : 'error'}
                  label={delivery.status === 'sent' ? 'ส่ง LINE สำเร็จ' : 'ส่ง LINE ไม่สำเร็จ'}
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
                  สาเหตุที่ส่ง LINE ไม่สำเร็จ: {delivery.last_error}
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
      {total > 0 && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems="center"
          justifyContent="space-between"
          spacing={1.5}
          sx={{ pt: 2.5, mt: 1, borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Typography variant="caption" color="text.secondary">
            แสดง {(page - 1) * limit + 1}–{Math.min(page * limit, total)} จาก {total} รายการ
          </Typography>
          <Pagination
            size="small"
            page={Math.min(page, totalPages)}
            count={totalPages}
            color="primary"
            onChange={(_event, value) => onPageChange(value)}
          />
        </Stack>
      )}
    </Card>
  );
}
