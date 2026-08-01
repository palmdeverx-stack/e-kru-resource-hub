import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { withMediaUrls } from 'src/sections/marketplace/seller/server/product-media';
import { getEligibleLicenseSchools } from 'src/sections/marketplace/checkout/server/school-targets';
import { getSellerProfileCompletionById } from 'src/sections/marketplace/seller/server/seller-completion';
import {
  canViewSellerTools,
  SELLER_TOOLS_CATEGORY,
} from 'src/sections/marketplace/seller/server/seller-tools-access';
import {
  hasPurchasedProduct,
  getProductEngagement,
  getProductPurchaseAccess,
} from 'src/sections/marketplace/catalog/server/product-engagement';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = requireAuthenticated(request);
  const { id } = await params;
  const { data: product, error } = await supabaseAdmin
    .from('marketplace_products')
    .select(
      '*, seller:marketplace_sellers(id, display_name, display_name_en, seller_type, slug, logo_url, bio, owner_role), media_type:marketplace_media_types(id, name, delivery_mode), sale_type:marketplace_sale_types(id, name, pricing_mode), curriculum:marketplace_curricula(id, name), grade_levels:marketplace_product_grade_levels(grade_level:marketplace_grade_levels(id, name)), tags:marketplace_product_tags(tag:marketplace_tags(id, name)), images:marketplace_product_images(*)'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  if (!product) {
    return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });
  }
  const hasArchivedPurchase =
    product.status === 'archived' && caller
      ? await hasPurchasedProduct(product.id, caller.sub)
      : false;
  if (product.status !== 'published' && !hasArchivedPurchase) {
    return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });
  }
  if (
    product.category === SELLER_TOOLS_CATEGORY &&
    !hasArchivedPurchase &&
    !(await canViewSellerTools(caller?.sub))
  ) {
    return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });
  }

  const publicProduct = (await withMediaUrls(product)) as Record<string, unknown>;
  delete publicProduct.file_url;
  delete publicProduct.external_links;
  delete publicProduct.purchase_benefits_html;
  if (product.seller?.id) {
    const { owner_role: ownerRole, ...sellerDetails } = product.seller;
    publicProduct.seller = {
      ...sellerDetails,
      is_system_store: ownerRole === 'master_admin',
      profile_completion: await getSellerProfileCompletionById(product.seller.id),
    };
  }
  const eligibleSchools =
    caller &&
    product.resource_type === 'feature_unlock' &&
    ['school', 'teacher'].includes(product.license_scope)
      ? await getEligibleLicenseSchools(caller)
      : [];
  const [engagement, resolvedPurchaseAccess, previewFileResult] = await Promise.all([
    getProductEngagement(id, caller?.sub),
    getProductPurchaseAccess({
      productId: id,
      buyerId: caller?.sub,
      buyerRole: caller?.role,
      schoolId: caller?.schoolId,
      schoolIds: eligibleSchools.map((school) => school.id),
      resourceType: product.resource_type,
      licenseScope: product.license_scope,
      featureKeys: product.grants_feature_keys,
    }),
    supabaseAdmin
      .from('marketplace_product_files')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id)
      .eq('is_preview', true),
  ]);
  const purchaseAccess = hasArchivedPurchase
    ? {
        ...resolvedPurchaseAccess,
        canPurchase: false,
        hasPurchased: true,
        message: 'สินค้านี้หยุดเปิดขายแล้ว แต่คุณยังเข้าถึงสินค้าที่ซื้อไว้ได้ตามเดิม',
      }
    : resolvedPurchaseAccess;
  publicProduct.engagement = engagement;
  publicProduct.purchase_access = purchaseAccess;
  publicProduct.has_preview_file = (previewFileResult.count ?? 0) > 0;
  return NextResponse.json({ product: publicProduct });
}
