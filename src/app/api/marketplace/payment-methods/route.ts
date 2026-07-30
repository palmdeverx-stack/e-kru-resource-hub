import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { getFinanceSettings } from 'src/sections/marketplace/admin/server/finance';
import { isStripeConfigured } from 'src/sections/marketplace/checkout/server/stripe';

export async function GET(request: Request) {
  try {
    const settings = await getFinanceSettings();
    const caller = requireAuthenticated(request);
    const { data: seller } = caller
      ? await supabaseAdmin
          .from('marketplace_sellers')
          .select('owner_role, commission_rate_override')
          .eq('owner_id', caller.sub)
          .maybeSingle()
      : { data: null };
    const commissionRate =
      seller?.owner_role === 'master_admin'
        ? 0
        : Number(seller?.commission_rate_override ?? settings.commission_rate);

    return NextResponse.json({
      paymentMethods: {
        promptpay: Boolean(settings.is_active && settings.promptpay_id),
        stripe: Boolean(settings.stripe_enabled && isStripeConfigured()),
      },
      commissionRate,
    });
  } catch {
    return NextResponse.json({
      paymentMethods: { promptpay: false, stripe: false },
      commissionRate: 0,
    });
  }
}
