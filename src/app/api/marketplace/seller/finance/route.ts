import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const { data: seller } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, display_name, status')
    .eq('owner_id', caller.sub)
    .maybeSingle();
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });

  const now = new Date().toISOString();
  const [{ data: ledger, error }, { data: payouts }] = await Promise.all([
    supabaseAdmin
      .from('marketplace_ledger_entries')
      .select('id, order_id, amount, available_at, payout_id, created_at')
      .eq('seller_id', seller.id)
      .eq('account_scope', 'seller')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('marketplace_payouts')
      .select('*')
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const rows = ledger ?? [];
  const available = rows
    .filter((row) => !row.payout_id && row.available_at && row.available_at <= now)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const pending = rows
    .filter((row) => !row.payout_id && (!row.available_at || row.available_at > now))
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const paid = (payouts ?? [])
    .filter((payout) => payout.status === 'paid')
    .reduce((sum, payout) => sum + Number(payout.amount), 0);

  return NextResponse.json({
    seller,
    balance: { available, pending, paid },
    ledger: rows,
    payouts: payouts ?? [],
  });
}
