import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { withMediaUrls } from 'src/sections/marketplace/seller/server/product-media';

type PreviewProduct = {
  id: string;
  cover_url: string | null;
  images: Array<{
    id: string;
    is_cover: boolean;
    storage_bucket: string;
    storage_path: string;
  }>;
  seller: unknown;
};

export async function GET() {
  const { data: categories, error: categoriesError } = await supabaseAdmin
    .from('marketplace_categories')
    .select('id, name, description')
    .eq('is_active', true)
    .order('sort_order')
    .order('name')
    .limit(7);

  if (categoriesError) {
    if (categoriesError.code === '42P01') return NextResponse.json({ items: [] });
    return NextResponse.json({ message: categoriesError.message }, { status: 500 });
  }

  const items = await Promise.all(
    (categories ?? []).map(async (category) => {
      const [countResult, previewResult] = await Promise.all([
        supabaseAdmin
          .from('marketplace_products')
          .select('id, seller:marketplace_sellers!inner(status)', { count: 'exact', head: true })
          .eq('status', 'published')
          .eq('category', category.name)
          .eq('seller.status', 'active'),
        supabaseAdmin
          .from('marketplace_products')
          .select(
            'id, cover_url, images:marketplace_product_images(id, is_cover, storage_bucket, storage_path), seller:marketplace_sellers!inner(status, owner_role, is_system_store)'
          )
          .eq('status', 'published')
          .eq('category', category.name)
          .eq('seller.status', 'active')
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      const resolvedProducts = await Promise.all(
        ((previewResult.data ?? []) as unknown as PreviewProduct[]).map((product) =>
          withMediaUrls(product)
        )
      );

      return {
        id: category.id,
        name: category.name,
        description: category.description,
        count: countResult.count ?? 0,
        previewImages: resolvedProducts
          .map((product) => product.cover_url)
          .filter((url): url is string => Boolean(url)),
      };
    })
  );

  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  );
}
