import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

type LedgerEntryInput = {
  shipmentId: string;
  orderId: string;
  entryType:
    | 'customer_charge'
    | 'provider_charge'
    | 'payment_fee'
    | 'customer_refund'
    | 'adjustment';
  amount: number;
  idempotencyKey: string;
  reference?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
};

export async function recordShippingLedgerEntry(input: LedgerEntryInput) {
  const { error } = await supabaseAdmin.from('marketplace_shipping_ledger_entries').upsert(
    {
      shipment_id: input.shipmentId,
      order_id: input.orderId,
      entry_type: input.entryType,
      amount: money(input.amount),
      idempotency_key: input.idempotencyKey,
      reference: input.reference ?? null,
      metadata: input.metadata ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    },
    { onConflict: 'idempotency_key' }
  );
  if (error) throw error;
}

export async function recordShippingCustomerCharge(input: {
  shipmentId: string;
  orderId: string;
  amount: number;
}) {
  await recordShippingLedgerEntry({
    shipmentId: input.shipmentId,
    orderId: input.orderId,
    entryType: 'customer_charge',
    amount: input.amount,
    idempotencyKey: `shipping-charge:${input.shipmentId}`,
    metadata: { source: 'checkout' },
  });
}

export async function recordShippingCustomerChargeForOrder(input: {
  orderId: string;
  amount: number;
}) {
  if (input.amount <= 0) return;
  const { data: shipment, error } = await supabaseAdmin
    .from('marketplace_shipments')
    .select('id')
    .eq('order_id', input.orderId)
    .maybeSingle();
  if (error) throw error;
  if (!shipment) return;
  await recordShippingCustomerCharge({
    shipmentId: shipment.id,
    orderId: input.orderId,
    amount: input.amount,
  });
}

export async function recordShippingPaymentFee(input: {
  orderId: string;
  amount: number;
  paymentSessionId: string;
}) {
  if (input.amount <= 0) return;
  const { data: shipment } = await supabaseAdmin
    .from('marketplace_shipments')
    .select('id')
    .eq('order_id', input.orderId)
    .maybeSingle();
  if (!shipment) return;
  await recordShippingLedgerEntry({
    shipmentId: shipment.id,
    orderId: input.orderId,
    entryType: 'payment_fee',
    amount: -input.amount,
    idempotencyKey: `shipping-payment-fee:${input.paymentSessionId}:${input.orderId}`,
    reference: input.paymentSessionId,
    metadata: { borne_by: 'platform_shipping' },
  });
  await supabaseAdmin
    .from('marketplace_shipments')
    .update({ payment_fee_allocated: money(input.amount), updated_at: new Date().toISOString() })
    .eq('id', shipment.id);
}

export async function reconcileShippingProviderFee(input: {
  shipmentId: string;
  actualFee: number;
  reference?: string | null;
  source: 'booking' | 'webhook' | 'admin';
  actorId?: string | null;
}) {
  const actualFee = money(input.actualFee);
  if (!Number.isFinite(actualFee) || actualFee < 0) throw new Error('ค่าขนส่งจริงไม่ถูกต้อง');
  const { data: shipment, error } = await supabaseAdmin
    .from('marketplace_shipments')
    .select('id,order_id,shipping_fee,provider_fee')
    .eq('id', input.shipmentId)
    .maybeSingle();
  if (error) throw error;
  if (!shipment) throw new Error('ไม่พบ Shipment สำหรับกระทบยอด');

  const previousFee = shipment.provider_fee == null ? null : money(Number(shipment.provider_fee));
  if (previousFee == null) {
    await recordShippingLedgerEntry({
      shipmentId: shipment.id,
      orderId: shipment.order_id,
      entryType: 'provider_charge',
      amount: -actualFee,
      idempotencyKey: `shipping-provider-charge:${shipment.id}`,
      reference: input.reference,
      metadata: { source: input.source },
    });
  } else if (previousFee !== actualFee) {
    const adjustmentReference =
      input.source === 'admin'
        ? `${input.actorId ?? 'admin'}:${new Date().toISOString()}`
        : (input.reference ?? `${previousFee}:${actualFee}`);
    await recordShippingLedgerEntry({
      shipmentId: shipment.id,
      orderId: shipment.order_id,
      entryType: 'adjustment',
      amount: money(previousFee - actualFee),
      idempotencyKey: `shipping-provider-adjustment:${shipment.id}:${adjustmentReference}:${actualFee}`,
      reference: input.reference,
      metadata: { source: input.source, previous_fee: previousFee, actual_fee: actualFee },
    });
  }

  const quotedFee = money(Number(shipment.shipping_fee));
  const { error: updateError } = await supabaseAdmin
    .from('marketplace_shipments')
    .update({
      provider_fee: actualFee,
      reconciliation_status: quotedFee === actualFee ? 'matched' : 'difference',
      reconciled_at: new Date().toISOString(),
      reconciled_by: input.actorId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shipment.id);
  if (updateError) throw updateError;
}

export async function recordShippingRefundForOrders(orderIds: string[], reference: string) {
  if (!orderIds.length) return;
  const { data: shipments, error } = await supabaseAdmin
    .from('marketplace_shipments')
    .select('id,order_id,shipping_fee,refunded_amount,status')
    .in('order_id', orderIds);
  if (error) throw error;
  for (const shipment of shipments ?? []) {
    const refundable = money(
      Math.max(0, Number(shipment.shipping_fee) - Number(shipment.refunded_amount ?? 0))
    );
    if (refundable > 0) {
      await recordShippingLedgerEntry({
        shipmentId: shipment.id,
        orderId: shipment.order_id,
        entryType: 'customer_refund',
        amount: -refundable,
        idempotencyKey: `shipping-refund:${reference}:${shipment.id}`,
        reference,
        metadata: { shipment_status: shipment.status },
      });
    }
    await supabaseAdmin
      .from('marketplace_shipments')
      .update({
        refunded_amount: money(Number(shipment.refunded_amount ?? 0) + refundable),
        reconciliation_status: 'refunded',
        ...(shipment.status === 'pending' || shipment.status === 'ready'
          ? { status: 'cancelled' }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', shipment.id);
  }
}

export async function getShippingFinanceSummary() {
  const { data, error } = await supabaseAdmin.rpc('marketplace_shipping_finance_summary');
  if (error) throw error;
  const summary = (data ?? {}) as Record<string, unknown>;
  return {
    collected: money(Number(summary.collected ?? 0)),
    providerCost: money(Number(summary.providerCost ?? 0)),
    paymentFee: money(Number(summary.paymentFee ?? 0)),
    refunds: money(Number(summary.refunds ?? 0)),
    adjustments: money(Number(summary.adjustments ?? 0)),
    balance: money(Number(summary.balance ?? 0)),
    pendingReconciliation: Number(summary.pendingReconciliation ?? 0),
    differences: Number(summary.differences ?? 0),
    shipmentCount: Number(summary.shipmentCount ?? 0),
  };
}
