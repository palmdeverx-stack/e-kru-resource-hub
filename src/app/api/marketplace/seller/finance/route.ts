import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { revealPayoutSnapshot } from 'src/lib/financial-data-cipher';

import { getFinanceSettings } from 'src/sections/marketplace/admin/server/finance';

type BuyerInfo = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  school: { id: string; name: string } | null;
};

async function getBuyers(buyerIds: string[]) {
  const buyers = new Map<string, BuyerInfo>();
  if (!buyerIds.length) return buyers;

  const [{ data: marketplaceUsers }, { data: appUsers }] = await Promise.all([
    supabaseAdmin
      .from('marketplace_users')
      .select('id, display_name, first_name, last_name, username, email, avatar_url')
      .in('id', buyerIds),
    supabaseAdmin
      .from('app_users')
      .select(
        'id, first_name, last_name, username, email, avatar_url, school:schools!app_users_school_id_fkey(id,name)'
      )
      .in('id', buyerIds),
  ]);

  for (const user of marketplaceUsers ?? []) {
    buyers.set(user.id, {
      id: user.id,
      name:
        user.display_name?.trim() ||
        `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() ||
        user.username,
      email: user.email ?? null,
      avatar_url: user.avatar_url ?? null,
      school: null,
    });
  }
  for (const user of appUsers ?? []) {
    if (buyers.has(user.id)) continue;
    const school = Array.isArray(user.school) ? user.school[0] : user.school;
    buyers.set(user.id, {
      id: user.id,
      name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username,
      email: user.email ?? null,
      avatar_url: user.avatar_url ?? null,
      school: school ? { id: school.id, name: school.name } : null,
    });
  }
  return buyers;
}

function bangkokDateParts(value: Date | string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function bangkokDateKey(value: Date | string) {
  const { year, month, day } = bangkokDateParts(value);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function nextPayoutDate(payoutDay: number) {
  const { year, month, day } = bangkokDateParts(new Date());
  const date = new Date(Date.UTC(year, month - 1, day, 2));
  const daysUntilNextRun = (payoutDay - date.getUTCDay() + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilNextRun);
  return date.toISOString();
}

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const { data: seller } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, display_name, status, owner_role, commission_rate_override')
    .eq('owner_id', caller.sub)
    .maybeSingle();
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });

  const now = new Date().toISOString();
  const canViewPaymentTransactions =
    caller.role === 'marketplace_admin' || caller.role === 'master_admin';
  const canViewPayoutHistory = canViewPaymentTransactions;
  const canViewBuyerDetails = caller.role === 'master_admin';
  const [
    { data: ledger, error: ledgerError },
    { data: payouts, error: payoutError },
    { data: orders, error: orderError },
    finance,
  ] = await Promise.all([
    supabaseAdmin
      .from('marketplace_ledger_entries')
      .select(
        'id, order_id, amount, currency, entry_type, description, available_at, payout_id, created_at, order:marketplace_orders(id, buyer_id, gross_amount, platform_fee, payment_fee, seller_net, status, created_at, items:marketplace_order_items(id, title, quantity, unit_price, product:marketplace_products(id, title, title_en)))'
      )
      .eq('seller_id', seller.id)
      .eq('account_scope', 'seller')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('marketplace_payouts')
      .select('*')
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('marketplace_orders')
      .select(
        'id, buyer_id, payment_session_id, gross_amount, platform_fee, payment_fee, seller_net, status, currency, paid_at, available_at, created_at, items:marketplace_order_items(id, title, quantity, unit_price, product:marketplace_products(id, title, title_en)), payment_session:marketplace_payment_sessions(id, payment_method, status, bank_transaction_reference, stripe_payment_intent_id)'
      )
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false }),
    getFinanceSettings(),
  ]);
  const loadError = ledgerError ?? payoutError ?? orderError;
  if (loadError) return NextResponse.json({ message: loadError.message }, { status: 500 });

  const rows = ledger ?? [];
  const orderRows = orders ?? [];
  const buyerIds = [
    ...new Set(
      orderRows
        .map((order) => order.buyer_id)
        .filter((buyerId): buyerId is string => typeof buyerId === 'string' && Boolean(buyerId))
    ),
  ];
  const buyers = canViewBuyerDetails ? await getBuyers(buyerIds) : new Map<string, BuyerInfo>();
  const withBuyer = <T extends { buyer_id?: string | null }>(order: T) => ({
    ...order,
    buyer:
      canViewBuyerDetails && order.buyer_id
        ? (buyers.get(order.buyer_id) ?? {
            id: order.buyer_id,
            name: `ผู้ซื้อ #${order.buyer_id.slice(0, 8)}`,
            email: null,
            avatar_url: null,
            school: null,
          })
        : null,
  });
  const ordersWithBuyers = orderRows.map(withBuyer);
  const ledgerWithBuyers = rows.map((entry) => ({
    ...entry,
    order: Array.isArray(entry.order)
      ? entry.order.map(withBuyer)
      : entry.order
        ? withBuyer(entry.order)
        : null,
  }));
  const hideBuyer = <T extends { buyer_id?: string | null; buyer?: BuyerInfo | null }>(
    order: T
  ) => ({
    ...order,
    buyer_id: null,
    buyer: null,
  });
  const ledgerForResponse = canViewBuyerDetails
    ? ledgerWithBuyers
    : ledgerWithBuyers.map((entry) => ({
        ...entry,
        order: Array.isArray(entry.order)
          ? entry.order.map(hideBuyer)
          : entry.order
            ? hideBuyer(entry.order)
            : null,
      }));
  const available = rows
    .filter((row) => !row.payout_id && row.available_at && row.available_at <= now)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const pending = rows
    .filter((row) => !row.payout_id && (!row.available_at || row.available_at > now))
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const paid = (payouts ?? [])
    .filter((payout) => payout.status === 'paid')
    .reduce((sum, payout) => sum + Number(payout.amount), 0);
  const processing = (payouts ?? [])
    .filter((payout) => ['pending', 'processing'].includes(payout.status))
    .reduce((sum, payout) => sum + Number(payout.amount), 0);
  const successfulOrders = orderRows.filter((order) =>
    ['paid', 'completed'].includes(order.status)
  );
  const effectiveCommissionRate =
    seller.owner_role === 'master_admin' || seller.owner_role === 'marketplace_admin'
      ? 0
      : Number(seller.commission_rate_override ?? finance.commission_rate);
  const grossSales = successfulOrders.reduce((sum, order) => sum + Number(order.gross_amount), 0);
  const underReview = orderRows
    .filter((order) =>
      ['pending', 'pending_payment', 'payment_review', 'payment_rejected'].includes(order.status)
    )
    .reduce((sum, order) => sum + Number(order.gross_amount), 0);
  const nowDate = new Date();
  const todayKey = bangkokDateKey(nowDate);
  const monthKey = todayKey.slice(0, 7);
  const paidOn = (order: (typeof successfulOrders)[number]) =>
    bangkokDateKey(String(order.paid_at ?? order.created_at));
  const todayIncome = successfulOrders
    .filter((order) => paidOn(order) === todayKey)
    .reduce((sum, order) => sum + Number(order.seller_net), 0);
  const monthIncome = successfulOrders
    .filter((order) => paidOn(order).slice(0, 7) === monthKey)
    .reduce((sum, order) => sum + Number(order.seller_net), 0);

  return NextResponse.json({
    seller,
    canViewPaymentTransactions,
    canViewPayoutHistory,
    canViewBuyerDetails,
    balance: {
      grossSales,
      underReview,
      available,
      pending,
      processing,
      paid,
      todayIncome,
      monthIncome,
    },
    schedule: {
      payoutDay: Number(finance.payout_day),
      minimumPayout: Number(finance.minimum_payout),
      holdDays: Number(finance.hold_days),
      commissionRate: effectiveCommissionRate,
      commissionSource:
        seller.owner_role === 'master_admin' || seller.owner_role === 'marketplace_admin'
          ? 'system_store'
          : seller.commission_rate_override === null
            ? 'default'
            : 'seller_override',
      nextPayoutAt: nextPayoutDate(Number(finance.payout_day)),
    },
    orders: ordersWithBuyers.map((order) => ({
      ...(canViewBuyerDetails ? order : hideBuyer(order)),
      ...(!canViewPaymentTransactions && {
        payment_session_id: null,
        payment_session: null,
      }),
    })),
    ledger: ledgerForResponse,
    payouts: canViewPayoutHistory
      ? (payouts ?? []).map((payout) => revealPayoutSnapshot(payout))
      : [],
  });
}
