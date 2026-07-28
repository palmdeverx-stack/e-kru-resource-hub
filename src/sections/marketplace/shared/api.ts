import type {
  ProductInput,
  MarketplaceOrder,
  MarketplaceSeller,
  MarketplaceProduct,
  MarketplaceSaleType,
  MarketplaceCategory,
  MarketplaceMediaType,
  MarketplacePaymentSession,
} from './types';

async function parseResponse<T>(response: Response): Promise<T> {
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'ไม่สามารถดำเนินการได้');
  return result as T;
}

export async function getCategories(includeInactive = false) {
  const response = await fetch(
    `/api/marketplace/categories${includeInactive ? '?all=1' : ''}`
  );
  return parseResponse<{ categories: MarketplaceCategory[]; setupRequired?: boolean }>(response);
}

export async function getMediaTypes(includeInactive = false) {
  const response = await fetch(
    `/api/marketplace/media-types${includeInactive ? '?all=1' : ''}`
  );
  return parseResponse<{ items: MarketplaceMediaType[]; setupRequired?: boolean }>(response);
}

export async function getSaleTypes(includeInactive = false) {
  const response = await fetch(
    `/api/marketplace/sale-types${includeInactive ? '?all=1' : ''}`
  );
  return parseResponse<{ items: MarketplaceSaleType[]; setupRequired?: boolean }>(response);
}

export async function getProducts(params?: { q?: string; category?: string; mine?: boolean }) {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set('q', params.q);
  if (params?.category && params.category !== 'all') {
    searchParams.set('category', params.category);
  }
  if (params?.mine) searchParams.set('mine', '1');

  const response = await fetch(`/api/marketplace/products?${searchParams}`);
  return parseResponse<{ products: MarketplaceProduct[]; setupRequired?: boolean }>(response);
}

export async function getProduct(id: string) {
  const response = await fetch(`/api/marketplace/products/${id}`);
  return parseResponse<{ product: MarketplaceProduct }>(response);
}

export async function getSeller() {
  const response = await fetch('/api/marketplace/seller');
  return parseResponse<{ seller: MarketplaceSeller | null }>(response);
}

export async function saveSeller(input: Record<string, unknown>) {
  const response = await fetch('/api/marketplace/seller', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseResponse<{ seller: MarketplaceSeller; message: string }>(response);
}

export async function createProduct(input: ProductInput) {
  const response = await fetch('/api/marketplace/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseResponse<{ product: MarketplaceProduct }>(response);
}

export async function getManagedProduct(id: string) {
  const response = await fetch(`/api/marketplace/products/${id}/manage`);
  return parseResponse<{ product: MarketplaceProduct }>(response);
}

export async function updateProduct(id: string, input: ProductInput) {
  const response = await fetch(`/api/marketplace/products/${id}/manage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseResponse<{ product: MarketplaceProduct }>(response);
}

export async function createOrder(
  items: Array<{ productId: string; quantity: number }>,
  paymentMethod: string
) {
  const response = await fetch('/api/marketplace/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, paymentMethod }),
  });
  return parseResponse<{ orders: MarketplaceOrder[]; paymentSession: MarketplacePaymentSession }>(
    response
  );
}

export async function getPaymentSession(id: string) {
  const response = await fetch(`/api/marketplace/payments/${id}`);
  return parseResponse<{ paymentSession: MarketplacePaymentSession }>(response);
}

export async function uploadPaymentSlip(id: string, file: File) {
  const formData = new FormData();
  formData.set('slip', file);
  const response = await fetch(`/api/marketplace/payments/${id}/slip`, {
    method: 'POST',
    body: formData,
  });
  return parseResponse<{ paymentSession: MarketplacePaymentSession; message: string }>(response);
}

export async function getMyOrders() {
  const response = await fetch('/api/marketplace/orders');
  return parseResponse<{ orders: MarketplaceOrder[] }>(response);
}

export function formatPrice(value: number, currency = 'THB') {
  if (value === 0) return 'ฟรี';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
