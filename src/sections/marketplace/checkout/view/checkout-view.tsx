'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import {
  RiQrCodeLine,
  RiBankCardLine,
  RiShieldCheckLine,
  RiShoppingBag3Line,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { createOrder, formatPrice } from '../../shared/api';
import { useMarketplaceCart } from '../../cart/cart-context';

export function MarketplaceCheckoutView() {
  const router = useRouter();
  const { authenticated, loading } = useAuthContext();
  const { items, subtotal, clearCart } = useMarketplaceCart();
  const [paymentMethod, setPaymentMethod] = useState('promptpay');
  const [availableMethods, setAvailableMethods] = useState({
    promptpay: true,
    stripe: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/marketplace/payment-methods')
      .then((response) => response.json())
      .then((result) => {
        const methods = result.paymentMethods ?? { promptpay: false, stripe: false };
        setAvailableMethods(methods);
        if (!methods.promptpay && methods.stripe) setPaymentMethod('stripe');
      })
      .catch(() => undefined);
  }, []);

  const submitOrder = async () => {
    setSubmitting(true);
    setError('');
    try {
      const isDemoCart = items.some((item) => item.product.id.startsWith('sample-'));
      if (isDemoCart) {
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        clearCart();
        router.push('/checkout/success?demo=1');
        return;
      }
      const result = await createOrder(
        items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        paymentMethod
      );
      clearCart();
      if (result.paymentSession.payment_method === 'free') {
        router.push(`/checkout/success?orders=${result.orders.map((order) => order.id).join(',')}`);
      } else if (
        result.paymentSession.payment_method === 'stripe' &&
        result.paymentSession.stripe_checkout_url
      ) {
        window.location.assign(result.paymentSession.stripe_checkout_url);
      } else {
        router.push(paths.marketplace.payment(result.paymentSession.id));
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ไม่สามารถสร้างคำสั่งซื้อได้');
    } finally {
      setSubmitting(false);
    }
  };

  if (!items.length) {
    return (
      <Container maxWidth="sm" sx={{ py: 12, textAlign: 'center' }}>
        <RiShoppingBag3Line size={52} />
        <Typography variant="h4" sx={{ mt: 2 }}>
          ไม่มีสินค้าสำหรับ Checkout
        </Typography>
        <Button component={RouterLink} href="/" variant="contained" sx={{ mt: 3 }}>
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
            ใช้บัญชี eKru เดิม หรือสมัครบัญชี Marketplace ใหม่ได้ ตะกร้าของคุณจะยังอยู่
          </Typography>
          <Button
            component={RouterLink}
            href={`${paths.auth.jwt.signIn}?returnTo=/checkout`}
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
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
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
          <Card sx={{ p: 3 }}>
            <Typography variant="h5">วิธีชำระเงิน</Typography>
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              <PaymentOption
                selected={paymentMethod === 'promptpay'}
                icon={<RiQrCodeLine size={28} />}
                title="QR PromptPay"
                description={
                  availableMethods.promptpay
                    ? 'สแกน QR และแนบสลิปให้ผู้ดูแลตรวจสอบ'
                    : 'ยังไม่เปิดใช้งาน'
                }
                disabled={!availableMethods.promptpay}
                onClick={() => setPaymentMethod('promptpay')}
              />
              <PaymentOption
                selected={paymentMethod === 'stripe'}
                icon={<RiBankCardLine size={28} />}
                title="Stripe Checkout"
                description={
                  availableMethods.stripe
                    ? 'บัตรและช่องทางที่เปิดใช้ใน Stripe รวมถึง PromptPay'
                    : 'ยังไม่ได้เชื่อมต่อ Stripe'
                }
                disabled={!availableMethods.stripe}
                onClick={() => setPaymentMethod('stripe')}
              />
            </Stack>
          </Card>

          <Alert severity="info" icon={<RiShieldCheckLine />}>
            Stripe ยืนยันยอดผ่าน webhook อัตโนมัติ ส่วน PromptPay แบบแนบสลิปจะผ่านการตรวจจากผู้ดูแล
          </Alert>
        </Stack>

        <Card sx={{ p: 3, width: { xs: 1, md: 380 } }}>
          <Typography variant="h5">รายการสั่งซื้อ</Typography>
          <Stack divider={<Divider flexItem />} sx={{ my: 2 }}>
            {items.map((item) => (
              <Stack
                key={item.product.id}
                direction="row"
                justifyContent="space-between"
                sx={{ py: 1.5 }}
              >
                <Box sx={{ pr: 2 }}>
                  <Typography variant="body2">{item.product.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    จำนวน {item.quantity}
                  </Typography>
                </Box>
                <Typography variant="subtitle2">
                  {formatPrice(Number(item.product.price) * item.quantity)}
                </Typography>
              </Stack>
            ))}
          </Stack>
          <Divider />
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
            disabled={!availableMethods[paymentMethod as keyof typeof availableMethods]}
            onClick={submitOrder}
          >
            {paymentMethod === 'stripe' ? 'ไปยัง Stripe Checkout' : 'สร้าง QR ชำระเงิน'}
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
}: {
  icon: React.ReactNode;
  title: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  description: string;
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
      {icon}
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle1">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
      <Radio checked={selected} disabled={disabled} />
    </Stack>
  );
}
