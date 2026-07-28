import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

const allowedStatuses = ['pending', 'active', 'rejected'] as const;
type SellerStatus = (typeof allowedStatuses)[number];

export async function GET(request: Request) {
  if (!requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตรวจสอบคำขอเปิดร้าน' }, { status: 403 });
  }

  const requestedStatus = new URL(request.url).searchParams.get('status') ?? 'pending';
  const searchParams = new URL(request.url).searchParams;
  const status: SellerStatus = allowedStatuses.includes(requestedStatus as SellerStatus)
    ? (requestedStatus as SellerStatus)
    : 'pending';
  const requestedPage = Number(searchParams.get('page'));
  const requestedPageSize = Number(searchParams.get('pageSize'));
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(50, Math.max(5, Math.floor(requestedPageSize)))
    : 10;
  const from = (page - 1) * pageSize;

  const sellersQuery = supabaseAdmin
    .from('marketplace_sellers')
    .select(
      'id, seller_type, display_name, slug, logo_url, seller_name, phone, contact_email, status, submitted_at, rejection_reason, created_at',
      { count: 'exact' }
    )
    .eq('status', status)
    .neq('owner_role', 'master_admin')
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  const [sellersResult, pendingResult, activeResult, rejectedResult] = await Promise.all([
    sellersQuery,
    countSellers('pending'),
    countSellers('active'),
    countSellers('rejected'),
  ]);

  const error =
    sellersResult.error || pendingResult.error || activeResult.error || rejectedResult.error;
  if (error) {
    return NextResponse.json(
      {
        message:
          error.code === '42703'
            ? 'กรุณาอัปเดต Marketplace schema สำหรับระบบอนุมัติร้านค้า'
            : error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    sellers: sellersResult.data ?? [],
    counts: {
      pending: pendingResult.count ?? 0,
      active: activeResult.count ?? 0,
      rejected: rejectedResult.count ?? 0,
    },
    pagination: {
      page,
      pageSize,
      total: sellersResult.count ?? 0,
      totalPages: Math.ceil((sellersResult.count ?? 0) / pageSize),
    },
  });
}

function countSellers(status: SellerStatus) {
  return supabaseAdmin
    .from('marketplace_sellers')
    .select('*', { count: 'exact', head: true })
    .eq('status', status)
    .neq('owner_role', 'master_admin');
}
