"use client";

import type { CartItem, MarketplaceProduct } from '../shared/types';

import { useMemo, useState, useEffect, useContext, useCallback, createContext } from 'react';

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (product: MarketplaceProduct) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
};

const STORAGE_KEY = 'ekru-marketplace-cart';
const CartContext = createContext<CartContextValue | null>(null);

export function MarketplaceCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((product: MarketplaceProduct) => {
    setItems((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, 10) }
            : item
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((current) => current.filter((item) => item.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) {
      setItems((current) => current.filter((item) => item.product.id !== productId));
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.product.id === productId ? { ...item, quantity: Math.min(quantity, 10) } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      addItem,
      clearCart,
      removeItem,
      updateQuantity,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0),
    }),
    [addItem, clearCart, items, removeItem, updateQuantity]
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
