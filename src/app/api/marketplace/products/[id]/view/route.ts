import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

type Context = { params: Promise<{ id: string }> };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  const { id: productId } = await params;
  const body = await request.json().catch(() => null);
  const visitorId = String(body?.visitorId ?? '');

  if (!caller && !UUID_PATTERN.test(visitorId)) {
    return NextResponse.json({ message: 'ข้อมูลผู้เข้าชมไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: product } = await supabaseAdmin
    .from('marketplace_products')
    .select('id')
    .eq('id', productId)
    .eq('status', 'published')
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const visitorKey = caller ? `user:${caller.sub}` : `guest:${visitorId}`;
  const { error } = await supabaseAdmin.from('marketplace_product_views').upsert(
    {
      product_id: productId,
      visitor_key: visitorKey,
      viewer_id: caller?.sub ?? null,
      last_viewed_at: now,
    },
    { onConflict: 'product_id,visitor_key' }
  );
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const { count } = await supabaseAdmin
    .from('marketplace_product_views')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);

  return NextResponse.json({ views: count ?? 0 });
}
