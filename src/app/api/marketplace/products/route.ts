import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

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
    .select('*, seller:marketplace_sellers(id, display_name, seller_type)')
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

  return NextResponse.json({ products: products ?? [] });
}

export async function POST(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const { data: seller } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, status')
    .eq('owner_id', caller.sub)
    .maybeSingle();

  if (!seller || seller.status !== 'active') {
    return NextResponse.json({ message: 'กรุณาเปิดร้านค้าก่อนลงสินค้า' }, { status: 403 });
  }

  const body = await request.json();
  const title = String(body.title ?? '').trim();
  const description = String(body.description ?? '').trim();
  const category = String(body.category ?? '').trim();
  const resourceType = ['digital', 'physical', 'service'].includes(body.resourceType)
    ? body.resourceType
    : 'digital';
  const price = Number(body.price);
  const coverUrl = String(body.coverUrl ?? '').trim();
  const fileUrl = String(body.fileUrl ?? '').trim();

  if (
    title.length < 3 ||
    description.length < 10 ||
    !category ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return NextResponse.json(
      { message: 'กรุณากรอกชื่อ รายละเอียด หมวดหมู่ และราคาให้ถูกต้อง' },
      { status: 400 }
    );
  }

  const { data: product, error } = await supabaseAdmin
    .from('marketplace_products')
    .insert({
      seller_id: seller.id,
      title,
      description,
      category,
      resource_type: resourceType,
      price,
      cover_url: coverUrl || null,
      file_url: fileUrl || null,
      status: 'published',
    })
    .select('*')
    .single();

  if (error || !product) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถลงสินค้าได้' },
      { status: 500 }
    );
  }

  return NextResponse.json({ product }, { status: 201 });
}
