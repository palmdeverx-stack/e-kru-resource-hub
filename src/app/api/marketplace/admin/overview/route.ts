import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

export async function GET(request: Request) {
  const caller = requireRole(request, ['master_admin', 'marketplace_admin']);
  if (!caller) {
    return NextResponse.json(
      { message: 'ไม่มีสิทธิ์เข้าถึงศูนย์ควบคุม Marketplace' },
      { status: 403 }
    );
  }

  const [
    sellersResult,
    productsResult,
    usersResult,
    ordersResult,
    pendingSellersResult,
    pendingProductsResult,
    pendingPaymentsResult,
    pendingPayoutsResult,
    recentSellersResult,
    recentOrdersResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('marketplace_sellers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabaseAdmin
      .from('marketplace_products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabaseAdmin.from('marketplace_users').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('marketplace_orders')
      .select('total, gross_amount, platform_fee, payment_fee, seller_net, status, currency')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('marketplace_sellers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabaseAdmin
      .from('marketplace_products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_review'),
    supabaseAdmin
      .from('marketplace_payment_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'payment_review'),
    supabaseAdmin
      .from('marketplace_payouts')
      .select('amount, status')
      .in('status', ['pending', 'processing']),
    supabaseAdmin
      .from('marketplace_sellers')
      .select('id, display_name, seller_type, status, logo_url, submitted_at, created_at')
      .neq('owner_role', 'master_admin')
      .order('created_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('marketplace_orders')
      .select('id, total, currency, status, created_at, seller:marketplace_sellers(display_name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const results = [
    sellersResult,
    productsResult,
    usersResult,
    ordersResult,
    pendingSellersResult,
    pendingProductsResult,
    pendingPaymentsResult,
    pendingPayoutsResult,
    recentSellersResult,
    recentOrdersResult,
  ];
  const schemaError = results.find((result) => result.error?.code === '42P01');
  if (schemaError) {
    return NextResponse.json({
      setupRequired: true,
      metrics: {
        grossSales: 0,
        orderCount: 0,
        activeSellerCount: 0,
        publishedProductCount: 0,
        marketplaceUserCount: 0,
        platformRevenue: 0,
        sellerRevenue: 0,
        pendingPayoutAmount: 0,
      },
      attention: {
        pendingSellerCount: 0,
        pendingProductCount: 0,
        pendingPaymentCount: 0,
        pendingPayoutCount: 0,
        pendingOrderCount: 0,
      },
      recentSellers: [],
      recentOrders: [],
    });
  }

  const queryError = results.find((result) => result.error);
  if (queryError?.error) {
    return NextResponse.json({ message: queryError.error.message }, { status: 500 });
  }

  const orders = ordersResult.data ?? [];
  const completedOrders = orders.filter((order) => ['paid', 'completed'].includes(order.status));
  const grossSales = completedOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const platformRevenue = completedOrders.reduce(
    (sum, order) => sum + Number(order.platform_fee),
    0
  );
  const sellerRevenue = completedOrders.reduce((sum, order) => sum + Number(order.seller_net), 0);
  const pendingPayouts = pendingPayoutsResult.data ?? [];

  return NextResponse.json({
    metrics: {
      grossSales,
      platformRevenue,
      sellerRevenue,
      pendingPayoutAmount: pendingPayouts.reduce((sum, payout) => sum + Number(payout.amount), 0),
      orderCount: orders.length,
      activeSellerCount: sellersResult.count ?? 0,
      publishedProductCount: productsResult.count ?? 0,
      marketplaceUserCount: usersResult.count ?? 0,
    },
    attention: {
      pendingSellerCount: pendingSellersResult.count ?? 0,
      pendingProductCount: pendingProductsResult.count ?? 0,
      pendingPaymentCount: pendingPaymentsResult.count ?? 0,
      pendingPayoutCount: pendingPayouts.length,
      pendingOrderCount: orders.filter((order) =>
        ['pending', 'pending_payment', 'payment_review'].includes(order.status)
      ).length,
    },
    recentSellers: recentSellersResult.data ?? [],
    recentOrders: recentOrdersResult.data ?? [],
  });
}
