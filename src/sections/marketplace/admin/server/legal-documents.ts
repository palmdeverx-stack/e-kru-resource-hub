import 'server-only';

import { NextResponse } from 'next/server';

import { toBangkokISOString } from 'src/utils/timezone';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

export const LEGAL_DOCUMENT_TYPES = [
  'terms_of_service',
  'seller_agreement',
  'privacy_policy',
  'copyright_takedown',
  'refund_policy',
  'cookie_policy',
  'digital_product_license',
  'payment_payout_policy',
  'product_content_policy',
  'complaint_dispute_policy',
  'child_data_policy',
  'data_processing_agreement',
  'subscription_policy',
  'product_submission_terms',
] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

const TYPE_TITLES: Record<LegalDocumentType, string> = {
  terms_of_service: 'ข้อกำหนดการใช้บริการ',
  seller_agreement: 'ข้อตกลงการเป็นผู้ขาย',
  privacy_policy: 'นโยบายความเป็นส่วนตัว (PDPA)',
  copyright_takedown: 'นโยบายลิขสิทธิ์และการนำเนื้อหาออก',
  refund_policy: 'นโยบายการคืนเงิน',
  cookie_policy: 'นโยบายคุกกี้',
  digital_product_license: 'ใบอนุญาตใช้สินค้าดิจิทัล',
  payment_payout_policy: 'นโยบายการชำระเงิน ค่าธรรมเนียม และการโอนให้ผู้ขาย',
  product_content_policy: 'นโยบายสินค้าและเนื้อหา',
  complaint_dispute_policy: 'นโยบายข้อร้องเรียนและข้อพิพาท',
  child_data_policy: 'นโยบายข้อมูลเด็กและนักเรียน',
  data_processing_agreement: 'ข้อตกลงการประมวลผลข้อมูล (DPA)',
  subscription_policy: 'นโยบายแพ็กเกจ การต่ออายุ และการยกเลิก',
  product_submission_terms: 'เงื่อนไขการเผยแพร่สินค้า',
};

function isMaster(request: Request) {
  return requireRole(request, ['master_admin', 'super_admin']);
}

