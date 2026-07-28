import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { provisionEkruSystemSeller } from 'src/sections/marketplace/seller/server/system-seller';
import { notifyMarketplaceAdmins } from 'src/sections/marketplace/admin/server/line-notifications';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mine = url.searchParams.get('mine') === '1';
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('q')?.trim();

  let sellerId: string | null = null;
  if (mine) {
    const caller = requireAuthenticated(request);
    if (!caller) {
      return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const { data: seller } = await supabaseAdmin
      .from('marketplace_sellers')
      .select('id')
      .eq('owner_id', caller.sub)
      .maybeSingle();
    sellerId = seller?.id ?? null;
    if (!sellerId) return NextResponse.json({ products: [] });
  }

  let query = supabaseAdmin
    .from('marketplace_products')
    .select(
      '*, seller:marketplace_sellers(id, display_name, seller_type), media_type:marketplace_media_types(id, name, delivery_mode), sale_type:marketplace_sale_types(id, name, pricing_mode)'
    )
    .order('created_at', { ascending: false })
    .limit(48);

  query = mine ? query.eq('seller_id', sellerId) : query.eq('status', 'published');
  if (category && category !== 'all') query = query.eq('category', category);
  if (search) query = query.ilike('title', `%${search.replaceAll('%', '')}%`);

  const { data: products, error } = await query;

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ products: [], setupRequired: true });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const safeProducts = (products ?? []).map((product) => {
    if (mine) return product;
    const publicProduct = { ...product };
    delete publicProduct.file_url;
    return publicProduct;
  });
  return NextResponse.json({ products: safeProducts });
}

export async function POST(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  let { data: seller } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, status')
    .eq('owner_id', caller.sub)
    .maybeSingle();

  if (!seller && caller.role === 'master_admin') {
    const systemSellerResult = await provisionEkruSystemSeller(caller.sub);
    seller = systemSellerResult.data
      ? { id: systemSellerResult.data.id, status: systemSellerResult.data.status }
      : null;
  }

  if (!seller) {
    return NextResponse.json(
      { message: 'กรุณาส่งคำขอเปิดร้านและรอผู้ดูแลระบบอนุมัติก่อนลงสินค้า' },
      { status: 403 }
    );
  }
  if (seller.status !== 'active') {
    const message =
      seller.status === 'pending'
        ? 'คำขอเปิดร้านกำลังรอผู้ดูแลระบบอนุมัติ'
        : seller.status === 'rejected'
          ? 'คำขอเปิดร้านไม่ผ่าน กรุณาแก้ไขข้อมูลและส่งคำขอใหม่'
          : 'ร้านถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
    return NextResponse.json({ message }, { status: 403 });
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
    return NextResponse.json(
      { message: 'กรุณากรอกชื่อ รายละเอียด หมวดหมู่ และราคาให้ถูกต้อง' },
      { status: 400 }
    );
  }

  const { data: selectedCategory, error: categoryError } = await supabaseAdmin
    .from('marketplace_categories')
    .select('id')
    .eq('name', category)
    .eq('is_active', true)
    .maybeSingle();
  if (categoryError?.code === '42P01') {
    return NextResponse.json(
      { message: 'กรุณาติดตั้ง Marketplace category schema เวอร์ชันล่าสุด' },
      { status: 503 }
    );
  }
  if (categoryError || !selectedCategory) {
    return NextResponse.json(
      { message: 'หมวดหมู่นี้ไม่มีอยู่หรือถูกปิดใช้งาน' },
      { status: 400 }
    );
  }

  const [{ data: mediaType, error: mediaTypeError }, { data: saleType, error: saleTypeError }] =
    await Promise.all([
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
  if (mediaTypeError || saleTypeError || !mediaType || !saleType) {
    return NextResponse.json(
      { message: 'ประเภทสื่อหรือประเภทการจำหน่ายไม่มีอยู่หรือถูกปิดใช้งาน' },
      { status: 400 }
    );
  }
  if (saleType.pricing_mode === 'free') price = 0;

  const { data: product, error } = await supabaseAdmin
    .from('marketplace_products')
    .insert({
      seller_id: seller.id,
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
      ...(caller.role === 'master_admin' && {
        reviewed_at: new Date().toISOString(),
        reviewed_by: caller.sub,
      }),
    })
    .select('*')
    .single();

  if (error || !product) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถลงสินค้าได้' },
      { status: 500 }
    );
  }

  if (product.status === 'pending_review') {
    await notifyMarketplaceAdmins({
      event: 'product_approval',
      sourceId: product.id,
      message: [
        '📚 มีสินค้ารออนุมัติ',
        `ชื่อสินค้า: ${product.title}`,
        `หมวดหมู่: ${product.category}`,
      ].join('\n'),
      actionUrl: `${new URL(request.url).origin}/dashboard/product-approvals`,
    });
  }

  return NextResponse.json({ product }, { status: 201 });
}
