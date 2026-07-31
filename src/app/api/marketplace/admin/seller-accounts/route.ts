import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

import { getFinanceSettings } from 'src/sections/marketplace/admin/server/finance';

const sellerStatuses = ['draft', 'pending', 'active', 'suspended', 'rejected'] as const;

type SellerStats = {
  seller_id: string;
  product_count: number | string;
  sold_count: number | string;
  view_count: number | string;
};

export async function GET(request: Request) {
  if (!requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูบัญชีร้านค้า' }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const status = searchParams.get('status') ?? 'all';
  const search = (searchParams.get('search') ?? '')
    .trim()
    .replace(/[,%()]/g, ' ')
    .slice(0, 100);
  const requestedPage = Number(searchParams.get('page'));
  const requestedPageSize = Number(searchParams.get('pageSize'));
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(50, Math.max(5, Math.floor(requestedPageSize)))
    : 10;
  const from = (page - 1) * pageSize;

  let query = supabaseAdmin
    .from('marketplace_sellers')
    .select(
      'id, seller_type, display_name, slug, logo_url, seller_name, phone, contact_email, status, commission_rate_override, submitted_at, created_at, updated_at',
      { count: 'exact' }
    )
    .neq('owner_role', 'master_admin');

  if (sellerStatuses.includes(status as (typeof sellerStatuses)[number])) {
    query = query.eq('status', status);
  }
  if (search) {
    query = query.or(
      `display_name.ilike.%${search}%,seller_name.ilike.%${search}%,contact_email.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }

  const [sellersResult, financeSettings] = await Promise.all([
    query.order('created_at', { ascending: false }).range(from, from + pageSize - 1),
    getFinanceSettings(),
  ]);

  if (sellersResult.error) {
    return NextResponse.json({ message: sellersResult.error.message }, { status: 500 });
  }

  const sellers = sellersResult.data ?? [];
  const sellerIds = sellers.map((seller) => seller.id);
  const { data: stats, error: statsError } = sellerIds.length
    ? await supabaseAdmin.rpc('marketplace_seller_account_stats', { seller_ids: sellerIds })
    : { data: [], error: null };
  if (statsError) {
    return NextResponse.json(
      {
        message:
          statsError.code === '42883'
            ? 'กรุณาอัปเดต Marketplace schema สำหรับสถิติร้านค้า'
            : statsError.message,
      },
      { status: 500 }
    );
  }
  const statsBySeller = new Map<string, SellerStats>(
    ((stats ?? []) as SellerStats[]).map((item) => [item.seller_id, item])
  );
  const total = sellersResult.count ?? 0;
  return NextResponse.json({
    sellers: sellers.map((seller) => {
      const sellerStats = statsBySeller.get(seller.id);
      return {
        ...seller,
        product_count: Number(sellerStats?.product_count ?? 0),
        sold_count: Number(sellerStats?.sold_count ?? 0),
        view_count: Number(sellerStats?.view_count ?? 0),
      };
    }),
    defaultCommissionRate: Number(financeSettings.commission_rate),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
