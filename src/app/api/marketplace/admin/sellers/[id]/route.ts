import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import { revealPayoutAccount } from 'src/lib/financial-data-cipher';

import { getFinanceSettings } from 'src/sections/marketplace/admin/server/finance';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  if (!requireRole(request, ['master_admin', 'marketplace_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูข้อมูลร้านค้า' }, { status: 403 });
  }

  const { id } = await params;
  const { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('*')
    .eq('id', id)
    .neq('owner_role', 'master_admin')
    .maybeSingle();
  if (error || !seller) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบคำขอเปิดร้าน' },
      { status: error ? 500 : 404 }
    );
  }

  const [{ data: documents, error: documentsError }, { data: payoutAccount, error: payoutError }] =
    await Promise.all([
      supabaseAdmin
        .from('marketplace_seller_documents')
        .select('*')
        .eq('seller_id', seller.id)
        .order('uploaded_at', { ascending: true }),
      supabaseAdmin
        .from('marketplace_seller_payout_accounts')
        .select('*')
        .eq('seller_id', seller.id)
        .maybeSingle(),
    ]);
  if (documentsError || payoutError) {
    return NextResponse.json(
      { message: documentsError?.message ?? payoutError?.message },
      { status: 500 }
    );
  }

  const signedDocuments = await Promise.all(
    (documents ?? []).map(async (document) => {
      if (document.storage_bucket === 'marketplace-seller-assets') {
        const publicUrl = supabaseAdmin.storage
          .from(document.storage_bucket)
          .getPublicUrl(document.storage_path).data.publicUrl;
        return { ...document, url: publicUrl };
      }
      return {
        ...document,
        url: `/api/marketplace/seller/documents?documentId=${encodeURIComponent(document.id)}`,
      };
    })
  );
  const financeSettings = await getFinanceSettings();
  const pendingProfile = seller.pending_profile_data as Record<string, unknown> | null;
  const proposedPayout = pendingProfile?.payout_account as Record<string, unknown> | undefined;
  const isProfileRevision =
    seller.status === 'active' && seller.profile_review_status === 'pending';

  return NextResponse.json({
    seller: {
      ...seller,
      ...(isProfileRevision && pendingProfile ? pendingProfile : {}),
      status: isProfileRevision ? 'pending' : seller.status,
      submitted_at: isProfileRevision ? seller.profile_submitted_at : seller.submitted_at,
      rejection_reason: isProfileRevision
        ? seller.profile_rejection_reason
        : seller.rejection_reason,
      documents: signedDocuments,
      payout_account: revealPayoutAccount(
        isProfileRevision && proposedPayout ? proposedPayout : payoutAccount
      ),
      is_profile_revision: isProfileRevision,
      approved_profile: isProfileRevision
        ? {
            ...seller,
            payout_account: revealPayoutAccount(payoutAccount),
            pending_profile_data: undefined,
          }
        : null,
    },
    defaultCommissionRate: Number(financeSettings.commission_rate),
  });
}

export async function PATCH(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  if (!requireRole(request, ['master_admin', 'marketplace_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตั้งค่าค่าธรรมเนียมร้านค้า' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Object.hasOwn(body, 'commissionRateOverride')) {
    return NextResponse.json({ message: 'ไม่พบค่าธรรมเนียมที่ต้องการบันทึก' }, { status: 400 });
  }

  const commissionRateOverride =
    body.commissionRateOverride === null || body.commissionRateOverride === ''
      ? null
      : Number(body.commissionRateOverride);
  if (
    commissionRateOverride !== null &&
    (!Number.isFinite(commissionRateOverride) ||
      commissionRateOverride < 0 ||
      commissionRateOverride > 100)
  ) {
    return NextResponse.json(
      { message: 'ค่าธรรมเนียมร้านค้าต้องอยู่ระหว่าง 0–100%' },
      { status: 400 }
    );
  }

  const { id } = await params;
  const { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .update({
      commission_rate_override: commissionRateOverride,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .neq('owner_role', 'master_admin')
    .select('*')
    .maybeSingle();

  if (error || !seller) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบร้านค้าที่ต้องการตั้งค่า' },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json({ seller });
}
