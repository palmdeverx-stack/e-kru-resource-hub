import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { withMediaUrls } from 'src/sections/marketplace/seller/server/product-media';

type Context = { params: Promise<{ id: string }> };

type OrderProduct = {
  file_url: string | null;
  images?: Array<{ storage_bucket: string; storage_path: string; [key: string]: unknown }>;
  files?: Array<{ storage_bucket: string; storage_path: string; [key: string]: unknown }>;
};

export async function GET(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const { id } = await params;
  const { data: order, error } = await supabaseAdmin
    .from('marketplace_orders')
    .select(
      '*, seller:marketplace_sellers(id, display_name, slug, logo_url), payment_session:marketplace_payment_sessions(id, payment_method, status, submitted_at, reviewed_at, rejection_reason, bank_transaction_reference, processor_fee), items:marketplace_order_items(*, product:marketplace_products(id, title, title_en, short_description, short_description_en, file_url, cover_url, resource_type, images:marketplace_product_images(*), files:marketplace_product_files(*)))'
    )
    .eq('id', id)
    .eq('buyer_id', caller.sub)
    .maybeSingle();
  if (error || !order) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบรายละเอียดการซื้อ' },
      { status: error ? 500 : 404 }
    );
  }

  const isPaid = ['paid', 'completed'].includes(order.status);
  const items = await Promise.all(
    (order.items ?? []).map(async (item: Record<string, unknown>) => {
      const product = item.product as OrderProduct | null;
      if (!product) return item;
      const media = await withMediaUrls({
        images: product.images ?? [],
        files: [],
      });
      const files = isPaid
        ? (product.files ?? []).map((file) => ({
            ...file,
            url: `/api/marketplace/downloads/${String(file.id)}?orderItemId=${String(item.id)}`,
          }))
        : [];
      return {
        ...item,
        product: {
          ...product,
          images: media.images,
          files,
          file_url: isPaid ? product.file_url : null,
        },
      };
    })
  );

  return NextResponse.json({ order: { ...order, items } });
}
