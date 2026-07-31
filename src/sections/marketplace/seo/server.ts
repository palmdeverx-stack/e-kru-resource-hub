import 'server-only';

import { cache } from 'react';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { withMediaUrls } from '../seller/server/product-media';
import { SELLER_TOOLS_CATEGORY } from '../seller/server/seller-tools-access';

type ProductImage = {
  storage_bucket: string;
  storage_path: string;
  is_cover?: boolean;
  position?: number;
  url?: string;
};

function plainText(value: string | null | undefined, maxLength = 180) {
  const text = (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

export const getPublicProductSeo = cache(async (id: string) => {
  const { data: product, error } = await supabaseAdmin
    .from('marketplace_products')
    .select(
      'id, title, title_en, short_description, short_description_en, description, description_en, price, currency, cover_url, updated_at, seller:marketplace_sellers!inner(display_name, display_name_en, status), images:marketplace_product_images(storage_bucket, storage_path, is_cover, position), reviews:marketplace_product_reviews(rating)'
    )
    .eq('id', id)
    .eq('status', 'published')
    .neq('category', SELLER_TOOLS_CATEGORY)
    .eq('seller.status', 'active')
    .maybeSingle();

  if (error || !product) return null;

  const resolved = await withMediaUrls({
    images: (product.images ?? []) as ProductImage[],
    files: [],
  });
  const images = [...resolved.images].sort(
    (left, right) =>
      Number(Boolean(right.is_cover)) - Number(Boolean(left.is_cover)) ||
      Number(left.position ?? 0) - Number(right.position ?? 0)
  );
  const ratings = (product.reviews ?? [])
    .map((review) => Number(review.rating))
    .filter((rating) => Number.isFinite(rating));
  const seller = Array.isArray(product.seller) ? product.seller[0] : product.seller;

  return {
    id: product.id,
    title: product.title,
    titleEn: product.title_en,
    description:
      plainText(product.short_description || product.description) ||
      `สื่อการสอนจาก ${seller?.display_name ?? 'E-KRU Marketplace'}`,
    descriptionEn:
      plainText(product.short_description_en || product.description_en) ||
      plainText(product.short_description || product.description) ||
      `Teaching resource from ${seller?.display_name_en || seller?.display_name || 'E-KRU Marketplace'}`,
    price: Number(product.price),
    currency: product.currency,
    image: images[0]?.url || product.cover_url || null,
    sellerName: seller?.display_name ?? 'E-KRU Marketplace',
    sellerNameEn: seller?.display_name_en || seller?.display_name || 'E-KRU Marketplace',
    reviewCount: ratings.length,
    averageRating: ratings.length
      ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
      : 0,
    updatedAt: product.updated_at,
  };
});

export const getPublicStoreSeo = cache(async (identifier: string) => {
  const decodedIdentifier = decodeURIComponent(identifier);
  let query = supabaseAdmin
    .from('marketplace_sellers')
    .select(
      'id, display_name, display_name_en, slug, bio, logo_url, cover_url, seller_type, updated_at'
    )
    .eq('status', 'active');

  query = /^[0-9a-f-]{36}$/i.test(decodedIdentifier)
    ? query.eq('id', decodedIdentifier)
    : query.eq('slug', decodedIdentifier);

  const { data: seller, error } = await query.maybeSingle();
  if (error || !seller) return null;

  return {
    ...seller,
    description:
      plainText(seller.bio) ||
      `เลือกดูสื่อการสอนและผลงานทั้งหมดจาก ${seller.display_name} บน E-KRU Marketplace`,
  };
});
