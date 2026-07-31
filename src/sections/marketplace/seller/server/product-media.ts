import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

export const PRODUCT_MANAGE_SELECT = `*,
  curriculum:marketplace_curricula(id,name),
  grade_levels:marketplace_product_grade_levels(grade_level:marketplace_grade_levels(id,name)),
  tags:marketplace_product_tags(tag:marketplace_tags(id,name)),
  images:marketplace_product_images(*),
  files:marketplace_product_files(*)`;

type StoredMedia = {
  id?: string;
  is_cover?: boolean;
  storage_bucket: string;
  storage_path: string;
  [key: string]: unknown;
};

function productImageUrl(imageId: string) {
  return `/api/marketplace/images/${encodeURIComponent(imageId)}`;
}

function isSupabaseStorageUrl(value: unknown): value is string {
  return typeof value === 'string' && value.includes('/storage/v1/object/');
}

/** Keeps storage details server-side: images use the app proxy and files use short-lived signed URLs. */
export async function withMediaUrls<
  T extends {
    images?: StoredMedia[];
    files?: StoredMedia[];
    cover_url?: string | null;
  },
>(
  product: T
): Promise<T> {
  const images = (product.images ?? []).map((image) => ({
    ...image,
    url: image.id ? productImageUrl(image.id) : null,
  }));

  const files = await Promise.all(
    (product.files ?? []).map(async (file) => {
      const { data } = await supabaseAdmin.storage
        .from(file.storage_bucket)
        .createSignedUrl(file.storage_path, 10 * 60);
      return { ...file, url: data?.signedUrl ?? null };
    })
  );

  const coverImage = images.find((image) => image.is_cover) ?? images[0];
  const coverUrl = isSupabaseStorageUrl(product.cover_url)
    ? (coverImage?.url ?? null)
    : product.cover_url;

  return { ...product, cover_url: coverUrl, images, files };
}

export async function refreshedImages(productId: string) {
  const { data: images } = await supabaseAdmin
    .from('marketplace_product_images')
    .select('*')
    .eq('product_id', productId)
    .order('position');
  const { images: resolved } = await withMediaUrls({ images: images ?? [], files: [] });
  return resolved;
}

export async function refreshedFiles(productId: string) {
  const { data: files } = await supabaseAdmin
    .from('marketplace_product_files')
    .select('*')
    .eq('product_id', productId)
    .order('position');
  const { files: resolved } = await withMediaUrls({ images: [], files: files ?? [] });
  return resolved;
}
