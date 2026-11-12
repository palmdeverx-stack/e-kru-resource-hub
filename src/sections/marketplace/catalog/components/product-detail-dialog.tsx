'use client';

import type { MarketplaceProduct } from '../../shared/types';

import { useRef, useEffect } from 'react';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

/** Compatibility for existing dashboard/cart actions: open the dedicated product page. */
export function MarketplaceProductDetailDialog({
  product,
  onClose,
}: {
  product: MarketplaceProduct | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const navigating = useRef<string | null>(null);
  useEffect(() => {
    if (!product) {
      navigating.current = null;
      return;
    }
    if (navigating.current === product.id) return;
    navigating.current = product.id;
    router.push(paths.marketplace.product(product.id));
    onClose();
  }, [product, router, onClose]);
  return null;
}
