import { NextResponse } from 'next/server';

import { requireRole, hasPayoutAccess } from 'src/lib/auth-token';

import { getStripe } from 'src/sections/marketplace/checkout/server/stripe';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    return NextResponse.json(
      { message: 'ไม่มีสิทธิ์ดูข้อมูลการโอนเงิน Stripe' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }
  if (!hasPayoutAccess(request, caller.sub)) {
    return NextResponse.json(
      { message: 'กรุณายืนยัน PIN เพื่อดูข้อมูล Stripe' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json(
      { configured: false, availableAmount: 0, pendingAmount: 0, currency: 'thb', payouts: [] },
      { headers: NO_STORE_HEADERS }
    );
  }

  try {
    const stripe = getStripe();
    const [balance, payoutList, account, balanceSettings] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.payouts.list({ limit: 20, expand: ['data.destination'] }),
      stripe.accounts.retrieveCurrent(),
      stripe.balanceSettings.retrieve().catch(() => null),
    ]);
    const currency = 'thb';
    const totalForCurrency = (amounts: Array<{ amount: number; currency: string }>) =>
      amounts
        .filter((item) => item.currency.toLowerCase() === currency)
        .reduce((total, item) => total + item.amount, 0);

    const serializePayout = (payout: (typeof payoutList.data)[number]) => ({
      id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
      createdAt: new Date(payout.created * 1000).toISOString(),
      status: payout.status,
      automatic: payout.automatic,
      failureMessage: payout.failure_message,
    });
    const payouts = payoutList.data
      .filter((payout) => ['pending', 'in_transit'].includes(payout.status))
      .sort((left, right) => left.arrival_date - right.arrival_date)
      .map(serializePayout);
    const lastPaidPayout = payoutList.data.find((payout) => payout.status === 'paid');
    const failedPayouts = payoutList.data
      .filter((payout) => payout.status === 'failed')
      .slice(0, 3)
      .map(serializePayout);
    const destination = payoutList.data.find(
      (payout) => payout.destination && typeof payout.destination !== 'string'
    )?.destination;
    const schedule = balanceSettings?.payments.payouts?.schedule;
    const requirementsDue = [
      ...(account.requirements?.past_due ?? []),
      ...(account.requirements?.currently_due ?? []),
    ].filter((item, index, items) => items.indexOf(item) === index);

    return NextResponse.json(
      {
        configured: true,
        availableAmount: totalForCurrency(balance.available),
        pendingAmount: totalForCurrency(balance.pending),
        currency,
        payouts,
        account: {
          id: account.id,
          businessName: account.business_profile?.name ?? null,
          country: account.country ?? null,
          liveMode: payoutList.data[0]?.livemode ?? process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_'),
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
          requirementsDueCount: requirementsDue.length,
          requirementsDeadline: account.requirements?.current_deadline
            ? new Date(account.requirements.current_deadline * 1000).toISOString()
            : null,
        },
        bankAccount:
          destination &&
          typeof destination !== 'string' &&
          destination.object === 'bank_account' &&
          !('deleted' in destination)
            ? {
                bankName: destination.bank_name,
                last4: destination.last4,
                accountHolderName: destination.account_holder_name,
              }
            : null,
        schedule: {
          interval: schedule?.interval ?? null,
          weeklyPayoutDays: schedule?.weekly_payout_days ?? [],
          monthlyPayoutDays: schedule?.monthly_payout_days ?? [],
          settlementDelayDays: balanceSettings
            ? (balanceSettings.payments.settlement_timing.delay_days_override ??
              balanceSettings.payments.settlement_timing.delay_days)
            : null,
          status: balanceSettings?.payments.payouts?.status ?? null,
        },
        lastPaidPayout: lastPaidPayout ? serializePayout(lastPaidPayout) : null,
        failedPayouts,
        updatedAt: new Date().toISOString(),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error('Unable to load Stripe payout summary', error);
    return NextResponse.json(
      { message: 'ดึงข้อมูลวันเงินเข้าจาก Stripe ไม่สำเร็จ กรุณาลองใหม่' },
      { status: 502, headers: NO_STORE_HEADERS }
    );
  }
}
