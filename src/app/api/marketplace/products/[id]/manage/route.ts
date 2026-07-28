import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { notifyMarketplaceAdmins } from 'src/sections/marketplace/admin/server/line-notifications';

type Context = { params: Promise<{ id: string }> };

async function ownedSellerId(ownerId: string) {
  const { data } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, status')
    .eq('owner_id', ownerId)
    .maybeSingle();
  return data ?? null;
}

export async function GET(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const seller = await ownedSellerId(caller.sub);
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });

  const { id } = await params;
  const { data: product, error } = await supabaseAdmin
    .from('marketplace_products')
    .select('*')
    .eq('id', id)
    .eq('seller_id', seller.id)
    .maybeSingle();
  if (error || !product) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบสินค้า' },
      { status: error ? 500 : 404 }
    );
  }
  return NextResponse.json({ product });
}

export async function PATCH(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const seller = await ownedSellerId(caller.sub);
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });
  if (seller.status !== 'active') {
    return NextResponse.json(
      { message: 'ร้านต้องได้รับการอนุมัติก่อนจึงจะแก้ไขและส่งสินค้าได้' },
      { status: 403 }
    );
  }

  const body = await request.json();
  const title = String(body.title ?? '').trim();
  const description = String(body.description ?? '').trim();
  const category = String(body.category ?? '').trim();
  const mediaTypeId = String(body.mediaTypeId ?? '');
  const saleTypeId = String(body.saleTypeId ?? '');
  let price = Number(body.price);
  const coverUrl = String(body.coverUrl ?? '').trim();
  const fileUrl = String(body.fileUrl ?? '').trim();

  if (
    title.length < 3 ||
    description.length < 10 ||
    !category ||
    !mediaTypeId ||
    !saleTypeId ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return NextResponse.json({ message: 'กรุณากรอกข้อมูลสินค้าให้ครบถ้วน' }, { status: 400 });
  }

  const [{ data: selectedCategory }, { data: mediaType }, { data: saleType }] = await Promise.all([
    supabaseAdmin
      .from('marketplace_categories')
      .select('id')
      .eq('name', category)
      .eq('is_active', true)
      .maybeSingle(),
    supabaseAdmin
      .from('marketplace_media_types')
      .select('id, delivery_mode')
      .eq('id', mediaTypeId)
      .eq('is_active', true)
      .maybeSingle(),
    supabaseAdmin
      .from('marketplace_sale_types')
      .select('id, pricing_mode')
      .eq('id', saleTypeId)
      .eq('is_active', true)
      .maybeSingle(),
  ]);
  if (!selectedCategory || !mediaType || !saleType) {
    return NextResponse.json(
      { message: 'หมวดหมู่ ประเภทสื่อ หรือประเภทการจำหน่ายไม่พร้อมใช้งาน' },
      { status: 400 }
    );
  }
  if (saleType.pricing_mode === 'free') price = 0;

  const { id } = await params;
  const { data: product, error } = await supabaseAdmin
    .from('marketplace_products')
    .update({
      title,
      description,
      category,
      media_type_id: mediaType.id,
      sale_type_id: saleType.id,
      resource_type: mediaType.delivery_mode,
      price,
      cover_url: coverUrl || null,
      file_url: fileUrl || null,
      status: caller.role === 'master_admin' ? 'published' : 'pending_review',
      submitted_at: new Date().toISOString(),
      reviewed_at: caller.role === 'master_admin' ? new Date().toISOString() : null,
      reviewed_by: caller.role === 'master_admin' ? caller.sub : null,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('seller_id', seller.id)
    .select('*')
    .maybeSingle();
  if (error || !product) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบสินค้า' },
      { status: error ? 500 : 404 }
    );
  }

  if (product.status === 'pending_review') {
    await notifyMarketplaceAdmins({
      event: 'product_approval',
      sourceId: product.id,
      message: [
        '📚 มีสินค้าส่งกลับมาให้อนุมัติ',
        `ชื่อสินค้า: ${product.title}`,
        `หมวดหมู่: ${product.category}`,
      ].join('\n'),
      actionUrl: `${new URL(request.url).origin}/dashboard/product-approvals`,
    });
  }

  return NextResponse.json({ product });
}
