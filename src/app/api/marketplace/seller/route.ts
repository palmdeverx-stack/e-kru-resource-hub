import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import { revealPayoutAccount, encryptPayoutAccountFields } from 'src/lib/financial-data-cipher';

import { findThaiBank } from 'src/sections/marketplace/shared/thai-banks';
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
  const documentsWithUrls = (documents ?? []).map((document) => {
    if (document.storage_bucket === 'marketplace-seller-assets') {
      const { data } = supabaseAdmin.storage
        .from(document.storage_bucket)
        .getPublicUrl(document.storage_path);
      return { ...document, url: data.publicUrl };
    }
    return {
      ...document,
      url: `/api/marketplace/seller/documents?documentId=${encodeURIComponent(document.id)}`,
    };
  });
  return {
    ...seller,
    documents: documentsWithUrls,
    payout_account: revealPayoutAccount(payoutAccount),
  };
}

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const targetSellerId = new URL(request.url).searchParams.get('sellerId');
  if (targetSellerId) {
    if (caller.role !== 'master_admin')
      return NextResponse.json({ message: 'ไม่มีสิทธิ์แก้ไขร้านทางการนี้' }, { status: 403 });
    const { data: target, error: targetError } = await supabaseAdmin
      .from('marketplace_sellers')
      .select('*')
      .eq('id', targetSellerId)
      .maybeSingle();
    if (targetError)
      return NextResponse.json({ message: 'โหลดข้อมูลร้านค้าไม่สำเร็จ' }, { status: 500 });
    if (!target) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });
    if (target.owner_role !== 'master_admin')
      return NextResponse.json(
        { message: 'เส้นทางนี้ใช้แก้ไขได้เฉพาะร้านทางการ' },
        { status: 403 }
      );
    return NextResponse.json({ seller: await withSellerRelations(target) });
  }

  if (new URL(request.url).searchParams.get('summary') === '1') {
    const { data: summary, error: summaryError } = await supabaseAdmin
      .from('marketplace_sellers')
      .select(
        'id, owner_id, owner_role, display_name, bio, logo_url, cover_url, seller_name, phone, contact_email, status, profile_review_status, profile_rejection_reason, rejection_reason, seller_agreement_accepted_at, copyright_confirmed_at, fee_agreement_accepted_at, pdpa_accepted_at, document_count:marketplace_seller_documents(count), payout_count:marketplace_seller_payout_accounts(count)'
      )
      .eq('owner_id', caller.sub)
      .maybeSingle();
    if (summaryError) return NextResponse.json({ message: summaryError.message }, { status: 500 });
    if (summary && !(caller.role === 'master_admin' && summary.status === 'suspended')) {
      const { document_count, payout_count, ...seller } = summary;
      const count = (value: unknown) => {
        const row = Array.isArray(value) ? value[0] : value;
        return Number((row as { count?: number } | null)?.count ?? 0);
      };
      return NextResponse.json({
        seller: {
          ...seller,
          has_documents: count(document_count) > 0,
          has_payout_account: count(payout_count) > 0,
        },
      });
    }
    if (!['master_admin', 'marketplace_admin'].includes(caller.role))
      return NextResponse.json({ seller: null });
  }

  const { data: existingSeller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('*')
    .eq('owner_id', caller.sub)
    .maybeSingle();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  if (caller.role === 'master_admin' && existingSeller?.status === 'suspended') {
    const { data: sharedStores, error: sharedError } = await supabaseAdmin
      .from('marketplace_sellers')
      .select('*')
      .eq('owner_role', 'master_admin')
      .eq('status', 'active')
      .limit(2);
    if (sharedError)
      return NextResponse.json({ message: 'โหลดร้านทางการไม่สำเร็จ' }, { status: 500 });
    // Resolve only an unambiguous active official store; never reactivate the suspended store.
    if (sharedStores?.length === 1)
      return NextResponse.json({ seller: await withSellerRelations(sharedStores[0]) });
  }

  if (caller.role === 'master_admin' || caller.role === 'marketplace_admin') {
    if (existingSeller?.owner_role === 'master_admin') {
      return NextResponse.json({ seller: await withSellerRelations(existingSeller) });
    }
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
  const sellerWithRelations = await withSellerRelations(existingSeller);
  const pendingProfile = existingSeller?.pending_profile_data as Record<string, unknown> | null;
  if (new URL(request.url).searchParams.get('edit') === '1' && pendingProfile) {
    const pendingPayout = pendingProfile.payout_account as Record<string, unknown> | undefined;
    return NextResponse.json({
      seller: {
        ...sellerWithRelations,
        ...pendingProfile,
        payout_account: revealPayoutAccount(pendingPayout),
      },
    });
  }
  return NextResponse.json({ seller: sellerWithRelations });
}

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  if (
    !(await isActionAllowed({
      request,
      action: 'marketplace-seller-profile',
      subject: caller.sub,
      maxAttempts: 30,
      windowSeconds: 5 * 60,
    }))
  ) {
    return NextResponse.json({ message: 'บันทึกข้อมูลร้านบ่อยเกินไป' }, { status: 429 });
  }
  const body = await request.json().catch(() => null);

  let systemSellerOwnerId = caller.sub;
  if (body?.sellerId) {
    if (caller.role !== 'master_admin' || typeof body.sellerId !== 'string')
      return NextResponse.json({ message: 'ไม่มีสิทธิ์แก้ไขร้านทางการนี้' }, { status: 403 });
    const { data: target, error: targetError } = await supabaseAdmin
      .from('marketplace_sellers')
      .select('id, owner_id, owner_role, status')
      .eq('id', body.sellerId)
      .maybeSingle();
    if (targetError)
      return NextResponse.json({ message: 'โหลดข้อมูลร้านค้าไม่สำเร็จ' }, { status: 500 });
    if (!target) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });
    if (target.owner_role !== 'master_admin')
      return NextResponse.json(
        { message: 'เส้นทางนี้ใช้แก้ไขได้เฉพาะร้านทางการ' },
        { status: 403 }
      );
    if (target.status === 'suspended')
      return NextResponse.json({ message: 'ร้านถูกระงับการใช้งาน' }, { status: 403 });
    systemSellerOwnerId = target.owner_id;
  }

  if (caller.role === 'master_admin' && !body?.sellerId) {
    const { data: ownSeller, error: ownError } = await supabaseAdmin
      .from('marketplace_sellers')
      .select('id, status')
      .eq('owner_id', caller.sub)
      .maybeSingle();
    if (ownError)
      return NextResponse.json({ message: 'โหลดข้อมูลร้านค้าไม่สำเร็จ' }, { status: 500 });
    if (ownSeller?.status === 'suspended') {
      const { data: sharedStores, error: sharedError } = await supabaseAdmin
        .from('marketplace_sellers')
        .select('id, owner_id')
        .eq('owner_role', 'master_admin')
        .eq('status', 'active')
        .limit(2);
      if (sharedError)
        return NextResponse.json({ message: 'โหลดร้านทางการไม่สำเร็จ' }, { status: 500 });
      if (sharedStores?.length !== 1)
        return NextResponse.json(
          { message: 'กรุณาเลือกแก้ไขร้านทางการที่เปิดใช้งานจากหน้าร้าน' },
          { status: 409 }
        );
      systemSellerOwnerId = sharedStores[0].owner_id;
    }
  }

  if (caller.role === 'master_admin' || caller.role === 'marketplace_admin') {
    const displayName = String(body?.displayName ?? '').trim();
    const companyName = String(body?.companyName ?? '').trim();
    const companyTaxId = String(body?.companyTaxId ?? '').replace(/\D/g, '');
    const businessAddress = String(body?.businessAddress ?? '').trim();
    const requestedBankCode = String(body?.bankCode ?? '').trim();
    const requestedBankName = String(body?.bankName ?? '').trim();
    const selectedBank = findThaiBank(requestedBankCode) ?? findThaiBank(requestedBankName);
    const accountNumber = String(body?.accountNumber ?? '').replace(/\D/g, '');
    const accountName = String(body?.accountName ?? '').trim();
    const promptpayId = String(body?.promptpayId ?? '').replace(/\D/g, '') || null;
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
    if (!selectedBank || accountNumber.length < 6 || accountName.length < 2) {
      return NextResponse.json(
        { message: 'กรุณากรอกธนาคาร ชื่อบัญชี และเลขบัญชีรับเงินของร้านระบบให้ครบถ้วน' },
        { status: 400 }
      );
    }
    const result = await provisionEkruSystemSeller(systemSellerOwnerId, {
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
    const { error: payoutError } = await supabaseAdmin
      .from('marketplace_seller_payout_accounts')
      .upsert(
        {
          seller_id: result.data.id,
          bank_code: selectedBank.code,
          bank_name: selectedBank.name,
          account_name: accountName,
          ...encryptPayoutAccountFields(accountNumber, promptpayId),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'seller_id' }
      );
    if (payoutError) {
      return NextResponse.json({ message: payoutError.message }, { status: 500 });
    }
    return NextResponse.json({
      seller: await withSellerRelations(result.data),
      message: 'บันทึกข้อมูลร้านและบัญชีรับเงินแล้ว',
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
  const phone = String(body?.phone ?? '').trim();
  if (phone && !/^\d{1,10}$/.test(phone)) {
    return NextResponse.json({ message: 'เบอร์โทรต้องเป็นตัวเลขไม่เกิน 10 หลัก' }, { status: 400 });
  }
  if (action === 'submit' && !/^\d{10}$/.test(phone)) {
    return NextResponse.json({ message: 'กรุณากรอกเบอร์โทรเป็นตัวเลข 10 หลัก' }, { status: 400 });
  }
  const requestedBankCode = String(body?.bankCode ?? '').trim();
  const requestedBankName = String(body?.bankName ?? '').trim();
  const selectedBank = findThaiBank(requestedBankCode) ?? findThaiBank(requestedBankName);
  const bankCode = selectedBank?.code ?? requestedBankCode;
  const bankName = selectedBank?.name ?? requestedBankName;
  const accountNumber = String(body?.accountNumber ?? '').replace(/\D/g, '');
  const accountName = String(body?.accountName ?? '').trim();
  const now = new Date().toISOString();

  const [{ data: existing, error: findError }, { data: ownerProfile }] = await Promise.all([
    supabaseAdmin.from('marketplace_sellers').select('*').eq('owner_id', caller.sub).maybeSingle(),
    supabaseAdmin
      .from(caller.role === 'marketplace_user' ? 'marketplace_users' : 'app_users')
      .select('avatar_url')
      .eq('id', caller.sub)
      .maybeSingle(),
  ]);
  if (findError) return NextResponse.json({ message: findError.message }, { status: 500 });
  if (existing?.status === 'suspended') {
    return NextResponse.json({ message: 'ร้านถูกระงับ กรุณาติดต่อผู้ดูแลระบบ' }, { status: 403 });
  }

  if (action === 'submit') {
    const { data: legalDocuments, error: legalDocumentsError } = await supabaseAdmin
      .from('marketplace_legal_documents')
      .select('document_type')
      .eq('status', 'published')
      .in('document_type', [
        'seller_agreement',
        'copyright_takedown',
        'payment_payout_policy',
        'privacy_policy',
      ]);
    if (legalDocumentsError) {
      return NextResponse.json({ message: legalDocumentsError.message }, { status: 500 });
    }
    const legalDocumentTypes = new Set((legalDocuments ?? []).map((item) => item.document_type));
    const companyValid =
      sellerType !== 'company' ||
      (String(body?.companyName ?? '').trim().length >= 2 &&
        String(body?.companyRegistrationNo ?? '').replace(/\D/g, '').length >= 10);
    if (
      displayName.length < 2 ||
      slug.length < 3 ||
      sellerName.length < 3 ||
      !/^\d{10}$/.test(phone) ||
      !contactEmail.includes('@') ||
      !selectedBank ||
      !bankCode ||
      !bankName ||
      accountNumber.length < 6 ||
      accountName.length < 2 ||
      !companyValid ||
      !['seller_agreement', 'copyright_takedown', 'payment_payout_policy', 'privacy_policy'].every(
        (documentType) => legalDocumentTypes.has(documentType)
      ) ||
      body?.sellerAgreement !== true ||
      body?.copyrightConfirmed !== true ||
      body?.feeAgreement !== true ||
      body?.pdpaAccepted !== true
    ) {
      return NextResponse.json(
        {
          message:
            legalDocumentTypes.size < 4
              ? 'ยังไม่มีข้อตกลงผู้ขายฉบับเผยแพร่ครบถ้วน กรุณาให้ผู้ดูแลเผยแพร่เอกสารฉบับสมบูรณ์'
              : 'กรุณากรอกข้อมูลที่จำเป็น อัปโหลดเอกสาร และยอมรับข้อตกลงให้ครบ',
        },
        { status: 400 }
      );
    }
  }

  const remainsActive = existing?.status === 'active';
  const existingPending = (existing?.pending_profile_data ?? {}) as Record<string, unknown>;
  const sellerProfilePayload = {
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
    company_registration_no: String(body?.companyRegistrationNo ?? '').replace(/\D/g, '') || null,
    company_tax_id: String(body?.companyTaxId ?? '').replace(/\D/g, '') || null,
    business_address: String(body?.businessAddress ?? '').trim() || null,
    wizard_step: Math.min(5, Math.max(1, Number(body?.wizardStep) || 1)),
    logo_url: existingPending.logo_url ?? existing?.logo_url ?? ownerProfile?.avatar_url ?? null,
    cover_url: existingPending.cover_url ?? existing?.cover_url ?? null,
    seller_agreement_accepted_at:
      action === 'submit' && body.sellerAgreement ? now : existing?.seller_agreement_accepted_at,
    copyright_confirmed_at:
      action === 'submit' && body.copyrightConfirmed ? now : existing?.copyright_confirmed_at,
    fee_agreement_accepted_at:
      action === 'submit' && body.feeAgreement ? now : existing?.fee_agreement_accepted_at,
    pdpa_accepted_at: action === 'submit' && body.pdpaAccepted ? now : existing?.pdpa_accepted_at,
  };
  const promptpayId = String(body?.promptpayId ?? '').replace(/\D/g, '') || null;
  const plainPayoutPayload = {
    bank_code: bankCode || null,
    bank_name: bankName || null,
    account_number: accountNumber || null,
    account_name: accountName || null,
    promptpay_id: promptpayId,
  };
  const payoutPayload = {
    bank_code: bankCode || null,
    bank_name: bankName || null,
    account_name: accountName || null,
    ...encryptPayoutAccountFields(accountNumber || null, promptpayId),
  };

  if (remainsActive) {
    if (sellerProfilePayload.slug && sellerProfilePayload.slug !== existing.slug) {
      const { data: slugOwner } = await supabaseAdmin
        .from('marketplace_sellers')
        .select('id')
        .ilike('slug', sellerProfilePayload.slug)
        .neq('id', existing.id)
        .maybeSingle();
      if (slugOwner) {
        return NextResponse.json({ message: 'Slug URL นี้ถูกใช้แล้ว' }, { status: 409 });
      }
    }
    const pendingProfileData = { ...sellerProfilePayload, payout_account: payoutPayload };
    const { data: stagedSeller, error: stageError } = await supabaseAdmin
      .from('marketplace_sellers')
      .update({
        pending_profile_data: pendingProfileData,
        profile_review_status: action === 'submit' ? 'pending' : 'draft',
        profile_submitted_at: action === 'submit' ? now : existing.profile_submitted_at,
        profile_rejection_reason: null,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (stageError || !stagedSeller) {
      return NextResponse.json({ message: stageError?.message }, { status: 500 });
    }
    if (action === 'submit') {
      await notifyMarketplaceAdmins({
        event: 'new_seller',
        sourceId: existing.id,
        title: 'มีข้อมูลร้านค้าแก้ไขรอตรวจสอบ',
        dedupeKey: `seller_revision:${existing.id}:${now}`,
        message: `📝 ร้านค้าส่งข้อมูลแก้ไขให้ตรวจสอบ\nชื่อร้าน: ${sellerProfilePayload.display_name}\nผู้ขาย: ${sellerProfilePayload.seller_name}`,
        actionUrl: `${new URL(request.url).origin}/dashboard/seller-approvals/${existing.id}`,
      }).catch(() => console.error('Failed to notify admins of seller profile revision'));
    }
    const sellerWithRelations = await withSellerRelations(stagedSeller);
    return NextResponse.json({
      seller: {
        ...sellerWithRelations,
        ...sellerProfilePayload,
        payout_account: plainPayoutPayload,
      },
      message:
        action === 'submit'
          ? 'ส่งข้อมูลแก้ไขให้ผู้ดูแลตรวจสอบแล้ว ข้อมูลเดิมจะยังแสดงจนกว่าจะอนุมัติ'
          : 'บันทึกข้อมูลแก้ไขเป็นแบบร่างแล้ว',
    });
  }

  const { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .upsert(
      {
        ...sellerProfilePayload,
        status: action === 'submit' ? 'pending' : 'draft',
        submitted_at: action === 'submit' ? now : existing?.submitted_at,
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: action === 'submit' ? null : existing?.rejection_reason,
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
    const { error: payoutError } = await supabaseAdmin
      .from('marketplace_seller_payout_accounts')
      .upsert(
        {
          seller_id: seller.id,
          bank_code: bankCode,
          bank_name: bankName,
          account_name: accountName,
          ...encryptPayoutAccountFields(accountNumber, promptpayId),
          is_verified: false,
          updated_at: now,
        },
        { onConflict: 'seller_id' }
      );
    if (payoutError) {
      return NextResponse.json(
        {
          message:
            payoutError.code === '23502'
              ? 'บันทึกบัญชีรับเงินไม่สำเร็จ: กรุณาอัปเดตฐานข้อมูลให้รองรับเลขบัญชีเข้ารหัส'
              : `บันทึกบัญชีรับเงินไม่สำเร็จ: ${payoutError.message}`,
        },
        { status: 500 }
      );
    }
  }

  if (action === 'submit' && existing?.status !== 'pending') {
    await notifyMarketplaceAdmins({
      event: 'new_seller',
      sourceId: seller.id,
      dedupeKey: `seller_request:${seller.id}:${seller.submitted_at ?? now}`,
      message: `🏪 มีคำขอเปิดร้านใหม่\nชื่อร้าน: ${seller.display_name}\nผู้ขาย: ${seller.seller_name}`,
      actionUrl: `${new URL(request.url).origin}/dashboard/seller-approvals/${seller.id}`,
    }).catch(() => console.error('Failed to notify admins of new seller request'));
  }

  return NextResponse.json({
    seller: await withSellerRelations(seller),
    message: action === 'submit' ? 'ส่งคำขอเปิดร้านแล้ว' : 'บันทึกร่างแล้ว',
  });
}
