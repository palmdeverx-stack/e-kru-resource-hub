import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: product, error } = await supabaseAdmin
    .from('marketplace_products')
    .select(
      '*, seller:marketplace_sellers(id, display_name, seller_type), media_type:marketplace_media_types(id, name, delivery_mode), sale_type:marketplace_sale_types(id, name, pricing_mode)'
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

  const publicProduct = { ...product };
  delete publicProduct.file_url;
  return NextResponse.json({ product: publicProduct });
}
