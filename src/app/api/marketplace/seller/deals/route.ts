import { NextResponse } from 'next/server';

import { parseBangkokDateTime } from 'src/utils/timezone';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

import { ownedSellerId } from 'src/sections/marketplace/seller/server/owned-seller';
import { MARKETPLACE_MINIMUM_PAID_PRICE_THB } from 'src/sections/marketplace/shared/payment';

const DEAL_SELECT =
  '*, product:marketplace_products(id,title,title_en,price,resource_type,license_scope,status), school:schools(id,name,code)';

export async function GET(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'เมนูนี้สำหรับ Super Admin เท่านั้น' }, { status: 403 });
  }
  const seller = await ownedSellerId(caller.sub);
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('marketplace_sales_deals')
    .select(DEAL_SELECT)
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json(
      {
        message:
          error.code === '42P01'
            ? 'กรุณาติดตั้ง schema marketplace_sales_deals เวอร์ชันล่าสุด'
            : error.message,
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ deals: data ?? [] });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'เมนูนี้สำหรับ Super Admin เท่านั้น' }, { status: 403 });
  }
  const seller = await ownedSellerId(caller.sub);
  if (!seller || seller.status !== 'active') {
    return NextResponse.json({ message: 'ร้านต้องเปิดใช้งานก่อนสร้างข้อเสนอ' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const productId = String(body?.productId ?? '').trim();
  const { data: product } = await supabaseAdmin
    .from('marketplace_products')
    .select('id,title,price,resource_type,license_scope')
    .eq('id', productId)
    .eq('seller_id', seller.id)
    .eq('status', 'published')
    .maybeSingle();
  if (!product) {
    return NextResponse.json(
      { message: 'เลือกได้เฉพาะสินค้าที่เผยแพร่แล้วของร้านนี้' },
      { status: 400 }
    );
  }

  const schoolName = String(body?.schoolName ?? '').trim();
  const schoolCode = String(body?.schoolCode ?? '').replace(/\D/g, '');
  const schoolEmail = String(body?.schoolEmail ?? '')
    .trim()
    .toLowerCase();
  const contactName = String(body?.contactName ?? '').trim();
  const negotiatedPrice = Number(body?.negotiatedPrice);
  const expiresAt = parseBangkokDateTime(String(body?.expiresAt ?? ''));
  if (
    schoolName.length < 2 ||
    contactName.length < 2 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(schoolEmail) ||
    !Number.isFinite(negotiatedPrice) ||
    negotiatedPrice < MARKETPLACE_MINIMUM_PAID_PRICE_THB ||
    negotiatedPrice > Number(product.price) ||
    !expiresAt ||
    expiresAt <= new Date() ||
    (product.resource_type === 'feature_unlock' &&
      ['school', 'teacher'].includes(product.license_scope) &&
      !/^\d{8}$/.test(schoolCode))
  ) {
    return NextResponse.json(
      {
        message: `กรุณากรอกข้อมูลให้ถูกต้อง โดยราคาหลังส่วนลดต้องไม่น้อยกว่า ${MARKETPLACE_MINIMUM_PAID_PRICE_THB} บาท`,
      },
      { status: 400 }
    );
  }

  const listPrice = Number(product.price);
  const terms =
    String(body?.terms ?? '').trim() ||
    `ข้อเสนอสำหรับ ${product.title} จำนวน 1 สิทธิ์ ราคา ${negotiatedPrice.toLocaleString('th-TH')} บาท สิทธิ์เริ่มหลังยืนยันการชำระเงิน`;
  const { data: deal, error } = await supabaseAdmin
    .from('marketplace_sales_deals')
    .insert({
      seller_id: seller.id,
      product_id: product.id,
      school_name: schoolName,
      school_code: schoolCode || null,
      school_email: schoolEmail,
      contact_name: contactName,
      contact_position: String(body?.contactPosition ?? '').trim() || null,
      contact_phone: String(body?.contactPhone ?? '').trim() || null,
      list_price: listPrice,
      discount_amount: Math.max(0, listPrice - negotiatedPrice),
      negotiated_price: negotiatedPrice,
      terms_snapshot: terms,
      expires_at: expiresAt.toISOString(),
      status: body?.sendNow === true ? 'sent' : 'draft',
    })
    .select(DEAL_SELECT)
    .single();
  if (error || !deal) {
    return NextResponse.json(
      { message: error?.message ?? 'สร้างข้อเสนอไม่สำเร็จ' },
      { status: 500 }
    );
  }
  return NextResponse.json({ deal, quotePath: `/quotes/${deal.public_token}` }, { status: 201 });
}
