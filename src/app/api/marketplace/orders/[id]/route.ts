import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { withMediaUrls } from 'src/sections/marketplace/seller/server/product-media';
import { withPublicSystemStoreFlag } from 'src/sections/marketplace/seller/server/public-seller';

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
      '*, seller:marketplace_sellers(id, display_name, slug, logo_url, owner_role), payment_session:marketplace_payment_sessions(id, amount, currency, payment_method, status, account_name_snapshot, submitted_at, reviewed_at, rejection_reason, bank_transaction_reference, stripe_payment_intent_id, processor_fee, expires_at, created_at), items:marketplace_order_items(*, product:marketplace_products(id, title, title_en, short_description, short_description_en, file_url, cover_url, category, subject_label, resource_type, license_scope, license_seat_count, grants_plan_code, grant_duration_days, images:marketplace_product_images(*), files:marketplace_product_files(*)))'
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

  const [{ data: receipt }, { data: schoolLicenses }, { data: userLicenses }] = await Promise.all([
    order.payment_session_id
      ? supabaseAdmin
          .from('marketplace_receipts')
          .select(
            'id, receipt_number, status, amount, currency, payment_method, transaction_reference, buyer_name, buyer_email, buyer_tax_id, buyer_address, provider_name, provider_tax_id, provider_address, provider_email, notes, issued_at, voided_at, void_reason'
          )
          .eq('payment_session_id', order.payment_session_id)
          .eq('buyer_id', caller.sub)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from('marketplace_school_licenses')
      .select(
        'id, order_item_id, product_id, school_id, license_scope, feature_keys, seat_count, grants_plan_code, starts_at, expires_at, status, school:schools(id,name)'
      )
      .eq('order_id', order.id),
    supabaseAdmin
      .from('marketplace_user_licenses')
      .select(
        'id, order_item_id, product_id, feature_keys, grants_plan_code, duration_days, starts_at, expires_at, status'
      )
      .eq('order_id', order.id)
      .eq('buyer_id', caller.sub),
  ]);

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

  return NextResponse.json({
    order: {
      ...order,
      seller: withPublicSystemStoreFlag(order.seller),
      items,
      receipt: receipt ?? null,
      school_licenses: schoolLicenses ?? [],
      user_licenses: userLicenses ?? [],
    },
  });
}
