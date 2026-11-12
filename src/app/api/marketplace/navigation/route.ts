import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { getMarketplaceShippingConfig } from 'src/sections/marketplace/shipping/server/config';

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const admin = ['master_admin', 'marketplace_admin'].includes(caller.role);
  const [shipping, seller, referral, line] = await Promise.all([
    getMarketplaceShippingConfig(),
    admin
      ? null
      : supabaseAdmin
          .from('marketplace_sellers')
          .select('status')
          .eq('owner_id', caller.sub)
          .maybeSingle(),
    admin
      ? null
      : supabaseAdmin
          .from('marketplace_referral_settings')
          .select('is_enabled')
          .eq('id', 'default')
          .maybeSingle(),
    admin
      ? null
      : supabaseAdmin
          .from('marketplace_line_settings')
          .select('allow_seller_notifications')
          .eq('id', 'default')
          .maybeSingle(),
  ]);
  const error =
    seller?.error ?? (referral?.error?.code === '42P01' ? null : referral?.error) ?? line?.error;
  if (error) return NextResponse.json({ message: 'โหลดเมนูไม่สำเร็จ' }, { status: 500 });
  return NextResponse.json(
    {
      hasSubmittedSeller: admin || Boolean(seller?.data?.status && seller.data.status !== 'draft'),
      shippingEnabled: shipping.enabled,
      officialShippingEnabled: shipping.officialAccessEnabled,
      referralEnabled: referral?.data?.is_enabled === true,
      canUseSellerLine: admin || line?.data?.allow_seller_notifications === true,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
