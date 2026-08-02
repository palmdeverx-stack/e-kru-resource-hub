import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { ownedSellerId } from 'src/sections/marketplace/seller/server/owned-seller';
import { bookShippopShipment } from 'src/sections/marketplace/shipping/server/shippop-client';
import { reconcileShippingProviderFee } from 'src/sections/marketplace/shipping/server/accounting';
import {
  getMarketplaceShippingConfig,
  isMarketplaceShippingEnabledForOfficialSeller,
} from 'src/sections/marketplace/shipping/server/config';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const shippingConfig = await getMarketplaceShippingConfig();
  if (!isMarketplaceShippingEnabledForOfficialSeller(shippingConfig, caller.role)) {
    return NextResponse.json({ message: 'ระบบจัดส่งยังไม่เปิดใช้งาน' }, { status: 503 });
  }
  if (
    !(await isActionAllowed({
      request,
      action: 'marketplace-shipping-prepare',
      subject: caller.sub,
      maxAttempts: 10,
      windowSeconds: 10 * 60,
    }))
  ) {
    return NextResponse.json({ message: 'สร้างพัสดุบ่อยเกินไป กรุณารอสักครู่' }, { status: 429 });
  }
  const seller = await ownedSellerId(caller.sub, caller.role);
  if (!seller) return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการพัสดุ' }, { status: 403 });
  const { id } = await context.params;
  const { data: shipment } = await supabaseAdmin
    .from('marketplace_shipments')
    .select('*,order:marketplace_orders(status)')
    .eq('id', id)
    .eq('seller_id', seller.id)
    .maybeSingle();
  const order: any = Array.isArray(shipment?.order) ? shipment.order[0] : shipment?.order;
  if (
    !shipment ||
    !['paid', 'completed'].includes(order?.status) ||
    shipment.status !== 'pending'
  ) {
    return NextResponse.json({ message: 'พัสดุไม่พร้อมสร้างรายการจัดส่ง' }, { status: 409 });
  }
  const { data: locked } = await supabaseAdmin
    .from('marketplace_shipments')
    .update({ status: 'ready', updated_at: new Date().toISOString() })
    .eq('id', shipment.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (!locked) {
    return NextResponse.json({ message: 'พัสดุกำลังถูกสร้างหรือสร้างแล้ว' }, { status: 409 });
  }
  try {
    const result = await bookShippopShipment({
      sender: shipment.sender_snapshot,
      receiver: shipment.receiver_snapshot,
      parcel: shipment.package_snapshot,
      courierCode: shipment.courier_code,
      environment: shippingConfig.environment,
    });
    if (!result.trackingCode) throw new Error('SHIPPOP ไม่ได้ส่ง Tracking Code กลับมา');
    const { data: updated, error } = await supabaseAdmin
      .from('marketplace_shipments')
      .update({
        provider_order_id: result.providerOrderId || null,
        tracking_code: result.trackingCode,
        courier_tracking_code: result.courierTrackingCode || null,
        status: 'booking',
        booked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', shipment.id)
      .eq('status', 'ready')
      .select('*')
      .single();
    if (error) throw error;
    await supabaseAdmin
      .from('marketplace_shipment_events')
      .insert({ shipment_id: shipment.id, status: 'booking', message: 'สร้างรายการจัดส่งแล้ว' });
    let accountingPending = false;
    if (Number.isFinite(result.providerFee) && result.providerFee >= 0) {
      await reconcileShippingProviderFee({
        shipmentId: shipment.id,
        actualFee: result.providerFee,
        reference: result.providerOrderId || result.trackingCode,
        source: 'booking',
      }).catch(() => {
        accountingPending = true;
      });
    } else {
      accountingPending = true;
    }
    return NextResponse.json({ shipment: updated, accountingPending });
  } catch (error) {
    await supabaseAdmin
      .from('marketplace_shipments')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', shipment.id)
      .eq('status', 'ready');
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'สร้างรายการจัดส่งไม่สำเร็จ' },
      { status: 502 }
    );
  }
}
