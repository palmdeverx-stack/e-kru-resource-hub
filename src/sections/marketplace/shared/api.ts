import type {
  ProductInput,
  MarketplaceTag,
  MarketplaceOrder,
  MarketplaceSeller,
  MarketplaceProduct,
  MarketplaceSaleType,
  MarketplaceCategory,
  MarketplaceMediaType,
  MarketplaceGradeLevel,
  MarketplaceCurriculum,
  MarketplaceProductFile,
  MarketplaceProductImage,
  MarketplaceSubjectOption,
  MarketplaceSchoolLicense,
  MarketplacePaymentSession,
  MarketplaceLicenseTeacher,
  MarketplaceSubscriptionPlan,
  MarketplaceProductEngagement,
} from './types';

async function parseResponse<T>(response: Response): Promise<T> {
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'ไม่สามารถดำเนินการได้');
  return result as T;
}

export async function getCategories(includeInactive = false) {
  const response = await fetch(`/api/marketplace/categories${includeInactive ? '?all=1' : ''}`);
  return parseResponse<{ categories: MarketplaceCategory[]; setupRequired?: boolean }>(response);
}

export async function getMediaTypes(includeInactive = false) {
  const response = await fetch(`/api/marketplace/media-types${includeInactive ? '?all=1' : ''}`);
  return parseResponse<{ items: MarketplaceMediaType[]; setupRequired?: boolean }>(response);
}

export async function getSaleTypes(includeInactive = false) {
  const response = await fetch(`/api/marketplace/sale-types${includeInactive ? '?all=1' : ''}`);
  return parseResponse<{ items: MarketplaceSaleType[]; setupRequired?: boolean }>(response);
}

export async function getGradeLevels(includeInactive = false) {
  const response = await fetch(`/api/marketplace/grade-levels${includeInactive ? '?all=1' : ''}`);
  return parseResponse<{ items: MarketplaceGradeLevel[]; setupRequired?: boolean }>(response);
}

export async function getCurricula(includeInactive = false) {
  const response = await fetch(`/api/marketplace/curricula${includeInactive ? '?all=1' : ''}`);
  return parseResponse<{ items: MarketplaceCurriculum[]; setupRequired?: boolean }>(response);
}

export async function getTags(includeInactive = false) {
  const response = await fetch(`/api/marketplace/tags${includeInactive ? '?all=1' : ''}`);
  return parseResponse<{ items: MarketplaceTag[]; setupRequired?: boolean }>(response);
}

export async function getMarketplaceSubjects() {
  const response = await fetch('/api/marketplace/subjects');
  return parseResponse<{ items: MarketplaceSubjectOption[] }>(response);
}

export async function getSubscriptionPlans() {
  const response = await fetch('/api/subscription-plans', { cache: 'no-store' });
  return parseResponse<{ plans: MarketplaceSubscriptionPlan[] }>(response);
}

export async function getProducts(params?: {
  q?: string;
  category?: string;
  sellerId?: string;
  mine?: boolean;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set('q', params.q);
  if (params?.category && params.category !== 'all') {
    searchParams.set('category', params.category);
  }
  if (params?.sellerId) searchParams.set('sellerId', params.sellerId);
  if (params?.mine) searchParams.set('mine', '1');
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const response = await fetch(`/api/marketplace/products?${searchParams}`, { cache: 'no-store' });
  return parseResponse<{
    products: MarketplaceProduct[];
    hasMore?: boolean;
    nextPage?: number | null;
    setupRequired?: boolean;
  }>(response);
}

export async function getProduct(id: string) {
  const response = await fetch(`/api/marketplace/products/${id}`, { cache: 'no-store' });
  return parseResponse<{ product: MarketplaceProduct }>(response);
}

export async function getProductCollections() {
  const response = await fetch('/api/marketplace/product-collections', { cache: 'no-store' });
  return parseResponse<{
    favorites: MarketplaceProduct[];
    bookmarks: MarketplaceProduct[];
    setupRequired?: boolean;
  }>(response);
}

export async function getProductPreference(productId: string) {
  const response = await fetch(
    `/api/marketplace/product-collections?productId=${encodeURIComponent(productId)}`,
    { cache: 'no-store' }
  );
  return parseResponse<{
    preference: { favorite: boolean; bookmark: boolean };
    setupRequired?: boolean;
  }>(response);
}

export async function updateProductCollection(
  productId: string,
  collectionType: 'favorite' | 'bookmark',
  active: boolean
) {
  const response = await fetch('/api/marketplace/product-collections', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, collectionType, active }),
  });
  return parseResponse<{ active: boolean }>(response);
}

