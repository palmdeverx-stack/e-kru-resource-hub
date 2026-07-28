import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

import { money, getFinanceSettings } from 'src/sections/marketplace/admin/server/finance';

export async function GET(request: Request) {
  if (!requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการการโอนเงิน' }, { status: 403 });
  }
  const now = new Date().toISOString();
  const [{ data: entries, error }, { data: payouts }] = await Promise.all([
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
      account: Array.isArray(sellerRecord?.payout_account)
        ? sellerRecord.payout_account[0]
        : sellerRecord?.payout_account,
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
    payouts: payouts ?? [],
  });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการการโอนเงิน' }, { status: 403 });
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
  if (!account) {
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
      bank_code_snapshot: account.bank_code,
      bank_name_snapshot: account.bank_name,
      account_number_snapshot: account.account_number,
      account_name_snapshot: account.account_name,
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
    return NextResponse.json({ message: 'ยอดพร้อมโอนมีการเปลี่ยนแปลง กรุณาลองใหม่' }, { status: 409 });
  }

  return NextResponse.json({ payout }, { status: 201 });
}
