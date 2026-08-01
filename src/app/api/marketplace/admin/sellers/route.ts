import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

const allowedStatuses = ['pending', 'active', 'rejected'] as const;
type SellerStatus = (typeof allowedStatuses)[number];

export async function GET(request: Request) {
  if (!requireRole(request, ['master_admin', 'marketplace_admin'])) {
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

  let sellersQuery = supabaseAdmin
    .from('marketplace_sellers')
    .select(
      'id, seller_type, display_name, slug, logo_url, seller_name, phone, contact_email, status, submitted_at, rejection_reason, created_at, profile_review_status, profile_submitted_at, profile_rejection_reason, pending_profile_data',
      { count: 'exact' }
    )
    .neq('owner_role', 'master_admin')
    .order('profile_submitted_at', { ascending: false, nullsFirst: false })
    .order('submitted_at', { ascending: false, nullsFirst: false });
  if (status === 'pending') {
    sellersQuery = sellersQuery.or('status.eq.pending,profile_review_status.eq.pending');
  } else if (status === 'rejected') {
    sellersQuery = sellersQuery.or('status.eq.rejected,profile_review_status.eq.rejected');
  } else {
    sellersQuery = sellersQuery
      .eq('status', 'active')
      .or('profile_review_status.is.null,profile_review_status.eq.draft');
  }
  sellersQuery = sellersQuery.range(from, from + pageSize - 1);

  const [sellersResult, pendingResult, activeResult, rejectedResult] = await Promise.all([
    sellersQuery,
    countReviewStatus('pending'),
    countReviewStatus('active'),
    countReviewStatus('rejected'),
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
    sellers: (sellersResult.data ?? []).map((seller) => {
      const pendingProfile = seller.pending_profile_data as Record<string, unknown> | null;
      const reviewStatus = seller.profile_review_status ?? seller.status;
      return {
        ...seller,
        ...(reviewStatus === 'pending' && pendingProfile ? pendingProfile : {}),
        status: reviewStatus,
        submitted_at: seller.profile_submitted_at ?? seller.submitted_at,
        rejection_reason: seller.profile_rejection_reason ?? seller.rejection_reason,
        is_profile_revision: seller.status === 'active' && Boolean(seller.profile_review_status),
      };
    }),
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

function countReviewStatus(status: SellerStatus) {
  let query = supabaseAdmin
    .from('marketplace_sellers')
    .select('*', { count: 'exact', head: true })
    .neq('owner_role', 'master_admin');
  if (status === 'pending') {
    query = query.or('status.eq.pending,profile_review_status.eq.pending');
  } else if (status === 'rejected') {
    query = query.or('status.eq.rejected,profile_review_status.eq.rejected');
  } else {
    query = query
      .eq('status', 'active')
      .or('profile_review_status.is.null,profile_review_status.eq.draft');
  }
  return query;
}
