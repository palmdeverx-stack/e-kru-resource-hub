import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { withMediaUrls } from 'src/sections/marketplace/seller/server/product-media';
import {
  getProductEngagement,
  getProductPurchaseAccess,
} from 'src/sections/marketplace/catalog/server/product-engagement';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = requireAuthenticated(request);
  const { id } = await params;
  const { data: product, error } = await supabaseAdmin
    .from('marketplace_products')
    .select(
      '*, seller:marketplace_sellers(id, display_name, display_name_en, seller_type, slug, logo_url, bio), media_type:marketplace_media_types(id, name, delivery_mode), sale_type:marketplace_sale_types(id, name, pricing_mode), curriculum:marketplace_curricula(id, name), grade_levels:marketplace_product_grade_levels(grade_level:marketplace_grade_levels(id, name)), tags:marketplace_product_tags(tag:marketplace_tags(id, name)), images:marketplace_product_images(*)'
    )
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  if (!product) {
    return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });
  }

  const publicProduct = (await withMediaUrls(product)) as Record<string, unknown>;
  delete publicProduct.file_url;
  const [engagement, purchaseAccess] = await Promise.all([
    getProductEngagement(id, caller?.sub),
    getProductPurchaseAccess({
      productId: id,
      buyerId: caller?.sub,
      schoolId: caller?.schoolId,
      resourceType: product.resource_type,
    }),
  ]);
  publicProduct.engagement = engagement;
  publicProduct.purchase_access = purchaseAccess;
  return NextResponse.json({ product: publicProduct });
}
