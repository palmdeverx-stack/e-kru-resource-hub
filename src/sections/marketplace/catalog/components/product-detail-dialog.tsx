'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';

import { useTranslate } from 'src/locales';

import { RiCloseLine } from 'src/components/remix-icon';

import { MarketplaceProductDetailView } from '../view/product-detail-view';

export function MarketplaceProductDetailDialog({
  product,
  onClose,
}: {
  product: MarketplaceProduct | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslate('marketplace');
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeProduct, setActiveProduct] = useState<MarketplaceProduct | null>(product);

  useEffect(() => {
    setActiveProduct(product);
  }, [product]);

  const handleSelectProduct = (nextProduct: MarketplaceProduct) => {
    setActiveProduct(nextProduct);
    window.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  return (
    <Dialog
      open={Boolean(product)}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth={false}
      aria-label={
        activeProduct
          ? t('catalog.productDialog.titleWithProduct', { title: activeProduct.title })
          : t('catalog.productDialog.title')
      }
      sx={{
        overscrollBehavior: 'none',
        '& .MuiDialog-container': { overflow: 'hidden' },
      }}
      slotProps={{
        paper: {
          sx: {
            m: { xs: 0, sm: 3 },
            width: { xs: '100vw', sm: 'calc(100% - 48px)' },
            height: { xs: '100dvh', sm: 'calc(100% - 48px)' },
            maxWidth: 'none',
            maxHeight: 'none',
            borderRadius: { xs: 0, sm: 3 },
            position: 'relative',
            overflow: 'hidden',
            overscrollBehavior: 'none',
            bgcolor: 'background.paper',
          },
        },
        backdrop: {
          sx: {
            bgcolor: 'rgba(15, 23, 42, 0.78)',
            backdropFilter: 'blur(3px)',
          },
        },
      }}
    >
      <IconButton
        aria-label={t('catalog.productDialog.close')}
        onClick={onClose}
        sx={{
          top: { xs: 'max(12px, env(safe-area-inset-top))', sm: 18 },
          right: { xs: 12, sm: 20 },
          zIndex: 5,
          position: 'absolute',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 2,
          '&:hover': { bgcolor: 'background.neutral' },
        }}
      >
        <RiCloseLine />
      </IconButton>

      <Box
        ref={scrollRef}
        sx={{
          width: 1,
          height: 1,
          minWidth: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          bgcolor: 'background.paper',
        }}
      >
        {activeProduct && (
          <MarketplaceProductDetailView
            modalMode
            productId={activeProduct.id}
            onSelectProduct={handleSelectProduct}
          />
        )}
      </Box>
    </Dialog>
  );
}
