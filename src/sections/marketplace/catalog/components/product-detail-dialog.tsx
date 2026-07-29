'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';

import { RiCloseLine } from 'src/components/remix-icon';

import { MarketplaceProductDetailView } from '../view/product-detail-view';

export function MarketplaceProductDetailDialog({
  product,
  onClose,
}: {
  product: MarketplaceProduct | null;
  onClose: () => void;
}) {
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
      fullWidth
      maxWidth={false}
      aria-label={activeProduct ? `รายละเอียดสินค้า ${activeProduct.title}` : 'รายละเอียดสินค้า'}
      sx={{
        overscrollBehavior: 'none',
        '& .MuiDialog-container': { overflow: 'hidden' },
      }}
      slotProps={{
        paper: {
          sx: {
            m: 0,
            width: { xs: 1, md: 'calc(100% - 48px)' },
            height: { xs: 1, md: 'calc(100% - 48px)' },
            maxHeight: 'none',
            borderRadius: { xs: 0, md: 3 },
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
        aria-label="ปิดรายละเอียดสินค้า"
        onClick={onClose}
        sx={{
          top: 40,
          right: 50,
          zIndex: 5,
          position: 'fixed',
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
