import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { provisionEkruSystemSeller } from 'src/sections/marketplace/seller/server/system-seller';
import { notifyMarketplaceAdmins } from 'src/sections/marketplace/admin/server/line-notifications';

const SELLER_TYPES = ['individual', 'teacher', 'school', 'company', 'publisher', 'university'];

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9ก-๙]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function withSellerRelations(seller: Record<string, unknown> | null) {
  if (!seller) return null;
  const [{ data: documents }, { data: payoutAccount }] = await Promise.all([
    supabaseAdmin.from('marketplace_seller_documents').select('*').eq('seller_id', seller.id),
    supabaseAdmin
      .from('marketplace_seller_payout_accounts')
      .select('*')
      .eq('seller_id', seller.id)
      .maybeSingle(),
  ]);
  const documentsWithUrls = await Promise.all(
    (documents ?? []).map(async (document) => {
      if (document.storage_bucket === 'marketplace-seller-assets') {
        const { data } = supabaseAdmin.storage
          .from(document.storage_bucket)
          .getPublicUrl(document.storage_path);
        return { ...document, url: data.publicUrl };
      }
      const { data } = await supabaseAdmin.storage
        .from(document.storage_bucket)
        .createSignedUrl(document.storage_path, 10 * 60);
      return { ...document, url: data?.signedUrl ?? null };
    })
  );
  return { ...seller, documents: documentsWithUrls, payout_account: payoutAccount };
}

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const { data: existingSeller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('*')
    .eq('owner_id', caller.sub)
    .maybeSingle();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  if (caller.role === 'master_admin' || caller.role === 'super_admin') {
    const result = await provisionEkruSystemSeller(caller.sub, {
      bio: existingSeller?.bio,
      contactEmail: existingSeller?.contact_email,
      displayName: existingSeller?.display_name,
      displayNameEn: existingSeller?.display_name_en,
    });
    if (result.error || !result.data) {
      return NextResponse.json(
        { message: result.error?.message ?? 'ไม่สามารถเตรียมร้านระบบ E-KRU ได้' },
        { status: 500 }
      );
    }
    return NextResponse.json({ seller: await withSellerRelations(result.data) });
  }
  return NextResponse.json({ seller: await withSellerRelations(existingSeller) });
}

