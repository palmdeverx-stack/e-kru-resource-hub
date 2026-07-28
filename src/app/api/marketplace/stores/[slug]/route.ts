import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { slug } = await params;
  const { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, display_name, display_name_en, slug, logo_url, cover_url, bio, seller_type')
    .eq('slug', decodeURIComponent(slug))
    .eq('status', 'active')
    .maybeSingle();
  if (error || !seller) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบร้านค้า' },
      { status: error ? 500 : 404 }
    );
  }
  const { data: products, error: productError } = await supabaseAdmin
    .from('marketplace_products')
    .select(
      'id, seller_id, title, description, category, media_type_id, sale_type_id, resource_type, price, currency, cover_url, status, created_at'
    )
    .eq('seller_id', seller.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (productError) {
    return NextResponse.json({ message: productError.message }, { status: 500 });
  }
  return NextResponse.json({
    seller,
    products: (products ?? []).map((product) => ({ ...product, seller })),
  });
}
