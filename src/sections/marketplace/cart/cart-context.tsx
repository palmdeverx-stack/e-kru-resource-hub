'use client';

import type { CartItem, MarketplaceProduct } from '../shared/types';

import { useMemo, useState, useEffect, useContext, useCallback, createContext } from 'react';

import { getProduct } from '../shared/api';

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (product: MarketplaceProduct) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

const STORAGE_KEY = 'ekru-marketplace-cart';
const CartContext = createContext<CartContextValue | null>(null);

export function MarketplaceCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    let active = true;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Array<{ product?: MarketplaceProduct }>;
        if (Array.isArray(parsed)) {
          const storedItems = parsed
            .filter((item) => item.product)
            .map((item) => ({ product: item.product! }));
          setItems(storedItems);

          Promise.allSettled(
            storedItems.map(async ({ product }) => {
              if (product.id.startsWith('sample-')) return product;
              return (await getProduct(product.id)).product;
            })
          ).then((results) => {
            if (!active) return;
            setItems(
              results.flatMap((result, index) =>
                result.status === 'fulfilled'
                  ? [{ product: result.value }]
                  : storedItems[index]
                    ? [storedItems[index]]
                    : []
              )
            );
          });
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((product: MarketplaceProduct) => {
    setItems((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) return current;
      return [...current, { product }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((current) => current.filter((item) => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      addItem,
      clearCart,
      removeItem,
      itemCount: items.length,
      subtotal: items.reduce((sum, item) => sum + Number(item.product.price), 0),
    }),
    [addItem, clearCart, items, removeItem]
  );

  return <CartContext value={value}>{children}</CartContext>;
}

export function useMarketplaceCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useMarketplaceCart must be used inside MarketplaceCartProvider');
  }
  return context;
}
