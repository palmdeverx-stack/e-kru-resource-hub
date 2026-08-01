import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireRole, hasPayoutAccess } from 'src/lib/auth-token';

import { getFinanceSettings } from 'src/sections/marketplace/admin/server/finance';

type LicenseScope = 'individual' | 'school' | 'teacher' | 'platform';

type LicenseRow = {
  id: string;
  buyer_id?: string;
  school_id?: string;
  order_id: string;
  product_id: string;
  feature_keys: string[];
  starts_at: string;
  expires_at: string | null;
  status: string;
  license_scope?: LicenseScope;
  seat_count?: number;
  product: unknown;
  order: unknown;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function scheduledPayoutAt(availableAt: string | null, payoutDay: number) {
  if (!availableAt) return null;
  const bangkok = new Date(new Date(availableAt).getTime() + 7 * 60 * 60 * 1000);
  const delta = (payoutDay - bangkok.getUTCDay() + 7) % 7;
  bangkok.setUTCDate(bangkok.getUTCDate() + delta);
  bangkok.setUTCHours(0, 0, 0, 0);
  return new Date(bangkok.getTime() - 7 * 60 * 60 * 1000).toISOString();
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'เฉพาะ Master Admin เท่านั้น' }, { status: 403 });
  }
  if (!hasPayoutAccess(request, caller.sub)) {
    return NextResponse.json({ message: 'กรุณายืนยัน PIN เพื่อดูข้อมูลการเงิน' }, { status: 401 });
  }

  const licenseSelect =
    'id,order_id,product_id,feature_keys,starts_at,expires_at,status,product:marketplace_products(id,title,license_target_system,license_scope,license_billing_cycle),order:marketplace_orders(id,buyer_id,seller_id,status,total,currency,created_at,paid_at,payment_session:marketplace_payment_sessions(id,status,payment_method,amount,submitted_at,reviewed_at,bank_transaction_reference,stripe_payment_intent_id,stripe_subscription_id),seller:marketplace_sellers(id,display_name))';
  const [schoolResult, userResult, platformResult, finance] = await Promise.all([
    supabaseAdmin
      .from('marketplace_school_licenses')
      .select(`${licenseSelect},school_id,license_scope,seat_count`)
      .order('starts_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('marketplace_user_licenses')
      .select(`${licenseSelect},buyer_id`)
      .order('starts_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('marketplace_platform_licenses')
      .select(licenseSelect)
      .order('starts_at', { ascending: false })
      .limit(500),
    getFinanceSettings(),
  ]);

  const fatalError = schoolResult.error ?? userResult.error;
  const platformError = platformResult.error?.code === '42P01' ? null : platformResult.error;
  if (fatalError || platformError) {
    return NextResponse.json(
      { message: fatalError?.message ?? platformError?.message ?? 'โหลด License ไม่สำเร็จ' },
      { status: 500 }
    );
  }

  const scopedRows = [
    ...((userResult.data ?? []) as unknown as LicenseRow[]).map((row) => ({
      ...row,
      resolvedScope: 'individual' as const,
    })),
    ...((schoolResult.data ?? []) as unknown as LicenseRow[]).map((row) => ({
      ...row,
      resolvedScope: (row.license_scope ?? 'school') as LicenseScope,
    })),
    ...((platformResult.data ?? []) as unknown as LicenseRow[]).map((row) => ({
      ...row,
      resolvedScope: 'platform' as const,
    })),
  ];
  const orderIds = [...new Set(scopedRows.map((row) => row.order_id))];
  const buyerIds = [
    ...new Set(
      scopedRows
        .map((row) => {
          const order = one<{ buyer_id: string }>(
            row.order as { buyer_id: string } | { buyer_id: string }[] | null
          );
          return row.buyer_id ?? order?.buyer_id;
        })
        .filter((value): value is string => Boolean(value))
    ),
  ];

  const [{ data: appUsers }, { data: marketplaceUsers }, ledgerResult, subscriptionResult] =
    await Promise.all([
    buyerIds.length
      ? supabaseAdmin
          .from('app_users')
          .select('id,username,email,first_name,last_name,role')
          .in('id', buyerIds)
      : Promise.resolve({ data: [] }),
    buyerIds.length
      ? supabaseAdmin
          .from('marketplace_users')
          .select('id,username,email,first_name,last_name,role')
          .in('id', buyerIds)
      : Promise.resolve({ data: [] }),
      orderIds.length
      ? supabaseAdmin
          .from('marketplace_ledger_entries')
          .select(
            'order_id,amount,available_at,payout:marketplace_payouts(id,status,requested_at,processed_at,transfer_reference)'
          )
          .in('order_id', orderIds)
          .eq('account_scope', 'seller')
        : Promise.resolve({ data: [], error: null }),
      buyerIds.length
        ? supabaseAdmin
            .from('marketplace_license_subscriptions')
            .select('id,buyer_id,product_id,billing_cycle,status,current_period_end,cancel_at_period_end')
            .in('buyer_id', buyerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (ledgerResult.error || subscriptionResult.error) {
    return NextResponse.json(
      { message: ledgerResult.error?.message ?? subscriptionResult.error?.message },
      { status: 500 }
    );
  }

  const buyers = new Map<string, Record<string, unknown>>();
  for (const buyer of [...(marketplaceUsers ?? []), ...(appUsers ?? [])])
    buyers.set(buyer.id, buyer);
  const ledgerByOrder = new Map<string, typeof ledgerResult.data>();
  for (const entry of ledgerResult.data ?? []) {
    ledgerByOrder.set(entry.order_id, [...(ledgerByOrder.get(entry.order_id) ?? []), entry]);
  }
  const payoutDay = Number(finance.payout_day);

  const licenses = scopedRows
    .map((license) => {
      const order = one<Record<string, unknown>>(
        license.order as Record<string, unknown> | Record<string, unknown>[] | null
      );
      const buyerId = license.buyer_id ?? String(order?.buyer_id ?? '');
      const entries = ledgerByOrder.get(license.order_id) ?? [];
      const availableDates = entries
        .map((entry) => entry.available_at)
        .filter((value): value is string => Boolean(value))
        .sort();
      const payout = entries.map((entry) => one(entry.payout)).find(Boolean) ?? null;
      const availableAt = availableDates[0] ?? null;
      const nextScheduleBase =
        availableAt && new Date(availableAt).getTime() > Date.now()
          ? availableAt
          : new Date().toISOString();
      const payment = one<Record<string, unknown>>(
        order?.payment_session as
          | Record<string, unknown>
          | Record<string, unknown>[]
          | null
          | undefined
      );
      const recurring = (subscriptionResult.data ?? []).find(
        (item) => item.buyer_id === buyerId && item.product_id === license.product_id
      );
      return {
        id: license.id,
        scope: license.resolvedScope,
        status: license.status,
        featureKeys: license.feature_keys,
        startsAt: license.starts_at,
        expiresAt: license.expires_at,
        seatCount: license.seat_count ?? 1,
        schoolId: license.school_id ?? null,
        buyer: buyers.get(buyerId) ?? { id: buyerId, username: 'ไม่พบข้อมูลผู้ซื้อ' },
        product: one(license.product as unknown as Record<string, unknown>),
        order,
        payment,
        subscription: recurring ?? null,
        payout: {
          netAmount: entries.reduce((sum, entry) => sum + Number(entry.amount), 0),
          availableAt,
          scheduledAt:
            payout?.requested_at ??
            scheduledPayoutAt(availableAt ? nextScheduleBase : null, payoutDay),
          status: payout?.status ?? (availableDates.length ? 'not_created' : 'not_available'),
          requestedAt: payout?.requested_at ?? null,
          processedAt: payout?.processed_at ?? null,
          transferReference: payout?.transfer_reference ?? null,
        },
      };
    })
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  return NextResponse.json({
    licenses,
    summary: {
      total: licenses.length,
      active: licenses.filter(
        (license) =>
          license.status === 'active' &&
          (!license.expiresAt || new Date(license.expiresAt).getTime() > Date.now())
      ).length,
      perpetual: licenses.filter((license) => license.expiresAt == null).length,
      awaitingPayment: licenses.filter(
        (license) => !['verified'].includes(String(license.payment?.status ?? ''))
      ).length,
      awaitingPayout: licenses.filter((license) =>
        ['not_created', 'pending', 'processing'].includes(license.payout.status)
      ).length,
    },
    payoutPolicy: { payoutDay, holdDays: Number(finance.hold_days) },
  });
}
