import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';

type Context = { params: Promise<{ id: string }> };

const PROFILE_FIELDS = [
  'seller_type',
  'display_name',
  'display_name_en',
  'slug',
  'bio',
  'contact_email',
  'seller_name',
  'phone',
  'national_tax_id',
  'company_name',
  'company_registration_no',
  'company_tax_id',
  'business_address',
  'wizard_step',
  'logo_url',
  'cover_url',
  'seller_agreement_accepted_at',
  'copyright_confirmed_at',
  'fee_agreement_accepted_at',
  'pdpa_accepted_at',
] as const;

export async function PATCH(request: Request, { params }: Context) {
  const reviewer = requireRole(request, ['master_admin', 'super_admin']);
  if (!reviewer) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์อนุมัติร้านค้า' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const action = String(body.action ?? '');
  const reason = String(body.reason ?? '').trim();

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ message: 'คำสั่งตรวจสอบร้านค้าไม่ถูกต้อง' }, { status: 400 });
  }
  if (action === 'reject' && reason.length < 3) {
    return NextResponse.json(
      { message: 'กรุณาระบุเหตุผลที่ปฏิเสธอย่างน้อย 3 ตัวอักษร' },
      { status: 400 }
    );
  }

  const { data: existingSeller, error: findError } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (findError || !existingSeller) {
    return NextResponse.json(
      { message: findError?.message ?? 'ไม่พบคำขอเปิดร้าน' },
      { status: findError ? 500 : 404 }
    );
  }
  if (existingSeller.owner_role === 'master_admin') {
    return NextResponse.json(
      { message: 'ไม่สามารถเปลี่ยนสถานะร้านระบบ E-KRU ได้' },
      { status: 400 }
    );
  }
  const pendingProfile = existingSeller.pending_profile_data as Record<string, unknown> | null;
  const isProfileRevision =
    existingSeller.status === 'active' &&
    existingSeller.profile_review_status === 'pending' &&
    Boolean(pendingProfile);
  const sellerForReview = isProfileRevision
    ? { ...existingSeller, ...pendingProfile }
    : existingSeller;
  const proposedPayout = pendingProfile?.payout_account as Record<string, unknown> | undefined;

  if (action === 'approve') {
    const [{ data: documents }, { data: payoutAccount }] = await Promise.all([
      supabaseAdmin
        .from('marketplace_seller_documents')
        .select('document_type')
        .eq('seller_id', id),
      supabaseAdmin
        .from('marketplace_seller_payout_accounts')
        .select('seller_id')
        .eq('seller_id', id)
        .maybeSingle(),
    ]);
    const types = new Set((documents ?? []).map((document) => document.document_type));
    if (
      (existingSeller.status !== 'pending' && !isProfileRevision) ||
      !sellerForReview.logo_url ||
      !sellerForReview.seller_name ||
      !sellerForReview.phone ||
      !sellerForReview.contact_email ||
      !(isProfileRevision ? proposedPayout : payoutAccount) ||
      !types.has('identity_card') ||
      !types.has('bank_book') ||
      !sellerForReview.seller_agreement_accepted_at ||
      !sellerForReview.copyright_confirmed_at ||
      !sellerForReview.fee_agreement_accepted_at ||
      !sellerForReview.pdpa_accepted_at
    ) {
      return NextResponse.json(
        { message: 'ข้อมูล บัญชี เอกสาร หรือข้อตกลงของผู้ขายยังไม่ครบ' },
        { status: 400 }
      );
    }
  }

  const now = new Date().toISOString();
  const approvedProfile = isProfileRevision
    ? PROFILE_FIELDS.reduce<Record<string, unknown>>((result, field) => {
        if (Object.hasOwn(pendingProfile!, field)) result[field] = pendingProfile![field];
        return result;
      }, {})
    : {};
  const { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .update(
      isProfileRevision
        ? action === 'approve'
          ? {
              ...approvedProfile,
              pending_profile_data: null,
              profile_review_status: null,
              profile_submitted_at: null,
              profile_rejection_reason: null,
              reviewed_at: now,
              reviewed_by: reviewer.sub,
              updated_at: now,
            }
          : {
              profile_review_status: 'rejected',
              profile_rejection_reason: reason,
              reviewed_at: now,
              reviewed_by: reviewer.sub,
              updated_at: now,
            }
        : {
            status: action === 'approve' ? 'active' : 'rejected',
            reviewed_at: now,
            reviewed_by: reviewer.sub,
            rejection_reason: action === 'reject' ? reason : null,
            updated_at: now,
          }
    )
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error || !seller) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบคำขอเปิดร้าน' },
      { status: error ? 500 : 404 }
    );
  }

  if (action === 'approve') {
    if (isProfileRevision && proposedPayout) {
      const { error: payoutError } = await supabaseAdmin
        .from('marketplace_seller_payout_accounts')
        .upsert(
          {
            seller_id: id,
            ...proposedPayout,
            is_verified: true,
            verified_at: now,
            verified_by: reviewer.sub,
            updated_at: now,
          },
          { onConflict: 'seller_id' }
        );
      if (payoutError) {
        return NextResponse.json({ message: payoutError.message }, { status: 500 });
      }
    } else {
      await supabaseAdmin
        .from('marketplace_seller_payout_accounts')
        .update({ is_verified: true, verified_at: now, verified_by: reviewer.sub, updated_at: now })
        .eq('seller_id', id);
    }
  }

  await writeSecurityAudit({
    request,
    actorId: reviewer.sub,
    actorUsername: reviewer.username,
    actorRole: reviewer.role,
    category: 'admin',
    action: `marketplace.seller_${action}`,
    targetType: 'marketplace_seller',
    targetId: id,
    result: 'success',
    metadata: {
      previous_status: existingSeller.status,
      new_status: seller.status,
      profile_revision: isProfileRevision,
      ...(action === 'reject' && { reason }),
    },
  });

  return NextResponse.json({ seller });
}