function plainText(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type ProviderSettings = {
  provider_type: 'individual' | 'company';
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  company_registration_no: string | null;
  tax_id: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

function inputFrom(
  body: Record<string, unknown>,
  callerId: string,
  provider: ProviderSettings | null
) {
  const documentType = String(body.documentType ?? '') as LegalDocumentType;
  const title = String(body.title ?? '').trim();
  const summary = String(body.summary ?? '').trim();
  const contentHtml = String(body.contentHtml ?? '').trim();
  const providerName =
    provider?.provider_type === 'company'
      ? String(provider.company_name ?? '').trim()
      : [provider?.first_name, provider?.last_name].filter(Boolean).join(' ').trim();
  const version = String(body.version ?? '').trim();
  const status = body.status === 'published' ? 'published' : 'draft';
  const effectiveAt = String(body.effectiveAt ?? '').trim();
  const effectiveAtIso = effectiveAt ? toBangkokISOString(effectiveAt) : null;

  if (!LEGAL_DOCUMENT_TYPES.includes(documentType)) return { error: 'ประเภทเอกสารไม่ถูกต้อง' };
  if (title.length < 3 || title.length > 180) return { error: 'ชื่อเอกสารต้องมี 3–180 ตัวอักษร' };
  if (summary.length > 500) return { error: 'คำอธิบายย่อต้องไม่เกิน 500 ตัวอักษร' };
  if (plainText(contentHtml).length < 20)
    return { error: 'เนื้อหาเอกสารต้องมีอย่างน้อย 20 ตัวอักษร' };
  if (/<script|javascript:|on\w+\s*=/i.test(contentHtml)) {
    return { error: 'เนื้อหาเอกสารมีโค้ดที่ไม่อนุญาต' };
  }
  if (!/^[a-zA-Z0-9._-]{1,30}$/.test(version)) {
    return { error: 'เวอร์ชันต้องมี 1–30 ตัว และใช้เฉพาะตัวอักษร ตัวเลข จุด ขีด' };
  }
  if (status === 'published') {
    if (
      providerName.length < 3 ||
      String(provider?.address ?? '').trim().length < 10 ||
      !String(provider?.contact_email ?? '').includes('@') ||
      (provider?.provider_type === 'company' &&
        (String(provider.company_registration_no ?? '').length !== 13 ||
          String(provider.tax_id ?? '').length !== 13)) ||
      !effectiveAt ||
      !effectiveAtIso
    ) {
      return {
        error:
          'ก่อนเผยแพร่ กรุณาบันทึกข้อมูลผู้ให้บริการส่วนกลางและวันที่เริ่มมีผลให้ครบถ้วน',
      };
    }
  }

  const now = new Date().toISOString();
  return {
    value: {
      document_type: documentType,
      title,
      summary: summary || null,
      content_html: contentHtml,
      provider_type: provider?.provider_type ?? 'individual',
      provider_name: providerName || null,
      provider_registration_no:
        provider?.provider_type === 'company' ? provider.company_registration_no : null,
      provider_tax_id: provider?.tax_id || null,
      provider_address: provider?.address || null,
      contact_email: provider?.contact_email || null,
      provider_phone: provider?.contact_phone || null,
      version,
      status,
      effective_at: effectiveAtIso,
      published_at: status === 'published' ? now : null,
      updated_by: callerId,
      updated_at: now,
    },
  };
}

export async function listLegalDocuments(request: Request) {
  const includeDrafts = new URL(request.url).searchParams.get('all') === '1';
  if (includeDrafts && !isMaster(request)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูเอกสารฉบับร่าง' }, { status: 403 });
  }
  let query = supabaseAdmin.from('marketplace_legal_documents').select('*').order('document_type');
  if (!includeDrafts) query = query.eq('status', 'published');
  const { data, error } = await query;
  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ items: [], setupRequired: true });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function createLegalDocument(request: Request) {
  const caller = isMaster(request);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์เพิ่มเอกสาร' }, { status: 403 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  const { data: provider, error: providerError } = await supabaseAdmin
    .from('marketplace_provider_settings')
    .select(
      'provider_type, first_name, last_name, company_name, company_registration_no, tax_id, address, contact_email, contact_phone'
    )
    .eq('id', 'default')
    .maybeSingle();
  if (providerError) return NextResponse.json({ message: providerError.message }, { status: 500 });
  const input = inputFrom(body, caller.sub, provider as ProviderSettings | null);
  if ('error' in input) return NextResponse.json({ message: input.error }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('marketplace_legal_documents')
    .insert(input.value)
    .select('*')
    .single();
  if (error || !data) {
    return NextResponse.json(
      {
        message:
          error?.code === '23505'
            ? 'มีเอกสารประเภทนี้แล้ว กรุณาแก้ไขรายการเดิม'
            : (error?.message ?? 'เพิ่มเอกสารไม่สำเร็จ'),
      },
      { status: error?.code === '23505' ? 409 : 500 }
    );
  }
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function updateLegalDocument(request: Request, id: string) {
  const caller = isMaster(request);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์แก้ไขเอกสาร' }, { status: 403 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  const { data: provider, error: providerError } = await supabaseAdmin
    .from('marketplace_provider_settings')
    .select(
      'provider_type, first_name, last_name, company_name, company_registration_no, tax_id, address, contact_email, contact_phone'
    )
    .eq('id', 'default')
    .maybeSingle();
  if (providerError) return NextResponse.json({ message: providerError.message }, { status: 500 });
  const input = inputFrom(body, caller.sub, provider as ProviderSettings | null);
  if ('error' in input) return NextResponse.json({ message: input.error }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('marketplace_legal_documents')
    .update(input.value)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบเอกสาร' },
      { status: error ? 500 : 404 }
    );
  }
  return NextResponse.json({ item: data });
}

export async function deleteLegalDocument(request: Request, id: string) {
  if (!isMaster(request)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ลบเอกสาร' }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from('marketplace_legal_documents')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบเอกสาร' },
      { status: error ? 500 : 404 }
    );
  }
  return NextResponse.json({ success: true });
}

export const legalDocumentTitle = (type: LegalDocumentType) => TYPE_TITLES[type];
