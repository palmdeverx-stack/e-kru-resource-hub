import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { withMediaUrls } from 'src/sections/marketplace/seller/server/product-media';
import { getEligibleLicenseSchools } from 'src/sections/marketplace/checkout/server/school-targets';

type Context = { params: Promise<{ token: string }> };

const QUOTE_SELECT =
  '*, seller:marketplace_sellers(id,display_name,logo_url,contact_email), product:marketplace_products(id,title,title_en,short_description,short_description_en,price,currency,resource_type,license_scope,grant_duration_days,cover_url,status,images:marketplace_product_images(*))';

type QuoteRow = {
  id: string;
  status: string;
  accepted_by: string | null;
  expires_at: string;
  school_id: string | null;
  school_name: string;
  school_code: string | null;
  school_email: string;
  negotiated_price: number;
  product: Record<string, unknown> | Array<Record<string, unknown>> | null;
  [key: string]: unknown;
};

async function loadQuote(token: string) {
  return supabaseAdmin
    .from('marketplace_sales_deals')
    .select(QUOTE_SELECT)
    .eq('public_token', token)
    .maybeSingle();
}

async function serializeQuote(deal: QuoteRow) {
  const rawProduct = Array.isArray(deal.product) ? deal.product[0] : deal.product;
  const product = rawProduct ? await withMediaUrls({ ...rawProduct, files: [] }) : null;
  return {
    ...deal,
    product: product ? { ...product, price: Number(deal.negotiated_price) } : null,
  };
}

export async function GET(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  const { token } = await params;
  const { data: rawDeal, error } = await loadQuote(token);
  const deal = rawDeal as QuoteRow | null;
  if (error || !deal) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบข้อเสนอขายนี้' },
      { status: error ? 500 : 404 }
    );
  }
  if (new Date(deal.expires_at) <= new Date() && !['paid', 'active'].includes(deal.status)) {
    await supabaseAdmin
      .from('marketplace_sales_deals')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', deal.id);
    deal.status = 'expired';
  } else if (deal.status === 'sent') {
    await supabaseAdmin
      .from('marketplace_sales_deals')
      .update({ status: 'viewed', updated_at: new Date().toISOString() })
      .eq('id', deal.id);
    deal.status = 'viewed';
  }
  return NextResponse.json({
    deal: await serializeQuote(deal),
    canCheckout: Boolean(caller && deal.accepted_by === caller.sub && deal.status === 'accepted'),
  });
}

