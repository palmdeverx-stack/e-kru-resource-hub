import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { recordEntitlementUsage } from 'src/sections/marketplace/checkout/server/order-evidence';
import { hasPurchasedProduct } from 'src/sections/marketplace/catalog/server/product-engagement';

type Context = { params: Promise<{ id: string }> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  const { id: productId } = await params;
  const body = await request.json().catch(() => null);
  const visitorId = String(body?.visitorId ?? '');

  if (!caller && !UUID_PATTERN.test(visitorId)) {
    return NextResponse.json({ message: 'ข้อมูลผู้เข้าชมไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: product } = await supabaseAdmin
    .from('marketplace_products')
    .select('id, status')
    .eq('id', productId)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });
  }
  if (
    product.status !== 'published' &&
    !(product.status === 'archived' && caller && (await hasPurchasedProduct(productId, caller.sub)))
  ) {
    return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const visitorKey = caller ? `user:${caller.sub}` : `guest:${visitorId}`;
  const ipAddress =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;
  const requestId =
    request.headers.get('x-request-id') ??
    request.headers.get('x-vercel-id') ??
    crypto.randomUUID();
  const { error } = await supabaseAdmin.from('marketplace_product_views').upsert(
    {
      product_id: productId,
      visitor_key: visitorKey,
      viewer_id: caller?.sub ?? null,
      ip_address: ipAddress,
      user_agent: request.headers.get('user-agent')?.slice(0, 2000) ?? null,
      request_id: requestId,
      last_viewed_at: now,
    },
    { onConflict: 'product_id,visitor_key' }
  );
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  if (caller) {
    const { data: purchasedItem } = await supabaseAdmin
      .from('marketplace_order_items')
      .select('id, order:marketplace_orders!inner(id)')
      .eq('product_id', productId)
      .eq('order.buyer_id', caller.sub)
      .in('order.status', ['paid', 'completed'])
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (purchasedItem) {
      await recordEntitlementUsage({
        request,
        buyerId: caller.sub,
        eventType: 'purchased_product_viewed',
        orderId: purchasedItem.order[0]?.id ?? null,
        orderItemId: purchasedItem.id,
        productId,
      }).catch((usageError) => {
        console.error('Failed to record purchased product view', usageError);
      });
    }
  }

  const { count } = await supabaseAdmin
    .from('marketplace_product_views')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);

  return NextResponse.json({ views: count ?? 0 });
}
