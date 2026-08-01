import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { absoluteMarketplaceUrl } from 'src/sections/marketplace/seo/site-url';

import { money, getFinanceSettings } from './finance';
import { notifyMarketplaceAdmins } from './line-notifications';

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const THAI_WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function getBangkokDate() {
  const date = new Date(Date.now() + BANGKOK_OFFSET_MS);
  return {
    date,
    dateKey: date.toISOString().slice(0, 10),
    weekday: date.getUTCDay(),
  };
}

function formatThaiDate(date: Date) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(date.getTime() - BANGKOK_OFFSET_MS));
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(amount);
}

export async function processMarketplacePayoutReminder() {
  const { date, dateKey, weekday } = getBangkokDate();
  const finance = await getFinanceSettings();
  const payoutDay = Number(finance.payout_day);

  if (weekday !== payoutDay) {
    return {
      status: 'not_payout_day' as const,
      date: dateKey,
      payoutDay,
      currentDay: weekday,
    };
  }

  const now = new Date().toISOString();
  const [{ data: entries, error: entriesError }, { data: openPayouts, error: payoutsError }] =
    await Promise.all([
      supabaseAdmin
        .from('marketplace_ledger_entries')
        .select('seller_id, amount')
        .eq('account_scope', 'seller')
        .is('payout_id', null)
        .lte('available_at', now),
      supabaseAdmin
        .from('marketplace_payouts')
        .select('amount')
        .in('status', ['pending', 'processing']),
    ]);
  if (entriesError) throw entriesError;
  if (payoutsError) throw payoutsError;

  const totals = new Map<string, number>();
  for (const entry of entries ?? []) {
    if (!entry.seller_id) continue;
    totals.set(entry.seller_id, money((totals.get(entry.seller_id) ?? 0) + Number(entry.amount)));
  }

  const sellerIds = [...totals.keys()];
  const { data: accounts, error: accountsError } = sellerIds.length
    ? await supabaseAdmin
        .from('marketplace_seller_payout_accounts')
        .select('seller_id')
        .in('seller_id', sellerIds)
    : { data: [], error: null };
  if (accountsError) throw accountsError;

  const accountSellerIds = new Set((accounts ?? []).map((account) => account.seller_id));
  const minimumPayout = Number(finance.minimum_payout);
  const readyAmounts = [...totals.entries()]
    .filter(([sellerId, amount]) => accountSellerIds.has(sellerId) && amount >= minimumPayout)
    .map(([, amount]) => amount);
  const needsAttention = [...totals.entries()].filter(
    ([sellerId, amount]) => amount > 0 && (!accountSellerIds.has(sellerId) || amount < minimumPayout)
  ).length;
  const readyTotal = money(readyAmounts.reduce((sum, amount) => sum + amount, 0));
  const openTotal = money((openPayouts ?? []).reduce((sum, payout) => sum + Number(payout.amount), 0));
  const actionUrl = absoluteMarketplaceUrl('/dashboard/payouts');
  const lines = [
    `แจ้งเตือนวันทำรอบโอน: วัน${THAI_WEEKDAYS[weekday]}ที่ ${formatThaiDate(date)}`,
    `พร้อมสร้างรอบ ${readyAmounts.length.toLocaleString('th-TH')} ร้าน รวม ${formatMoney(readyTotal)}`,
    `รอยืนยันการโอน ${(openPayouts ?? []).length.toLocaleString('th-TH')} รายการ รวม ${formatMoney(openTotal)}`,
  ];
  if (needsAttention > 0) {
    lines.push(`ต้องตรวจสอบบัญชีหรือยอดขั้นต่ำ ${needsAttention.toLocaleString('th-TH')} ร้าน`);
  }

  const notification = await notifyMarketplaceAdmins({
    event: 'payout_due',
    sourceId: '',
    dedupeKey: `payout_due:${dateKey}`,
    title: 'ถึงวันทำรอบโอนเงินผู้ขาย',
    message: lines.join('\n'),
    actionUrl,
  });

  return {
    status: notification?.status ?? 'unknown',
    date: dateKey,
    readySellerCount: readyAmounts.length,
    readyTotal,
    openPayoutCount: (openPayouts ?? []).length,
    openTotal,
    needsAttention,
  };
}