export async function recordProductView(id: string, visitorId: string) {
  const response = await fetch(`/api/marketplace/products/${id}/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId }),
  });
  return parseResponse<{ views: number }>(response);
}

export async function getProductPreviewFiles(id: string) {
  const response = await fetch(`/api/marketplace/products/${id}/preview-files`);
  return parseResponse<{
    files: Array<{
      id: string;
      file_name: string;
      mime_type: string;
      position: number;
      url: string | null;
    }>;
  }>(response);
}

export async function saveProductReview(id: string, rating: number, comment: string) {
  const response = await fetch(`/api/marketplace/products/${id}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, comment }),
  });
  return parseResponse<{
    engagement: MarketplaceProductEngagement;
    message: string;
  }>(response);
}

export async function getSeller() {
  const response = await fetch('/api/marketplace/seller', { cache: 'no-store' });
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

export async function uploadProductImages(productId: string, files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const response = await fetch(`/api/marketplace/seller/products/${productId}/images`, {
    method: 'POST',
    body: formData,
  });
  return parseResponse<{ images: MarketplaceProductImage[] }>(response);
}

export async function deleteProductImage(productId: string, imageId: string) {
  const response = await fetch(`/api/marketplace/seller/products/${productId}/images/${imageId}`, {
    method: 'DELETE',
  });
  return parseResponse<{ images: MarketplaceProductImage[] }>(response);
}

export async function setProductCoverImage(productId: string, imageId: string) {
  const response = await fetch(`/api/marketplace/seller/products/${productId}/images/${imageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isCover: true }),
  });
  return parseResponse<{ images: MarketplaceProductImage[] }>(response);
}

export async function uploadProductFiles(productId: string, files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const response = await fetch(`/api/marketplace/seller/products/${productId}/files`, {
    method: 'POST',
    body: formData,
  });
  return parseResponse<{ files: MarketplaceProductFile[] }>(response);
}

export async function deleteProductFile(productId: string, fileId: string) {
  const response = await fetch(`/api/marketplace/seller/products/${productId}/files/${fileId}`, {
    method: 'DELETE',
  });
  return parseResponse<{ files: MarketplaceProductFile[] }>(response);
}

export async function setProductFilePreview(productId: string, fileId: string, isPreview: boolean) {
  const response = await fetch(`/api/marketplace/seller/products/${productId}/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPreview }),
  });
  return parseResponse<{ files: MarketplaceProductFile[] }>(response);
}

export async function getManagedProduct(id: string) {
  const response = await fetch(`/api/marketplace/products/${id}/manage`, { cache: 'no-store' });
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

export async function deleteProduct(id: string) {
  const response = await fetch(`/api/marketplace/products/${id}/manage`, { method: 'DELETE' });
  return parseResponse<{ success: true }>(response);
}

export async function createOrder(
  items: Array<{ productId: string }>,
  paymentMethod: string,
  licenseSchoolId?: string,
  salesDealToken?: string
) {
  const response = await fetch('/api/marketplace/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, paymentMethod, licenseSchoolId, salesDealToken }),
  });
  return parseResponse<{ orders: MarketplaceOrder[]; paymentSession: MarketplacePaymentSession }>(
    response
  );
}

export async function getEligibleLicenseSchools() {
  const response = await fetch('/api/marketplace/checkout/schools', { cache: 'no-store' });
  return parseResponse<{ schools: Array<{ id: string; name: string }> }>(response);
}

export async function getPaymentSession(id: string) {
  const response = await fetch(`/api/marketplace/payments/${id}`, { cache: 'no-store' });
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
  const response = await fetch('/api/marketplace/orders', { cache: 'no-store' });
  return parseResponse<{ orders: MarketplaceOrder[] }>(response);
}

export async function getMyOrder(id: string) {
  const response = await fetch(`/api/marketplace/orders/${id}`, { cache: 'no-store' });
  return parseResponse<{ order: MarketplaceOrder }>(response);
}

export async function getSchoolLicenses() {
  const response = await fetch('/api/marketplace/licenses', { cache: 'no-store' });
  return parseResponse<{
    licenses: MarketplaceSchoolLicense[];
    teachers: MarketplaceLicenseTeacher[];
  }>(response);
}

export async function assignTeacherLicense(licenseId: string, teacherId: string) {
  const response = await fetch(`/api/marketplace/licenses/${licenseId}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherId }),
  });
  return parseResponse<{ success: true; message: string }>(response);
}

export async function revokeTeacherLicense(licenseId: string, teacherId: string) {
  const response = await fetch(`/api/marketplace/licenses/${licenseId}/assignments`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherId }),
  });
  return parseResponse<{ success: true; message: string }>(response);
}

/** Strips HTML tags for safe plain-text display of rich-text product descriptions (no sanitizer/dangerouslySetInnerHTML in this codebase yet). */
export function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getLocalizedProduct(product: MarketplaceProduct, language: string) {
  const english = language.toLowerCase().startsWith('en');
  return {
    title: english && product.title_en?.trim() ? product.title_en : product.title,
    shortDescription:
      english && product.short_description_en?.trim()
        ? product.short_description_en
        : product.short_description,
    description:
      english && product.description_en?.trim() ? product.description_en : product.description,
  };
}

export function formatPrice(value: number, currency = 'THB') {
  if (value === 0) return '0 บาท';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
