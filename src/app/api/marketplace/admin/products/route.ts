import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

import { withMediaUrls } from 'src/sections/marketplace/seller/server/product-media';

const allowedStatuses = ['all', 'pending_review', 'published', 'rejected'] as const;

export async function GET(request: Request) {
  if (!requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตรวจสอบสินค้า' }, { status: 403 });
  }

  const requestedStatus = new URL(request.url).searchParams.get('status') ?? 'pending_review';
  const status = allowedStatuses.includes(requestedStatus as (typeof allowedStatuses)[number])
    ? requestedStatus
    : 'pending_review';

  let query = supabaseAdmin
    .from('marketplace_products')
    .select(
      '*, seller:marketplace_sellers(id, display_name, seller_type, contact_email), media_type:marketplace_media_types(id, name), sale_type:marketplace_sale_types(id, name, pricing_mode), images:marketplace_product_images(*)'
    )
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(100);
  if (status !== 'all') query = query.eq('status', status);

  const [productsResult, pendingResult, publishedResult, rejectedResult] = await Promise.all([
    query,
    supabaseAdmin
      .from('marketplace_products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_review'),
    supabaseAdmin
      .from('marketplace_products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabaseAdmin
      .from('marketplace_products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'rejected'),
  ]);

  const error =
    productsResult.error || pendingResult.error || publishedResult.error || rejectedResult.error;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const products = await Promise.all(
    (productsResult.data ?? []).map((product) => withMediaUrls(product))
  );

  return NextResponse.json({
    products,
    counts: {
      pending_review: pendingResult.count ?? 0,
      published: publishedResult.count ?? 0,
      rejected: rejectedResult.count ?? 0,
    },
  });
}
