"use client";

import type { MarketplaceProduct } from './types';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

import { RiAddLine, RiBookOpenLine } from 'src/components/remix-icon';

import { formatPrice } from './api';
import { useMarketplaceCart } from '../cart/cart-context';

export function MarketplaceProductCard({
  product,
  colorIndex = 0,
}: {
  product: MarketplaceProduct;
  colorIndex?: number;
}) {
  const { addItem } = useMarketplaceCart();
  const colors = ['#E8F8EF', '#FFF4DE', '#E9F2FF', '#F4ECFF'];

  return (
    <Card
      sx={{
        height: 1,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        transition: 'transform 180ms ease, box-shadow 180ms ease',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: 8 },
      }}
    >
      <Box
        component={RouterLink}
        href={`/product/${product.id}`}
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
        {!product.cover_url && <RiBookOpenLine size={64} color="#1565F5" />}
      </Box>
      <Stack spacing={1.5} sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Chip size="small" label={product.category} />
          <Typography variant="h5" color="primary.main">
            {formatPrice(Number(product.price), product.currency)}
          </Typography>
        </Stack>
        <Typography
          variant="h6"
          component={RouterLink}
          href={`/product/${product.id}`}
          color="text.primary"
          sx={{ textDecoration: 'none' }}
        >
          {product.title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            minHeight: 44,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {product.description}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          โดย {product.seller?.display_name ?? 'ผู้ขาย eKru'}
        </Typography>
        <Button variant="outlined" startIcon={<RiAddLine />} onClick={() => addItem(product)}>
          เพิ่มลงตะกร้า
        </Button>
      </Stack>
    </Card>
  );
}
