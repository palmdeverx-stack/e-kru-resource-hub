import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';

export async function GET() {
  const [
    teachersResult,
    productsResult,
    schoolsResult,
    externalMembersResult,
    sellersResult,
    completedOrdersResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'teacher')
      .eq('is_active', true),
    supabaseAdmin
      .from('marketplace_products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabaseAdmin
      .from('schools')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabaseAdmin
      .from('marketplace_users')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabaseAdmin
      .from('marketplace_sellers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabaseAdmin
      .from('marketplace_orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['paid', 'completed']),
  ]);

  const error = [
    teachersResult,
    productsResult,
    schoolsResult,
    externalMembersResult,
    sellersResult,
    completedOrdersResult,
  ].find((result) => result.error)?.error;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      teachers: teachersResult.count ?? 0,
      products: productsResult.count ?? 0,
      schools: schoolsResult.count ?? 0,
      externalMembers: externalMembersResult.count ?? 0,
      activeSellers: sellersResult.count ?? 0,
      completedOrders: completedOrdersResult.count ?? 0,
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  );
}
