import { NextResponse } from 'next/server';

import { getFinanceSettings } from 'src/sections/marketplace/admin/server/finance';
import { isStripeConfigured } from 'src/sections/marketplace/checkout/server/stripe';

export async function GET() {
  try {
    const settings = await getFinanceSettings();
    return NextResponse.json({
      paymentMethods: {
        promptpay: Boolean(settings.is_active && settings.promptpay_id),
        stripe: Boolean(settings.stripe_enabled && isStripeConfigured()),
      },
    });
  } catch {
    return NextResponse.json({
      paymentMethods: { promptpay: false, stripe: false },
    });
  }
}
