import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireRole, hasPayoutAccess } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import {
  revealPayoutAccount,
  revealPayoutSnapshot,
  encryptFinancialValue,
} from 'src/lib/financial-data-cipher';

import { money, getFinanceSettings } from 'src/sections/marketplace/admin/server/finance';

function getPayoutSchedule(payoutDay: number) {
  const bangkokNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const currentDay = bangkokNow.getUTCDay();
  const daysUntilPayout = (payoutDay - currentDay + 7) % 7;
  const nextPayout = new Date(bangkokNow);
  nextPayout.setUTCDate(nextPayout.getUTCDate() + daysUntilPayout);
  nextPayout.setUTCHours(0, 0, 0, 0);

  return {
    payoutDay,
    isPayoutDay: currentDay === payoutDay,
    nextPayoutAt: new Date(nextPayout.getTime() - 7 * 60 * 60 * 1000).toISOString(),
  };
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการการโอนเงิน' }, { status: 403 });
  }
  if (!hasPayoutAccess(request, caller.sub)) {
    return NextResponse.json({ message: 'กรุณายืนยันรหัสเข้าใช้งานอีกครั้ง' }, { status: 401 });
  }
  const now = new Date().toISOString();
  const [{ data: entries, error }, { data: payouts }, finance, { data: operator }] =
    await Promise.all([
      supabaseAdmin
        .from('marketplace_ledger_entries')
        .select('id, seller_id, amount, available_at')
        .eq('account_scope', 'seller')
        .is('payout_id', null)
        .lte('available_at', now),
      supabaseAdmin
        .from('marketplace_payouts')
        .select('*, seller:marketplace_sellers(id, display_name)')
        .order('created_at', { ascending: false })
        .limit(50),
      getFinanceSettings(),
      supabaseAdmin
        .from('app_users')
        .select('id, username, email, first_name, last_name, avatar_url, role')
        .eq('id', caller.sub)
        .maybeSingle(),
    ]);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const sellerIds = [...new Set((entries ?? []).map((entry) => entry.seller_id))];
  const { data: sellers } = sellerIds.length
    ? await supabaseAdmin
        .from('marketplace_sellers')
        .select('id, display_name, payout_account:marketplace_seller_payout_accounts(*)')
        .in('id', sellerIds)
    : { data: [] };
  const sellerRecords = new Map((sellers ?? []).map((seller) => [seller.id, seller]));
  const sellerMap = new Map<string, { seller: unknown; account: unknown; amount: number }>();
  for (const entry of entries ?? []) {
    const sellerRecord = sellerRecords.get(entry.seller_id);
    const current = sellerMap.get(entry.seller_id) ?? {
      seller: sellerRecord
        ? { id: sellerRecord.id, display_name: sellerRecord.display_name }
        : null,
      account: revealPayoutAccount(
        Array.isArray(sellerRecord?.payout_account)
          ? sellerRecord.payout_account[0]
          : sellerRecord?.payout_account
      ),
      amount: 0,
    };
    current.amount = money(current.amount + Number(entry.amount));
    sellerMap.set(entry.seller_id, current);
  }

  return NextResponse.json({
    availableSellers: [...sellerMap.entries()].map(([sellerId, value]) => ({
      sellerId,
      ...value,
    })),
    payouts: (payouts ?? []).map((payout) => revealPayoutSnapshot(payout)),
    payoutPolicy: {
      holdDays: Number(finance.hold_days),
      minimumPayout: Number(finance.minimum_payout),
      ...getPayoutSchedule(Number(finance.payout_day)),
    },
    payoutSourceAccount:
      finance.payout_bank_code &&
      finance.payout_bank_name &&
      finance.payout_account_number &&
      finance.payout_account_name
        ? {
            bankCode: finance.payout_bank_code,
            bankName: finance.payout_bank_name,
            accountName: finance.payout_account_name,
            accountNumberMasked: `•••• ${String(finance.payout_account_number).slice(-4)}`,
          }
        : null,
    operator: operator ?? {
      id: caller.sub,
      username: caller.username,
      email: null,
      first_name: null,
      last_name: null,
      avatar_url: null,
      role: caller.role,
    },
  });
}

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการการโอนเงิน' }, { status: 403 });
  }
  if (!hasPayoutAccess(request, caller.sub)) {
    return NextResponse.json({ message: 'กรุณายืนยันรหัสเข้าใช้งานอีกครั้ง' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const sellerId = String(body?.sellerId ?? '');
  const [{ data: account }, { data: entries }, finance] = await Promise.all([
    supabaseAdmin
      .from('marketplace_seller_payout_accounts')
      .select('*')
      .eq('seller_id', sellerId)
      .maybeSingle(),
    supabaseAdmin
      .from('marketplace_ledger_entries')
      .select('id, amount')
      .eq('seller_id', sellerId)
      .eq('account_scope', 'seller')
      .is('payout_id', null)
      .lte('available_at', new Date().toISOString()),
    getFinanceSettings(),
  ]);
  const revealedAccount = revealPayoutAccount(account);
  if (!revealedAccount?.account_number) {
    return NextResponse.json({ message: 'ผู้ขายยังไม่ได้บันทึกบัญชีรับเงิน' }, { status: 400 });
  }
  const amount = money((entries ?? []).reduce((sum, entry) => sum + Number(entry.amount), 0));
  if (amount <= 0 || amount < Number(finance.minimum_payout)) {
    return NextResponse.json(
      { message: `ยอดพร้อมโอนต้องไม่น้อยกว่า ${finance.minimum_payout} บาท` },
      { status: 400 }
    );
  }

  const { data: payout, error } = await supabaseAdmin
    .from('marketplace_payouts')
    .insert({
      seller_id: sellerId,
      amount,
      bank_code_snapshot: revealedAccount.bank_code,
      bank_name_snapshot: revealedAccount.bank_name,
      account_number_snapshot: null,
      account_number_snapshot_encrypted: encryptFinancialValue(
        String(revealedAccount.account_number)
      ),
      account_name_snapshot: revealedAccount.account_name,
    })
    .select('*')
    .single();
  if (error || !payout) {
    return NextResponse.json(
      { message: error?.message ?? 'สร้างรายการโอนไม่สำเร็จ' },
      { status: 500 }
    );
  }

  const ids = (entries ?? []).map((entry) => entry.id);
  const { data: reserved, error: reserveError } = await supabaseAdmin
    .from('marketplace_ledger_entries')
    .update({ payout_id: payout.id })
    .in('id', ids)
    .is('payout_id', null)
    .select('amount');
  const reservedAmount = money(
    (reserved ?? []).reduce((sum, entry) => sum + Number(entry.amount), 0)
  );
  if (reserveError || reservedAmount !== amount) {
    await supabaseAdmin
      .from('marketplace_ledger_entries')
      .update({ payout_id: null })
      .eq('payout_id', payout.id);
    await supabaseAdmin
      .from('marketplace_payouts')
      .update({ status: 'cancelled', failure_reason: 'ยอดถูกจองโดยรายการอื่น' })
      .eq('id', payout.id);
    return NextResponse.json(
      { message: 'ยอดพร้อมโอนมีการเปลี่ยนแปลง กรุณาลองใหม่' },
      { status: 409 }
    );
  }

  return NextResponse.json({ payout: revealPayoutSnapshot(payout) }, { status: 201 });
}
