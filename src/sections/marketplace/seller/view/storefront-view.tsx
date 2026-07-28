'use client';

import type { MarketplaceSeller, MarketplaceProduct } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { MarketplaceProductCard } from '../../shared/product-card';

export function MarketplaceStorefrontView({ slug }: { slug: string }) {
  const [seller, setSeller] = useState<MarketplaceSeller | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/marketplace/stores/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setSeller(result.seller);
        setProducts(result.products);
      })
      .catch((loadError) => setError(loadError.message));
  }, [slug]);

  if (error)
    return (
      <Container maxWidth="md" sx={{ py: 10 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  if (!seller)
    return (
      <Box sx={{ minHeight: 500, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );

  return (
    <>
      <Box
        sx={{
          height: { xs: 180, md: 280 },
          bgcolor: 'primary.lighter',
          backgroundImage: seller.cover_url ? `url(${seller.cover_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center', mb: 5 }}>
          <Box
            component="img"
            src={seller.logo_url || '/logo/logo-single.svg'}
            alt={seller.display_name}
            sx={{
              width: 96,
              height: 96,
              objectFit: 'cover',
              borderRadius: 3,
              border: '4px solid white',
              boxShadow: 3,
            }}
          />
          <div>
            <Typography component="h1" variant="h3">
              {seller.display_name}
            </Typography>
            {seller.display_name_en && (
              <Typography color="text.secondary">{seller.display_name_en}</Typography>
            )}
            <Typography sx={{ mt: 1 }}>{seller.bio}</Typography>
          </div>
        </Box>
        <Typography variant="h4" sx={{ mb: 3 }}>
          สินค้าจากร้านนี้
        </Typography>
        {products.length ? (
          <Grid container spacing={3}>
            {products.map((product, index) => (
              <Grid key={product.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <MarketplaceProductCard product={product} colorIndex={index} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Card sx={{ py: 8, textAlign: 'center' }}>
            <Typography color="text.secondary">ร้านนี้ยังไม่มีสินค้าที่เผยแพร่</Typography>
          </Card>
        )}
      </Container>
    </>
  );
}
