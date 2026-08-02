import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createNotifications } from 'src/lib/notifications';

import { recordCustomerCommunication } from './order-evidence';
import { money, getFinanceSettings } from '../../admin/server/finance';
import { createReferralRewards } from '../../referrals/server/referrals';
import { createSchoolOnboardingForPaidOrders } from './school-onboarding';
import { grantFeatureEntitlementsForOrders } from './grant-feature-entitlements';
import { notifySellerPaymentReceived } from '../../seller/server/seller-line-notifications';
import {
  recordShippingPaymentFee,
  recordShippingCustomerChargeForOrder,
} from '../../shipping/server/accounting';

type FinalizeInput = {
  paymentSessionId: string;
  allowedStatuses: string[];
  reviewedBy?: string | null;
  bankTransactionReference?: string | null;
  stripePaymentIntentId?: string | null;
  paymentSnapshot?: Record<string, unknown> | null;
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
  const orderIds = orders.map((order) => String(order.id));
  if (session.status === 'verified') {
    await Promise.all(
      orders.map((order) =>
        recordShippingCustomerChargeForOrder({
          orderId: String(order.id),
          amount: Number(order.shipping_amount ?? 0),
        })
      )
    );
    await createReferralRewards(orders, String(session.buyer_id));
    await grantFeatureEntitlementsForOrders(orderIds);
    await createSchoolOnboardingForPaidOrders({
      paymentSessionId: session.id,
      buyerId: session.buyer_id,
      orderIds,
    });
    const salesDealIds = orders.map((order) => String(order.sales_deal_id ?? '')).filter(Boolean);
    if (salesDealIds.length) {
      await supabaseAdmin
        .from('marketplace_sales_deals')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .in('id', salesDealIds);
    }
    await Promise.allSettled(
      orders.map((order) =>
        notifySellerPaymentReceived({
          sellerId: String(order.seller_id),
          orderId: String(order.id),
          paymentSessionId: input.paymentSessionId,
          grossAmount: Number(order.gross_amount),
          sellerNet: Number(order.seller_net),
          availableAt: String(
            order.available_at ?? session.reviewed_at ?? new Date().toISOString()
          ),
        })
      )
    );
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
  const paymentTotal = money(
    Math.max(
      Number(session.amount),
      orders.reduce(
        (sum, order) => sum + Number(order.gross_amount) + Number(order.shipping_amount ?? 0),
        0
      )
    )
  );
  const processorFee = money(Math.max(0, Number(input.processorFee) || 0));
  let allocatedFee = 0;

  const settlements = orders.map((order, index) => {
    const orderGross = Number(order.gross_amount);
    const shippingAmount = Number(order.shipping_amount ?? 0);
    const orderPaymentAmount = money(orderGross + shippingAmount);
    const orderTotalFee =
      index === orders.length - 1
        ? money(processorFee - allocatedFee)
        : money(processorFee * (orderPaymentAmount / paymentTotal));
    allocatedFee = money(allocatedFee + orderTotalFee);
    const shippingPaymentFee =
      shippingAmount > 0 && orderPaymentAmount > 0
        ? money(orderTotalFee * (shippingAmount / orderPaymentAmount))
        : 0;
    const orderFee = money(orderTotalFee - shippingPaymentFee);
    const sellerNet = money(Math.max(0, Number(order.seller_net) - orderFee));

    return { order, orderFee, sellerNet, shippingPaymentFee };
  });

  const ledgerRows = settlements.flatMap(({ order, sellerNet }) => [
    {
      order_id: order.id,
      seller_id: order.seller_id,
      account_scope: 'seller',
      entry_type: 'sale',
      amount: sellerNet,
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
  ]);

  const { error: ledgerError } = await supabaseAdmin
    .from('marketplace_ledger_entries')
    .upsert(ledgerRows, {
      onConflict: 'order_id,account_scope,entry_type',
      ignoreDuplicates: true,
    });
  if (ledgerError) throw ledgerError;

  for (const { order, orderFee, sellerNet, shippingPaymentFee } of settlements) {
    await recordShippingCustomerChargeForOrder({
      orderId: String(order.id),
      amount: Number(order.shipping_amount ?? 0),
    });
    await recordShippingPaymentFee({
      orderId: String(order.id),
      amount: shippingPaymentFee,
      paymentSessionId: input.paymentSessionId,
    });
    const { error: orderError } = await supabaseAdmin
      .from('marketplace_orders')
      .update({
        status: 'paid',
        payment_fee: orderFee,
        seller_net: sellerNet,
        paid_at: now.toISOString(),
        available_at: availableAt,
        updated_at: now.toISOString(),
      })
      .eq('id', order.id)
      .in('status', input.allowedStatuses);
    if (orderError) throw orderError;
    await recordCustomerCommunication({
      orderId: String(order.id),
      paymentSessionId: input.paymentSessionId,
      buyerId: String(session.buyer_id),
      eventType: 'payment_confirmed',
      subject: 'ยืนยันการชำระเงินแล้ว',
      content: `ยืนยันการชำระเงินคำสั่งซื้อ ${String(order.id)} ยอด ${Number(
        order.gross_amount
      ).toFixed(2)} ${String(session.currency)}`,
      providerReference: input.stripePaymentIntentId ?? input.bankTransactionReference ?? null,
      metadata: {
        payment_method: session.payment_method,
        paid_at: now.toISOString(),
        processor_fee: orderFee,
        shipping_processor_fee: shippingPaymentFee,
      },
    });
  }

  await createReferralRewards(orders, String(session.buyer_id));

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
  if (input.paymentSnapshot) {
    const { error: evidenceError } = await supabaseAdmin
      .from('marketplace_order_evidence')
      .update({
        payment_snapshot: input.paymentSnapshot,
        updated_at: now.toISOString(),
      })
      .eq('payment_session_id', input.paymentSessionId);
    if (evidenceError) throw evidenceError;
  }

  // Payment remains verified if entitlement creation fails, while the thrown
  // error makes Stripe/admin retry the idempotent reconciliation path.
  const licenses = await grantFeatureEntitlementsForOrders(orderIds);
  const schoolOnboardingPending = await createSchoolOnboardingForPaidOrders({
    paymentSessionId: session.id,
    buyerId: session.buyer_id,
    orderIds,
  });
  const salesDealIds = orders.map((order) => String(order.sales_deal_id ?? '')).filter(Boolean);
  if (salesDealIds.length) {
    await supabaseAdmin
      .from('marketplace_sales_deals')
      .update({ status: 'active', updated_at: now.toISOString() })
      .in('id', salesDealIds);
  }

  if (licenses.length) {
    const schoolIds = [
      ...new Set(licenses.map((license) => String(license.school_id ?? '')).filter(Boolean)),
    ];
    const schoolAdmins = schoolIds.length
      ? (
          await supabaseAdmin
            .from('app_users')
            .select('id,school_id')
            .eq('role', 'school_admin')
            .in('school_id', schoolIds)
            .eq('is_active', true)
        ).data
      : [];
    const { data: marketplaceAdmins } = await supabaseAdmin
      .from('app_users')
      .select('id,school_id')
      .eq('role', 'master_admin')
      .eq('is_active', true);
    const recipients = [...(schoolAdmins ?? []), ...(marketplaceAdmins ?? [])];
    await createNotifications(
      recipients.map((recipient) => ({
        userId: recipient.id,
        schoolId: recipient.school_id,
        type: schoolIds.length
          ? 'marketplace_school_license_created'
          : 'marketplace_user_license_created',
        title: schoolIds.length
          ? 'เปิดใช้งาน License โรงเรียนแล้ว'
          : 'เปิดใช้งาน License บุคคลแล้ว',
        body: `สร้าง License ${licenses.length} รายการจากคำสั่งซื้อที่ชำระสำเร็จ`,
        link: '/dashboard/licenses',
      }))
    );
  }

  await createNotifications([
    {
      userId: session.buyer_id,
      schoolId: null,
      type: 'marketplace_payment_verified',
      title: 'ยืนยันการชำระเงินแล้ว',
      body: schoolOnboardingPending
        ? 'ส่งลิงก์สร้างโรงเรียนไปยังอีเมลแล้ว กรุณาดำเนินการเพื่อเปิดใช้งาน License'
        : 'คำสั่งซื้อพร้อมใช้งานแล้ว',
      link: '/dashboard/purchases',
    },
  ]);

  // LINE is a secondary channel: a failed notification must never roll back a
  // payment that has already been verified and posted to the ledger.
  await Promise.allSettled(
    settlements.map(({ order, sellerNet }) =>
      notifySellerPaymentReceived({
        sellerId: String(order.seller_id),
        orderId: String(order.id),
        paymentSessionId: input.paymentSessionId,
        grossAmount: Number(order.gross_amount),
        sellerNet,
        availableAt,
      })
    )
  );

  return { alreadyProcessed: false, availableAt };
}
