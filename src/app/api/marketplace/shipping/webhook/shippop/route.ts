import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { reconcileShippingProviderFee } from 'src/sections/marketplace/shipping/server/accounting';

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function mapStatus(status: string) {
  if (status === 'complete') return 'complete';
  if (status.startsWith('return')) return 'return';
  if (status === 'problem' || status === 'invalid') return 'problem';
  if (status === 'shipping' || status === 'package_detail') return 'shipping';
  if (status === 'booking' || status === 'paid') return 'booking';
  return 'ready';
}

export async function POST(request: Request) {
  const configuredSecret = process.env.SHIPPOP_WEBHOOK_SECRET ?? '';
  const suppliedSecret =
    request.headers.get('x-shippop-webhook-secret') ??
    new URL(request.url).searchParams.get('token') ??
    '';
  if (!configuredSecret || !safeEqual(configuredSecret, suppliedSecret)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const contentType = request.headers.get('content-type') ?? '';
  const body: any = contentType.includes('application/json')
    ? await request.json().catch(() => null)
    : Object.fromEntries(await request.formData());
  const trackingCode = String(body?.tracking_code ?? '');
  const providerStatus = String(body?.order_status ?? '');
  const courierTrackingCode = String(body?.courier_tracking_code ?? '').trim();
  const providerFee = Number(
    body?.data?.total_price ??
      body?.data?.price ??
      body?.['data[total_price]'] ??
      body?.['data[price]'] ??
      Number.NaN
  );
  if (!trackingCode || !providerStatus)
    return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
  const { data: shipment } = await supabaseAdmin
    .from('marketplace_shipments')
    .select('id')
    .eq('tracking_code', trackingCode)
    .maybeSingle();
  if (!shipment) return NextResponse.json({ success: 1 });
  const status = mapStatus(providerStatus);
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('marketplace_shipments')
    .update({
      status,
      updated_at: now,
      ...(courierTrackingCode ? { courier_tracking_code: courierTrackingCode } : {}),
      ...(status === 'complete' ? { completed_at: now } : {}),
    })
    .eq('id', shipment.id);
  if (Number.isFinite(providerFee) && providerFee >= 0) {
    await reconcileShippingProviderFee({
      shipmentId: shipment.id,
      actualFee: providerFee,
      reference: `${trackingCode}:${providerStatus}:${String(
        body?.data?.datetime ?? body?.['data[datetime]'] ?? ''
      )}`,
      source: 'webhook',
    });
  }
  await supabaseAdmin.from('marketplace_shipment_events').insert({
    shipment_id: shipment.id,
    status,
    message: String(body?.['data[message]'] ?? body?.message ?? ''),
    payload: body,
    occurred_at: String(body?.['data[datetime]'] ?? now),
  });
  return NextResponse.json({ success: 1 });
}
