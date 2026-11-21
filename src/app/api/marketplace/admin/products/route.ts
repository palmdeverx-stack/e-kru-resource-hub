import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

import { withMediaUrls } from 'src/sections/marketplace/seller/server/product-media';

const allowedStatuses = ['all', 'pending_review', 'published', 'rejected'] as const;

export async function GET(request: Request) {
  if (!requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตรวจสอบสินค้า' }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  if (searchParams.get('notification') === '1') {
    const seenAt = Number(searchParams.get('seenAt') ?? 0);
    let query = supabaseAdmin
      .from('marketplace_products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review');

    if (Number.isFinite(seenAt) && seenAt > 0 && seenAt <= 8_640_000_000_000_000) {
      query = query.gt('submitted_at', new Date(seenAt).toISOString());
    }

    const { count, error } = await query;
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    return NextResponse.json(
      { unreadCount: count ?? 0 },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  const requestedStatus = searchParams.get('status') ?? 'pending_review';
  const status = allowedStatuses.includes(requestedStatus as (typeof allowedStatuses)[number])
    ? requestedStatus
    : 'pending_review';
  const requestedPage = Number(searchParams.get('page'));
  const requestedPageSize = Number(searchParams.get('pageSize'));
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(50, Math.max(5, Math.floor(requestedPageSize)))
    : 10;
  const from = (page - 1) * pageSize;

  let query = supabaseAdmin
    .from('marketplace_products')
    .select(
      '*, seller:marketplace_sellers(id, display_name, seller_type, contact_email, owner_role), media_type:marketplace_media_types(id, name), sale_type:marketplace_sale_types(id, name, pricing_mode), images:marketplace_product_images(*)',
      { count: 'exact' }
    )
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + pageSize - 1);
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
    pagination: {
      page,
      pageSize,
      total: productsResult.count ?? 0,
      totalPages: Math.ceil((productsResult.count ?? 0) / pageSize),
    },
  });
}
