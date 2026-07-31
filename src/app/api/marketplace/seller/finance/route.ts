import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { getFinanceSettings } from 'src/sections/marketplace/admin/server/finance';

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
    caller.role === 'super_admin' || caller.role === 'master_admin';
  const [
    { data: ledger, error: ledgerError },
    { data: payouts, error: payoutError },
    { data: orders, error: orderError },
    finance,
  ] = await Promise.all([
    supabaseAdmin
      .from('marketplace_ledger_entries')
      .select(
        'id, order_id, amount, currency, entry_type, description, available_at, payout_id, created_at, order:marketplace_orders(id, gross_amount, platform_fee, payment_fee, seller_net, status, created_at, items:marketplace_order_items(id, title, quantity, unit_price, product:marketplace_products(title, title_en)))'
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
        'id, payment_session_id, gross_amount, platform_fee, payment_fee, seller_net, status, currency, paid_at, available_at, created_at, items:marketplace_order_items(id, title, quantity, unit_price, product:marketplace_products(title, title_en)), payment_session:marketplace_payment_sessions(id, payment_method, status, bank_transaction_reference, stripe_payment_intent_id)'
      )
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false }),
    getFinanceSettings(),
  ]);
  const loadError = ledgerError ?? payoutError ?? orderError;
  if (loadError) return NextResponse.json({ message: loadError.message }, { status: 500 });

  const rows = ledger ?? [];
  const orderRows = orders ?? [];
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
    seller.owner_role === 'master_admin' || seller.owner_role === 'super_admin'
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
        seller.owner_role === 'master_admin' || seller.owner_role === 'super_admin'
          ? 'system_store'
          : seller.commission_rate_override === null
            ? 'default'
            : 'seller_override',
      nextPayoutAt: nextPayoutDate(Number(finance.payout_day)),
    },
    orders: canViewPaymentTransactions
      ? orderRows
      : orderRows.map((order) => ({
          ...order,
          payment_session_id: null,
          payment_session: null,
        })),
    ledger: rows,
    payouts: payouts ?? [],
  });
}
