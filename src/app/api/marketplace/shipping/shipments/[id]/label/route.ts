import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { ownedSellerId } from 'src/sections/marketplace/seller/server/owned-seller';
import { fetchShippopLabel } from 'src/sections/marketplace/shipping/server/shippop-client';
import {
  getMarketplaceShippingConfig,
  isMarketplaceShippingEnabledForOfficialSeller,
} from 'src/sections/marketplace/shipping/server/config';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const { id } = await context.params;
  const seller = await ownedSellerId(caller.sub, caller.role);
  const { data: shipment } = await supabaseAdmin
    .from('marketplace_shipments')
    .select('id,tracking_code,seller_id,buyer_id,seller:marketplace_sellers(owner_role)')
    .eq('id', id)
    .maybeSingle();
  const shipmentSeller: any = Array.isArray(shipment?.seller)
    ? shipment.seller[0]
    : shipment?.seller;
  const shippingConfig = await getMarketplaceShippingConfig();
  if (
    !shipment ||
    !isMarketplaceShippingEnabledForOfficialSeller(shippingConfig, shipmentSeller?.owner_role)
  ) {
    return NextResponse.json({ message: 'ระบบจัดส่งยังไม่เปิดใช้งาน' }, { status: 503 });
  }
  if (
    (shipment.buyer_id !== caller.sub && shipment.seller_id !== seller?.id) ||
    !shipment.tracking_code
  ) {
    return NextResponse.json({ message: 'ไม่พบใบปะหน้า' }, { status: 404 });
  }
  try {
    const label = await fetchShippopLabel(shipment.tracking_code, shippingConfig.environment);
    return new NextResponse(label.body, {
      headers: {
        'Content-Type': label.contentType,
        'Content-Disposition': `inline; filename="shipping-label-${shipment.id}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'โหลดใบปะหน้าไม่สำเร็จ' },
      { status: 502 }
    );
  }
}
