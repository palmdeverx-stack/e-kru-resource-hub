'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

import {
  RiAddLine,
  RiSubtractLine,
  RiDeleteBinLine,
  RiArrowLeftLine,
  RiShoppingBag3Line,
} from 'src/components/remix-icon';

import { formatPrice } from '../../shared/api';
import { useMarketplaceCart } from '../cart-context';

export function MarketplaceCartView() {
  const { items, subtotal, removeItem, updateQuantity } = useMarketplaceCart();

  if (!items.length) {
    return (
      <Container maxWidth="sm" sx={{ py: 12, textAlign: 'center' }}>
        <Box
          sx={{
            width: 88,
            height: 88,
            mx: 'auto',
            display: 'grid',
            borderRadius: 3,
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: 'primary.lighter',
          }}
        >
          <RiShoppingBag3Line size={42} />
        </Box>
        <Typography variant="h3" sx={{ mt: 3 }}>
          ตะกร้ายังว่าง
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          เลือกสื่อที่เหมาะกับห้องเรียนแล้วกลับมาที่นี่
        </Typography>
        <Button component={RouterLink} href="/" variant="contained" startIcon={<RiArrowLeftLine />}>
          เลือกดูสินค้า
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
      <Typography component="h1" variant="h3">
        ตะกร้าของฉัน
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 4 }}>
        ตรวจสอบรายการก่อนดำเนินการชำระเงิน
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
        <Stack spacing={2} sx={{ flex: 1, width: 1 }}>
          {items.map(({ product, quantity }) => (
            <Card key={product.id} sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={2}>
                <Box
                  sx={{
                    width: 96,
                    height: 96,
                    flexShrink: 0,
                    display: 'grid',
                    borderRadius: 2,
                    placeItems: 'center',
                    bgcolor: 'primary.lighter',
                    backgroundImage: product.cover_url ? `url(${product.cover_url})` : undefined,
                    backgroundSize: 'cover',
                  }}
                >
                  {!product.cover_url && <RiShoppingBag3Line color="#1565F5" />}
                </Box>
                <Stack spacing={0.75} sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1">{product.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {product.seller?.display_name ?? 'ผู้ขาย eKru'} · {product.category}
                  </Typography>
                  <Typography variant="h6" color="primary.main">
                    {formatPrice(Number(product.price), product.currency)}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <IconButton
                      size="small"
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                    >
                      <RiSubtractLine />
                    </IconButton>
                    <Typography sx={{ minWidth: 28, textAlign: 'center' }}>{quantity}</Typography>
                    <IconButton
                      size="small"
                      onClick={() => updateQuantity(product.id, quantity + 1)}
                    >
                      <RiAddLine />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeItem(product.id)}
                      sx={{ ml: 'auto' }}
                    >
                      <RiDeleteBinLine />
                    </IconButton>
                  </Stack>
                </Stack>
              </Stack>
            </Card>
          ))}
        </Stack>

        <Card sx={{ p: 3, width: { xs: 1, md: 360 }, position: { md: 'sticky' }, top: 96 }}>
          <Typography variant="h5">สรุปคำสั่งซื้อ</Typography>
          <Stack spacing={2} sx={{ mt: 3 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">สินค้า</Typography>
              <Typography>{formatPrice(subtotal)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">ค่าจัดส่ง</Typography>
              <Typography color="success.main">ฟรี</Typography>
            </Stack>
            <Divider />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="h6">ยอดรวม</Typography>
              <Typography variant="h5" color="primary.main">
                {formatPrice(subtotal)}
              </Typography>
            </Stack>
            <Button
              size="large"
              variant="contained"
              component={RouterLink}
              href="/checkout"
              fullWidth
            >
              ดำเนินการชำระเงิน
            </Button>
            <Button component={RouterLink} href="/" color="inherit" fullWidth>
              เลือกสินค้าต่อ
            </Button>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
