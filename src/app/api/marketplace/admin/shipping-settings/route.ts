import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';
import { requireRole, hasPayoutAccess } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { getMarketplaceShippingConfig } from 'src/sections/marketplace/shipping/server/config';
import { getShippingFinanceSummary } from 'src/sections/marketplace/shipping/server/accounting';

function authorize(request: Request) {
  return requireRole(request, ['master_admin', 'marketplace_admin']);
}

export async function GET(request: Request) {
  const caller = authorize(request);
  if (!caller)
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตั้งค่าการจัดส่ง' }, { status: 403 });
  const origin = new URL(request.url).origin;
  const canViewFinance = caller.role === 'master_admin' && hasPayoutAccess(request, caller.sub);
  const [settings, financeSummary, shipmentsResult] = await Promise.all([
    getMarketplaceShippingConfig(origin),
    canViewFinance ? getShippingFinanceSummary() : Promise.resolve(null),
    canViewFinance
      ? supabaseAdmin
          .from('marketplace_shipments')
          .select(
            'id,tracking_code,courier_tracking_code,courier_name,shipping_fee,provider_fee,payment_fee_allocated,refunded_amount,reconciliation_status,created_at'
          )
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (shipmentsResult.error) {
    return NextResponse.json({ message: shipmentsResult.error.message }, { status: 500 });
  }
  return NextResponse.json({
    settings,
    financeSummary,
    recentShipments: shipmentsResult.data ?? [],
    financeAccessRequired: caller.role === 'master_admin' && !canViewFinance,
  });
}

export async function PATCH(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = authorize(request);
  if (!caller)
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตั้งค่าการจัดส่ง' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const isEnabled = body?.isEnabled === true;
  const environment = body?.environment === 'production' ? 'production' : 'sandbox';
  const current = await getMarketplaceShippingConfig();
  if (isEnabled && !current.providerConfigured) {
    return NextResponse.json(
      {
        message:
          'ยังเปิดไม่ได้ กรุณาตั้งค่า SHIPPOP API, อีเมลบัญชี, Quote Secret และ Webhook Secret ให้ครบ',
      },
      { status: 409 }
    );
  }
  const { error } = await supabaseAdmin.from('marketplace_shipping_settings').upsert({
    id: 'default',
    is_enabled: isEnabled,
    provider: 'shippop',
    environment,
    updated_by: caller.sub,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'admin',
    action: 'marketplace.shipping_settings_update',
    targetType: 'shipping_settings',
    targetId: 'default',
    result: 'success',
    metadata: {
      before: { enabled: current.requestedEnabled },
      after: { enabled: isEnabled, environment },
    },
  });
  return NextResponse.json({
    settings: await getMarketplaceShippingConfig(new URL(request.url).origin),
  });
}
