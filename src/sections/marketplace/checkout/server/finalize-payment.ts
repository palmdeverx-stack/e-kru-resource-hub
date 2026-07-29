import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createNotifications } from 'src/lib/notifications';

import { money, getFinanceSettings } from '../../admin/server/finance';
import { grantFeatureEntitlementsForOrders } from './grant-feature-entitlements';
import { notifySellerPaymentReceived } from '../../seller/server/seller-line-notifications';

type FinalizeInput = {
  paymentSessionId: string;
  allowedStatuses: string[];
  reviewedBy?: string | null;
  bankTransactionReference?: string | null;
  stripePaymentIntentId?: string | null;
  processorFee?: number;
};

export async function finalizeMarketplacePayment(input: FinalizeInput) {
  const { data: session, error } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .select('*, orders:marketplace_orders(*)')
    .eq('id', input.paymentSessionId)
    .maybeSingle();
  if (error) throw error;
  if (!session) throw new Error('ไม่พบรายการชำระเงิน');
  const orders = (session.orders ?? []) as Array<Record<string, unknown>>;
  if (session.status === 'verified') {
    await grantFeatureEntitlementsForOrders(orders.map((order) => String(order.id)));
    return { alreadyProcessed: true, availableAt: session.reviewed_at };
  }
  if (!input.allowedStatuses.includes(session.status)) {
    throw new Error('สถานะรายการชำระเงินไม่สามารถยืนยันได้');
  }

  const now = new Date();
  const finance = await getFinanceSettings();
  const availableAt = new Date(
    now.getTime() + Number(finance.hold_days) * 24 * 60 * 60 * 1000
  ).toISOString();
  const total = orders.reduce((sum, order) => sum + Number(order.gross_amount), 0);
  const processorFee = money(Math.max(0, Number(input.processorFee) || 0));
  let allocatedFee = 0;

  const ledgerRows = orders.flatMap((order, index) => {
    const orderGross = Number(order.gross_amount);
    const orderFee =
      index === orders.length - 1
        ? money(processorFee - allocatedFee)
        : money(processorFee * (orderGross / total));
    allocatedFee = money(allocatedFee + orderFee);

    return [
      {
        order_id: order.id,
        seller_id: order.seller_id,
        account_scope: 'seller',
        entry_type: 'sale',
        amount: Number(order.seller_net),
        available_at: availableAt,
        description: 'รายได้จากการขายหลังหักค่าธรรมเนียม',
      },
      {
        order_id: order.id,
        seller_id: order.seller_id,
        account_scope: 'platform',
        entry_type: 'commission',
        amount: Number(order.platform_fee),
        available_at: now.toISOString(),
        description: `ค่าธรรมเนียมแพลตฟอร์ม ${Number(order.commission_rate)}%`,
      },
      ...(orderFee > 0
        ? [
            {
              order_id: order.id,
              seller_id: order.seller_id,
              account_scope: 'platform',
              entry_type: 'gateway_fee',
              amount: -orderFee,
              available_at: now.toISOString(),
              description: 'ค่าธรรมเนียม Stripe',
            },
          ]
        : []),
    ];
  });

  const { error: ledgerError } = await supabaseAdmin
    .from('marketplace_ledger_entries')
    .upsert(ledgerRows, { onConflict: 'order_id,account_scope,entry_type', ignoreDuplicates: true });
  if (ledgerError) throw ledgerError;

  allocatedFee = 0;
  for (const [index, order] of orders.entries()) {
    const orderGross = Number(order.gross_amount);
    const orderFee =
      index === orders.length - 1
        ? money(processorFee - allocatedFee)
        : money(processorFee * (orderGross / total));
    allocatedFee = money(allocatedFee + orderFee);
    const { error: orderError } = await supabaseAdmin
      .from('marketplace_orders')
      .update({
        status: 'paid',
        payment_fee: orderFee,
        paid_at: now.toISOString(),
        available_at: availableAt,
        updated_at: now.toISOString(),
      })
      .eq('id', order.id)
      .in('status', input.allowedStatuses);
    if (orderError) throw orderError;
  }

  const { error: approveError } = await supabaseAdmin
    .from('marketplace_payment_sessions')
    .update({
      status: 'verified',
      processor_fee: processorFee,
      bank_transaction_reference: input.bankTransactionReference ?? null,
      stripe_payment_intent_id: input.stripePaymentIntentId ?? session.stripe_payment_intent_id,
      rejection_reason: null,
      reviewed_at: now.toISOString(),
      reviewed_by: input.reviewedBy ?? null,
      updated_at: now.toISOString(),
    })
    .eq('id', input.paymentSessionId)
    .in('status', input.allowedStatuses);
  if (approveError) throw approveError;

  // Payment remains verified if entitlement creation fails, while the thrown
  // error makes Stripe/admin retry the idempotent reconciliation path.
  await grantFeatureEntitlementsForOrders(orders.map((order) => String(order.id)));

  await createNotifications([
    {
      userId: session.buyer_id,
      schoolId: null,
      type: 'marketplace_payment_verified',
      title: 'ยืนยันการชำระเงินแล้ว',
      body: 'คำสั่งซื้อพร้อมใช้งานแล้ว',
      link: '/dashboard/purchases',
    },
  ]);

  // LINE is a secondary channel: a failed notification must never roll back a
  // payment that has already been verified and posted to the ledger.
  await Promise.allSettled(
    orders.map((order) =>
      notifySellerPaymentReceived({
        sellerId: String(order.seller_id),
        orderId: String(order.id),
        paymentSessionId: input.paymentSessionId,
        grossAmount: Number(order.gross_amount),
        sellerNet: Number(order.seller_net),
        availableAt,
      })
    )
  );

  return { alreadyProcessed: false, availableAt };
}