export async function POST(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const body = await request.json().catch(() => null);

  if (caller.role === 'master_admin' || caller.role === 'super_admin') {
    const displayName = String(body?.displayName ?? '').trim();
    const companyName = String(body?.companyName ?? '').trim();
    const companyTaxId = String(body?.companyTaxId ?? '').replace(/\D/g, '');
    const businessAddress = String(body?.businessAddress ?? '').trim();
    if (displayName.length < 2 || displayName.length > 120) {
      return NextResponse.json(
        { message: 'ชื่อร้านทางการต้องมีความยาว 2–120 ตัวอักษร' },
        { status: 400 }
      );
    }
    if ((companyName && companyName.length < 2) || (companyTaxId && companyTaxId.length !== 13)) {
      return NextResponse.json(
        {
          message: 'ชื่อผู้ออกต้องมีอย่างน้อย 2 ตัวอักษร และเลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก',
        },
        { status: 400 }
      );
    }
    const result = await provisionEkruSystemSeller(caller.sub, {
      bio: String(body?.bio ?? '').trim(),
      businessAddress,
      companyName,
      companyTaxId,
      contactEmail: String(body?.contactEmail ?? '').trim(),
      displayName,
      displayNameEn: String(body?.displayNameEn ?? '').trim(),
    });
    if (result.error || !result.data) {
      return NextResponse.json({ message: result.error?.message }, { status: 500 });
    }
    return NextResponse.json({
      seller: await withSellerRelations(result.data),
      message: 'บันทึกข้อมูลร้านแล้ว',
    });
  }

  const action = body?.action === 'submit' ? 'submit' : 'save_draft';
  const displayName = String(body?.displayName ?? '').trim();
  const slug = normalizeSlug(String(body?.slug ?? displayName));
  const requestedType = String(body?.sellerType ?? '');
  const sellerType =
    caller.role === 'teacher' && !requestedType
      ? 'teacher'
      : SELLER_TYPES.includes(requestedType)
        ? requestedType
        : 'individual';
  const contactEmail = String(body?.contactEmail ?? '').trim();
  const sellerName = String(body?.sellerName ?? '').trim();
  const phone = String(body?.phone ?? '').replace(/[^\d+]/g, '');
  const bankCode = String(body?.bankCode ?? '').trim();
  const bankName = String(body?.bankName ?? '').trim();
  const accountNumber = String(body?.accountNumber ?? '').replace(/\D/g, '');
  const accountName = String(body?.accountName ?? '').trim();
  const now = new Date().toISOString();

  const { data: existing, error: findError } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('*')
    .eq('owner_id', caller.sub)
    .maybeSingle();
  if (findError) return NextResponse.json({ message: findError.message }, { status: 500 });
  if (existing?.status === 'suspended') {
    return NextResponse.json({ message: 'ร้านถูกระงับ กรุณาติดต่อผู้ดูแลระบบ' }, { status: 403 });
  }

  if (action === 'submit') {
    const { data: documents } = existing
      ? await supabaseAdmin
          .from('marketplace_seller_documents')
          .select('document_type')
          .eq('seller_id', existing.id)
      : { data: [] };
    const documentTypes = new Set((documents ?? []).map((item) => item.document_type));
    const companyValid =
      sellerType !== 'company' ||
      (String(body?.companyName ?? '').trim().length >= 2 &&
        String(body?.companyRegistrationNo ?? '').replace(/\D/g, '').length >= 10);
    if (
      displayName.length < 2 ||
      slug.length < 3 ||
      sellerName.length < 3 ||
      phone.length < 9 ||
      !contactEmail.includes('@') ||
      !bankCode ||
      !bankName ||
      accountNumber.length < 6 ||
      accountName.length < 2 ||
      !companyValid ||
      !documentTypes.has('store_logo') ||
      !documentTypes.has('identity_card') ||
      !documentTypes.has('bank_book') ||
      body?.sellerAgreement !== true ||
      body?.copyrightConfirmed !== true ||
      body?.feeAgreement !== true ||
      body?.pdpaAccepted !== true
    ) {
      return NextResponse.json(
        { message: 'กรุณากรอกข้อมูลที่จำเป็น อัปโหลดเอกสาร และยอมรับข้อตกลงให้ครบ' },
        { status: 400 }
      );
    }
  }

  const remainsActive = existing?.status === 'active';
  const { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .upsert(
      {
        owner_id: caller.sub,
        owner_role: caller.role,
        seller_type: sellerType,
        display_name: displayName || existing?.display_name || 'ร้านค้าของฉัน',
        display_name_en: String(body?.displayNameEn ?? '').trim() || null,
        slug: slug || existing?.slug || null,
        bio: String(body?.bio ?? '').trim() || null,
        contact_email: contactEmail || null,
        seller_name: sellerName || null,
        phone: phone || null,
        national_tax_id: String(body?.nationalTaxId ?? '').replace(/\D/g, '') || null,
        company_name: String(body?.companyName ?? '').trim() || null,
        company_registration_no:
          String(body?.companyRegistrationNo ?? '').replace(/\D/g, '') || null,
        company_tax_id: String(body?.companyTaxId ?? '').replace(/\D/g, '') || null,
        wizard_step: Math.min(5, Math.max(1, Number(body?.wizardStep) || 1)),
        status: remainsActive ? 'active' : action === 'submit' ? 'pending' : 'draft',
        submitted_at: action === 'submit' ? now : existing?.submitted_at,
        reviewed_at: remainsActive ? existing?.reviewed_at : null,
        reviewed_by: remainsActive ? existing?.reviewed_by : null,
        rejection_reason: action === 'submit' ? null : existing?.rejection_reason,
        seller_agreement_accepted_at:
          action === 'submit' && body.sellerAgreement
            ? now
            : existing?.seller_agreement_accepted_at,
        copyright_confirmed_at:
          action === 'submit' && body.copyrightConfirmed ? now : existing?.copyright_confirmed_at,
        fee_agreement_accepted_at:
          action === 'submit' && body.feeAgreement ? now : existing?.fee_agreement_accepted_at,
        pdpa_accepted_at:
          action === 'submit' && body.pdpaAccepted ? now : existing?.pdpa_accepted_at,
        updated_at: now,
      },
      { onConflict: 'owner_id' }
    )
    .select('*')
    .single();
  if (error || !seller) {
    return NextResponse.json(
      { message: error?.code === '23505' ? 'Slug URL นี้ถูกใช้แล้ว' : error?.message },
      { status: 500 }
    );
  }

  if (bankCode && bankName && accountNumber && accountName) {
    await supabaseAdmin.from('marketplace_seller_payout_accounts').upsert({
      seller_id: seller.id,
      bank_code: bankCode,
      bank_name: bankName,
      account_number: accountNumber,
      account_name: accountName,
      promptpay_id: String(body?.promptpayId ?? '').replace(/\D/g, '') || null,
      is_verified: false,
      updated_at: now,
    });
  }

  if (action === 'submit' && existing?.status !== 'pending') {
    await notifyMarketplaceAdmins({
      event: 'new_seller',
      sourceId: seller.id,
      message: `🏪 มีคำขอเปิดร้านใหม่\nชื่อร้าน: ${seller.display_name}\nผู้ขาย: ${seller.seller_name}`,
      actionUrl: `${new URL(request.url).origin}/dashboard/seller-approvals`,
    });
  }

  return NextResponse.json({
    seller: await withSellerRelations(seller),
    message: action === 'submit' ? 'ส่งคำขอเปิดร้านแล้ว' : 'บันทึกร่างแล้ว',
  });
}