export async function POST(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบก่อนยอมรับ' }, { status: 401 });
  const { token } = await params;
  const { data: rawDeal, error } = await loadQuote(token);
  const deal = rawDeal as QuoteRow | null;
  if (error || !deal) {
    return NextResponse.json({ message: error?.message ?? 'ไม่พบข้อเสนอขายนี้' }, { status: 404 });
  }
  if (!['sent', 'viewed'].includes(deal.status) || new Date(deal.expires_at) <= new Date()) {
    return NextResponse.json({ message: 'ข้อเสนอนี้หมดอายุหรือถูกดำเนินการแล้ว' }, { status: 409 });
  }
  const body = await request.json().catch(() => null);
  const signerName = String(body?.signerName ?? '').trim();
  if (
    signerName.length < 2 ||
    body?.authorityConfirmed !== true ||
    body?.termsAccepted !== true ||
    body?.pdpaAccepted !== true ||
    body?.childDataAccepted !== true ||
    body?.dpaAccepted !== true ||
    body?.subscriptionAccepted !== true
  ) {
    return NextResponse.json(
      { message: 'กรุณากรอกชื่อผู้ลงนามและยืนยันข้อตกลงให้ครบ' },
      { status: 400 }
    );
  }

  const product = Array.isArray(deal.product) ? deal.product[0] : deal.product;
  let schoolId = deal.school_id as string | null;
  if (product?.resource_type === 'feature_unlock' && product.license_scope !== 'individual') {
    if (!deal.school_code) {
      return NextResponse.json({ message: 'ข้อเสนอนี้ไม่มีรหัสโรงเรียน' }, { status: 400 });
    }
    const { data: existingSchool } = await supabaseAdmin
      .from('schools')
      .select('id,name')
      .eq('code', deal.school_code)
      .maybeSingle();
    if (existingSchool) {
      const eligible = await getEligibleLicenseSchools(caller);
      if (!eligible.some((school) => school.id === existingSchool.id)) {
        return NextResponse.json(
          { message: 'โรงเรียนนี้มีอยู่แล้ว กรุณาให้ผู้ดูแลโรงเรียนเป็นผู้ยอมรับข้อเสนอ' },
          { status: 403 }
        );
      }
      schoolId = existingSchool.id;
    } else {
      const { data: createdSchool, error: schoolError } = await supabaseAdmin
        .from('schools')
        .insert({
          name: deal.school_name,
          code: deal.school_code,
          email: deal.school_email,
          created_by: caller.sub,
        })
        .select('id')
        .single();
      if (schoolError || !createdSchool) {
        return NextResponse.json(
          { message: schoolError?.message ?? 'สร้างพื้นที่โรงเรียนไม่สำเร็จ' },
          { status: 500 }
        );
      }
      schoolId = createdSchool.id;
      let marketplaceUserId = caller.sub;
      if (caller.role !== 'marketplace_user') {
        const { data: appUser } = await supabaseAdmin
          .from('app_users')
          .select('auth_user_id')
          .eq('id', caller.sub)
          .maybeSingle();
        const { data: marketplaceUser } = appUser?.auth_user_id
          ? await supabaseAdmin
              .from('marketplace_users')
              .select('id')
              .eq('auth_user_id', appUser.auth_user_id)
              .maybeSingle()
          : { data: null };
        if (!marketplaceUser) {
          return NextResponse.json(
            { message: 'ไม่พบบัญชี Marketplace ที่เชื่อมกับผู้ลงนาม' },
            { status: 409 }
          );
        }
        marketplaceUserId = marketplaceUser.id;
      }
      const { error: memberError } = await supabaseAdmin.from('marketplace_school_members').upsert(
        {
          school_id: schoolId,
          marketplace_user_id: marketplaceUserId,
          membership_role: 'school_admin',
        },
        { onConflict: 'school_id,marketplace_user_id' }
      );
      if (memberError) {
        return NextResponse.json({ message: memberError.message }, { status: 500 });
      }
    }
  }

  const now = new Date().toISOString();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const { data: legalDocuments, error: legalDocumentsError } = await supabaseAdmin
    .from('marketplace_legal_documents')
    .select('document_type,title,version,effective_at,content_html')
    .eq('status', 'published')
    .in('document_type', [
      'terms_of_service',
      'privacy_policy',
      'child_data_policy',
      'data_processing_agreement',
      'subscription_policy',
    ]);
  if (legalDocumentsError) {
    return NextResponse.json({ message: legalDocumentsError.message }, { status: 500 });
  }
  const { error: signatureError } = await supabaseAdmin
    .from('marketplace_contract_signatures')
    .insert({
      sales_deal_id: deal.id,
      signer_user_id: caller.sub,
      signer_name: signerName,
      signer_position: String(body?.signerPosition ?? '').trim() || null,
      signer_email: deal.school_email,
      terms_accepted: true,
      authority_confirmed: true,
      pdpa_accepted: true,
      child_data_accepted: true,
      dpa_accepted: true,
      subscription_accepted: true,
      legal_documents_snapshot: legalDocuments ?? [],
      signed_ip: ip,
      signed_user_agent: request.headers.get('user-agent'),
    });
  if (signatureError) {
    return NextResponse.json({ message: signatureError.message }, { status: 500 });
  }
  const { data: accepted, error: acceptError } = await supabaseAdmin
    .from('marketplace_sales_deals')
    .update({
      school_id: schoolId,
      accepted_by: caller.sub,
      accepted_at: now,
      status: 'accepted',
      updated_at: now,
    })
    .eq('id', deal.id)
    .in('status', ['sent', 'viewed'])
    .select(QUOTE_SELECT)
    .single();
  if (acceptError || !accepted) {
    return NextResponse.json(
      { message: acceptError?.message ?? 'ยอมรับข้อเสนอไม่สำเร็จ' },
      { status: 409 }
    );
  }
  return NextResponse.json({
    deal: await serializeQuote(accepted as unknown as QuoteRow),
    canCheckout: true,
  });
}
