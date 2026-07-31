import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { hasPurchasedProduct } from 'src/sections/marketplace/catalog/server/product-engagement';

type Context = { params: Promise<{ imageId: string }> };

const ADMIN_ROLES = new Set(['master_admin', 'super_admin']);

export async function GET(request: Request, { params }: Context) {
  const { imageId } = await params;
  const { data: image, error: imageError } = await supabaseAdmin
    .from('marketplace_product_images')
    .select('id, product_id, storage_bucket, storage_path, mime_type')
    .eq('id', imageId)
    .maybeSingle();

  if (imageError) {
    return NextResponse.json({ message: imageError.message }, { status: 500 });
  }
  if (!image) {
    return NextResponse.json({ message: 'ไม่พบรูปภาพ' }, { status: 404 });
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from('marketplace_products')
    .select('id, status, seller:marketplace_sellers!inner(owner_id)')
    .eq('id', image.product_id)
    .maybeSingle();

  if (productError) {
    return NextResponse.json({ message: productError.message }, { status: 500 });
  }
  if (!product) {
    return NextResponse.json({ message: 'ไม่พบรูปภาพ' }, { status: 404 });
  }

  const caller = requireAuthenticated(request);
  const seller = Array.isArray(product.seller) ? product.seller[0] : product.seller;
  const isPublic = product.status === 'published';
  const canManage = caller
    ? ADMIN_ROLES.has(caller.role) || Boolean(seller?.owner_id && seller.owner_id === caller.sub)
    : false;
  const hasPurchased =
    !isPublic && caller ? await hasPurchasedProduct(image.product_id, caller.sub) : false;

  if (!isPublic && !canManage && !hasPurchased) {
    return NextResponse.json({ message: 'ไม่พบรูปภาพ' }, { status: 404 });
  }

  const { data: file, error: downloadError } = await supabaseAdmin.storage
    .from(image.storage_bucket)
    .download(image.storage_path);

  if (downloadError || !file) {
    return NextResponse.json(
      { message: downloadError?.message ?? 'ไม่สามารถโหลดรูปภาพได้' },
      { status: 404 }
    );
  }

  return new Response(file, {
    headers: {
      'Content-Type': image.mime_type || file.type || 'application/octet-stream',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': isPublic
        ? 'public, max-age=86400, stale-while-revalidate=604800'
        : 'private, no-store',
    },
  });
}
