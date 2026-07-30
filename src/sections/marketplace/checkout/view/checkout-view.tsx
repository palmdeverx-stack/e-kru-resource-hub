'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import { SplashScreen } from 'src/components/loading-screen';
import {
  RiQrCodeLine,
  RiSchoolLine,
  RiBankCardLine,
  RiShieldCheckLine,
  RiShoppingBag3Line,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { useMarketplaceCart } from '../../cart/cart-context';
import { getMarketplacePricing } from '../../shared/pricing';
import {
  createOrder,
  formatPrice,
  getLocalizedProduct,
  getEligibleLicenseSchools,
} from '../../shared/api';

export function MarketplaceCheckoutView({ dashboardMode = false }: { dashboardMode?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentLang } = useTranslate();
  const { user, authenticated, loading } = useAuthContext();
  const { items, subtotal, listSubtotal, discountTotal, clearCart } = useMarketplaceCart();
  const [paymentMethod, setPaymentMethod] = useState('');
  const [availableMethods, setAvailableMethods] = useState({
    promptpay: false,
    stripe: false,
  });
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [licenseSchoolId, setLicenseSchoolId] = useState('');
  const salesDealToken = searchParams.get('dealToken') ?? '';
  const isFree = subtotal === 0;
  const hasAvailablePaymentMethod = availableMethods.promptpay || availableMethods.stripe;
  const canCreateSchoolAfterPayment =
    user?.role === 'marketplace_user' && !schoolsLoading && !schools.length;
  const hasIndividualLicense = items.some(
    (item) =>
      item.product.resource_type === 'feature_unlock' && item.product.license_scope === 'individual'
  );
  const hasSchoolLicense = items.some(
    (item) =>
      item.product.resource_type === 'feature_unlock' && item.product.license_scope !== 'individual'
  );
  const productsHref = dashboardMode
    ? paths.marketplace.dashboardProducts
    : paths.marketplace.products;
  const successHref = dashboardMode
    ? paths.marketplace.dashboardCheckoutSuccess
    : '/checkout/success';

  useEffect(() => {
    if (!dashboardMode && !loading && authenticated) {
      router.replace(paths.marketplace.dashboardCheckout);
    }
  }, [authenticated, dashboardMode, loading, router]);

  useEffect(() => {
    fetch('/api/marketplace/payment-methods')
      .then((response) => response.json())
      .then((result) => {
        const methods = result.paymentMethods ?? { promptpay: false, stripe: false };
        setAvailableMethods(methods);
        setPaymentMethod(methods.promptpay ? 'promptpay' : methods.stripe ? 'stripe' : '');
      })
      .catch(() => {
        setAvailableMethods({ promptpay: false, stripe: false });
        setPaymentMethod('');
      })
      .finally(() => setPaymentMethodsLoading(false));
  }, []);

  useEffect(() => {
    if (!authenticated || !hasSchoolLicense || salesDealToken) return;
    setSchoolsLoading(true);
    getEligibleLicenseSchools()
      .then(({ schools: result }) => {
        setSchools(result);
        if (result.length === 1) setLicenseSchoolId(result[0].id);
      })
      .catch((schoolError) =>
        setError(schoolError instanceof Error ? schoolError.message : 'โหลดโรงเรียนไม่สำเร็จ')
      )
      .finally(() => setSchoolsLoading(false));
  }, [authenticated, hasSchoolLicense, salesDealToken]);

  const submitOrder = async () => {
    setSubmitting(true);
    setError('');
    try {
      const isDemoCart = items.some((item) => item.product.id.startsWith('sample-'));
      if (isDemoCart) {
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        clearCart();
        router.push(`${successHref}?demo=1`);
        return;
      }
      const result = await createOrder(
        items.map((item) => ({ productId: item.product.id })),
        isFree ? 'promptpay' : paymentMethod,
        hasSchoolLicense ? licenseSchoolId : undefined,
        salesDealToken || undefined
      );
      clearCart();
      if (result.paymentSession.payment_method === 'free') {
        router.push(`${successHref}?orders=${result.orders.map((order) => order.id).join(',')}`);
      } else if (
        result.paymentSession.payment_method === 'stripe' &&
        result.paymentSession.stripe_checkout_url
      ) {
        window.location.assign(result.paymentSession.stripe_checkout_url);
      } else {
        router.push(
          dashboardMode
            ? paths.marketplace.dashboardPayment(result.paymentSession.id)
            : paths.marketplace.payment(result.paymentSession.id)
        );
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ไม่สามารถสร้างคำสั่งซื้อได้');
    } finally {
      setSubmitting(false);
    }
  };

  if (!dashboardMode && (loading || authenticated)) {
    return <SplashScreen portal={false} />;
  }

  if (!items.length) {
    return (
      <Container maxWidth="sm" sx={{ py: 12, textAlign: 'center' }}>
        <RiShoppingBag3Line size={52} />
        <Typography variant="h4" sx={{ mt: 2 }}>
          ไม่มีสินค้าสำหรับ Checkout
        </Typography>
        <Button component={RouterLink} href={productsHref} variant="contained" sx={{ mt: 3 }}>
          กลับไป Marketplace
        </Button>
      </Container>
    );
  }

  if (!loading && !authenticated) {
    return (
      <Container maxWidth="sm" sx={{ py: 10 }}>
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <RiShieldCheckLine size={52} color="#1565F5" />
          <Typography variant="h4" sx={{ mt: 2 }}>
            เข้าสู่ระบบก่อนชำระเงิน
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            ใช้บัญชี E-KRU เดิม หรือสมัครบัญชี Marketplace ใหม่ได้ ตะกร้าของคุณจะยังอยู่
          </Typography>
          <Button
            component={RouterLink}
            href={`${paths.auth.jwt.signIn}?returnTo=${encodeURIComponent(
              paths.marketplace.dashboardCheckout
            )}`}
            variant="contained"
            fullWidth
          >
            เข้าสู่ระบบ
          </Button>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: { xs: 4 } }}>
      <Typography component="h1" variant="h3">
        ชำระเงิน
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 4 }}>
        เลือกวิธีชำระเงินและยืนยันคำสั่งซื้อ
      </Typography>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
        <Stack spacing={3} sx={{ flex: 1, width: 1 }}>
          {hasIndividualLicense && (
            <Alert severity="success" icon={<RiShieldCheckLine />}>
              License แบบบุคคลจะผูกกับบัญชีนี้โดยตรง ไม่ต้องเลือกโรงเรียน
            </Alert>
          )}

          {hasSchoolLicense && salesDealToken && (
            <Alert severity="success" icon={<RiShieldCheckLine />}>
              โรงเรียนปลายทางและราคาถูกกำหนดจากข้อเสนอขายที่ลงนามแล้ว
            </Alert>
          )}

          {hasSchoolLicense && !salesDealToken && (
            <Card sx={{ p: 3 }}>
              <Typography variant="h5">โรงเรียนที่จะรับ License</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                เลือกโรงเรียนที่คุณเป็นผู้ดูแล ระบบจะออกสิทธิ์ให้โรงเรียนนี้หลังชำระเงินสำเร็จ
              </Typography>
              {schoolsLoading ? (
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ py: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    กำลังโหลดโรงเรียนที่บัญชีนี้มีสิทธิ์...
                  </Typography>
                </Stack>
              ) : schools.length ? (
                <TextField
                  fullWidth
                  required
                  select
                  label="โรงเรียนปลายทาง"
                  value={licenseSchoolId}
                  onChange={(event) => setLicenseSchoolId(event.target.value)}
                >
                  <MenuItem value="">เลือกโรงเรียน</MenuItem>
                  {schools.map((school) => (
                    <MenuItem key={school.id} value={school.id}>
                      {school.name}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <Alert
                  severity={user?.role === 'marketplace_user' ? 'info' : 'warning'}
                  icon={<RiSchoolLine />}
                  sx={{ mt: 2 }}
                >
                  <Typography variant="subtitle2">
                    {user?.role === 'marketplace_user'
                      ? 'สร้างโรงเรียนหลังชำระเงิน'
                      : 'บัญชีนี้ยังไม่มีโรงเรียนให้รับ License'}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {user?.role === 'master_admin'
                      ? 'ยังไม่มีโรงเรียนที่เปิดใช้งานในระบบ กรุณาสร้างหรือเปิดใช้งานโรงเรียนก่อน'
                      : user?.role === 'marketplace_user'
                        ? 'ชำระเงินต่อได้ ระบบจะส่งลิงก์สร้างโรงเรียนไปยังอีเมลของบัญชีนี้ และเริ่มนับอายุ License หลังสร้างโรงเรียนสำเร็จ'
                        : user?.role === 'school_admin'
                          ? 'บัญชีผู้ดูแลนี้ยังไม่ได้เชื่อมกับโรงเรียน กรุณาติดต่อ Super Admin'
                          : 'License โรงเรียนต้องซื้อด้วยบัญชีผู้ดูแลโรงเรียน กรุณาเข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์'}
                  </Typography>
                  {user?.role === 'master_admin' && (
                    <Button
                      size="small"
                      color="warning"
                      variant="outlined"
                      component={RouterLink}
                      href={paths.master.school.root}
                      startIcon={<RiSchoolLine />}
                      sx={{ mt: 1.5 }}
                    >
                      จัดการโรงเรียน
                    </Button>
                  )}
                </Alert>
              )}
            </Card>
          )}

          {!isFree && hasAvailablePaymentMethod && (
            <Card sx={{ p: 3 }}>
              <Typography variant="h5">วิธีชำระเงิน</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                เลือกช่องทางที่สะดวก ระบบจะแสดงเฉพาะช่องทางที่เปิดใช้งาน
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                {availableMethods.promptpay && (
                  <PaymentOption
                    selected={paymentMethod === 'promptpay'}
                    icon={<RiQrCodeLine size={28} />}
                    title="QR PromptPay — แนบสลิป"
                    description="สแกน QR โอนเงิน จากนั้นอัปโหลดสลิปและรอผู้ดูแลยืนยัน"
                    statusLabel="ตรวจสอบโดยผู้ดูแล"
                    statusColor="warning"
                    onClick={() => setPaymentMethod('promptpay')}
                  />
                )}
                {availableMethods.stripe && (
                  <PaymentOption
                    selected={paymentMethod === 'stripe'}
                    icon={<RiBankCardLine size={28} />}
                    title="ชำระเงินผ่าน Stripe"
                    description="บัตรเครดิต/เดบิต และ PromptPay เมื่อบัญชีและรายการเข้าเงื่อนไข"
                    statusLabel="ยืนยันอัตโนมัติ"
                    statusColor="success"
                    onClick={() => setPaymentMethod('stripe')}
                  />
                )}
              </Stack>
            </Card>
          )}

          {!isFree && paymentMethodsLoading && (
            <Card sx={{ p: 3 }}>
              <Typography variant="h5">วิธีชำระเงิน</Typography>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  กำลังตรวจสอบช่องทางที่เปิดใช้งาน...
                </Typography>
              </Stack>
            </Card>
          )}

          {!isFree && !paymentMethodsLoading && !hasAvailablePaymentMethod && (
            <Alert severity="warning">
              ขณะนี้ยังไม่มีช่องทางชำระเงินที่เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ
            </Alert>
          )}

          {!isFree && availableMethods.promptpay && availableMethods.stripe && (
            <Alert severity="info" icon={<RiShieldCheckLine />}>
              PromptPay แบบแนบสลิปต้องรอผู้ดูแลตรวจ ส่วน Stripe ยืนยันผลชำระผ่าน webhook อัตโนมัติ
            </Alert>
          )}
          {!isFree && availableMethods.promptpay && !availableMethods.stripe && (
            <Alert severity="info" icon={<RiShieldCheckLine />}>
              QR PromptPay แบบแนบสลิปจะผ่านการตรวจจากผู้ดูแล
            </Alert>
          )}
          {!isFree && availableMethods.stripe && !availableMethods.promptpay && (
            <Alert severity="info" icon={<RiShieldCheckLine />}>
              Stripe จะยืนยันยอดชำระผ่าน webhook อัตโนมัติ
            </Alert>
          )}
        </Stack>

        <Card sx={{ p: 3, width: { xs: 1, md: 380 } }}>
          <Typography variant="h5">รายการสั่งซื้อ</Typography>
          <Stack divider={<Divider flexItem />} sx={{ my: 2 }}>
            {items.map((item) => {
              const pricing = getMarketplacePricing(item.product);
              return (
                <Stack
                  key={item.product.id}
                  direction="row"
                  justifyContent="space-between"
                  sx={{ py: 1.5 }}
                >
                  <Box sx={{ pr: 2 }}>
                    <Typography variant="body2">
                      {getLocalizedProduct(item.product, currentLang.value).title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      1 สิทธิ์
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="subtitle2">{formatPrice(pricing.salePrice)}</Typography>
                    {pricing.hasDiscount && (
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ textDecoration: 'line-through' }}
                      >
                        {formatPrice(pricing.listPrice)}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              );
            })}
          </Stack>
          <Divider />
          {discountTotal > 0 && (
            <Stack spacing={1} sx={{ mt: 2 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">ราคาเต็ม</Typography>
                <Typography>{formatPrice(listSubtotal)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="success.main">ส่วนลด</Typography>
                <Typography color="success.main">-{formatPrice(discountTotal)}</Typography>
              </Stack>
            </Stack>
          )}
          <Stack direction="row" justifyContent="space-between" sx={{ my: 2.5 }}>
            <Typography variant="h6">ยอดชำระ</Typography>
            <Typography variant="h5" color="primary.main">
              {formatPrice(subtotal)}
            </Typography>
          </Stack>
          <Button
            fullWidth
            size="large"
            variant="contained"
            loading={submitting}
            disabled={
              (!isFree && paymentMethodsLoading) ||
              (!isFree &&
                (!paymentMethod ||
                  !availableMethods[paymentMethod as keyof typeof availableMethods])) ||
              (hasSchoolLicense &&
                !salesDealToken &&
                !licenseSchoolId &&
                !canCreateSchoolAfterPayment)
            }
            onClick={submitOrder}
          >
            {isFree
              ? 'ยืนยันรับสินค้า'
              : paymentMethod === 'stripe'
                ? 'ชำระเงินผ่าน Stripe'
                : 'สร้าง QR PromptPay'}
          </Button>
        </Card>
      </Stack>
    </Container>
  );
}

function PaymentOption({
  icon,
  title,
  selected,
  disabled,
  onClick,
  description,
  statusLabel,
  statusColor,
}: {
  icon: React.ReactNode;
  title: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  description: string;
  statusLabel: string;
  statusColor: 'success' | 'warning';
}) {
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      onClick={disabled ? undefined : onClick}
      sx={{
        p: 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'primary.lighter' : 'transparent',
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          display: 'grid',
          flexShrink: 0,
          borderRadius: 1.5,
          placeItems: 'center',
          color: selected ? 'primary.main' : 'text.secondary',
          bgcolor: selected ? 'primary.lighter' : 'background.neutral',
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flexGrow: 1 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={0.75}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Typography variant="subtitle1">{title}</Typography>
          <Chip size="small" variant="soft" color={statusColor} label={statusLabel} />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
      <Radio checked={selected} disabled={disabled} />
    </Stack>
  );
}
