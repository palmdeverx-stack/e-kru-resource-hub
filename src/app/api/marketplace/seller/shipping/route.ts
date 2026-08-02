import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { ownedSellerId } from 'src/sections/marketplace/seller/server/owned-seller';
import {
  getMarketplaceShippingConfig,
  isMarketplaceShippingSetupEnabledForOfficialSeller,
} from 'src/sections/marketplace/shipping/server/config';

async function authorize(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return null;
  const seller = await ownedSellerId(caller.sub, caller.role);
  return seller ? { caller, seller } : null;
}

async function shippingAllowed(role: string) {
  const config = await getMarketplaceShippingConfig();
  return isMarketplaceShippingSetupEnabledForOfficialSeller(config, role);
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!auth) return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการการจัดส่ง' }, { status: 403 });
  if (!(await shippingAllowed(auth.caller.role))) {
    return NextResponse.json({ message: 'ไม่พบหน้านี้' }, { status: 404 });
  }
  const [{ data: seller }, { data: shipments, error }] = await Promise.all([
    supabaseAdmin
      .from('marketplace_sellers')
      .select(
        'shipping_contact_name,shipping_phone,shipping_address_line,shipping_subdistrict,shipping_district,shipping_province,shipping_postal_code'
      )
      .eq('id', auth.seller.id)
      .single(),
    supabaseAdmin
      .from('marketplace_shipments')
      .select('*,order:marketplace_orders(id,status,created_at,total)')
      .eq('seller_id', auth.seller.id)
      .order('created_at', { ascending: false }),
  ]);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ seller, shipments: shipments ?? [] });
}

export async function PATCH(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const auth = await authorize(request);
  if (!auth) return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการการจัดส่ง' }, { status: 403 });
  if (!(await shippingAllowed(auth.caller.role))) {
    return NextResponse.json({ message: 'ระบบจัดส่งยังไม่เปิดใช้งาน' }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const value = {
    shipping_contact_name: String(body?.contactName ?? '').trim(),
    shipping_phone: String(body?.phone ?? '').replace(/\D/g, ''),
    shipping_address_line: String(body?.address ?? '').trim(),
    shipping_subdistrict: String(body?.subdistrict ?? '').trim(),
    shipping_district: String(body?.district ?? '').trim(),
    shipping_province: String(body?.province ?? '').trim(),
    shipping_postal_code: String(body?.postalCode ?? '').replace(/\D/g, ''),
    updated_at: new Date().toISOString(),
  };
  if (
    Object.values(value).some((field) => !field) ||
    !/^0\d{8,9}$/.test(value.shipping_phone) ||
    !/^\d{5}$/.test(value.shipping_postal_code)
  ) {
    return NextResponse.json(
      { message: 'กรอกที่อยู่ต้นทางและเบอร์โทรให้ครบถ้วน' },
      { status: 400 }
    );
  }
  const { error } = await supabaseAdmin
    .from('marketplace_sellers')
    .update(value)
    .eq('id', auth.seller.id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
