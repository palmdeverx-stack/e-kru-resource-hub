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
] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

const TYPE_TITLES: Record<LegalDocumentType, string> = {
  terms_of_service: 'ข้อกำหนดการใช้บริการ',
  seller_agreement: 'ข้อตกลงการเป็นผู้ขาย',
  privacy_policy: 'นโยบายความเป็นส่วนตัว (PDPA)',
  copyright_takedown: 'นโยบายลิขสิทธิ์และการนำเนื้อหาออก',
  refund_policy: 'นโยบายการคืนเงิน',
};

function isMaster(request: Request) {
  return requireRole(request, ['master_admin']);
}

function plainText(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inputFrom(body: Record<string, unknown>, callerId: string) {
  const documentType = String(body.documentType ?? '') as LegalDocumentType;
  const title = String(body.title ?? '').trim();
  const summary = String(body.summary ?? '').trim();
  const contentHtml = String(body.contentHtml ?? '').trim();
  const providerName = String(body.providerName ?? '').trim();
  const providerTaxId = String(body.providerTaxId ?? '').replace(/\D/g, '');
  const providerAddress = String(body.providerAddress ?? '').trim();
  const contactEmail = String(body.contactEmail ?? '').trim();
  const version = String(body.version ?? '').trim();
  const status = body.status === 'published' ? 'published' : 'draft';
  const effectiveAt = String(body.effectiveAt ?? '').trim();
  const effectiveAtIso = effectiveAt ? toBangkokISOString(effectiveAt) : null;

  if (!LEGAL_DOCUMENT_TYPES.includes(documentType)) return { error: 'ประเภทเอกสารไม่ถูกต้อง' };
  if (title.length < 3 || title.length > 180) return { error: 'ชื่อเอกสารต้องมี 3–180 ตัวอักษร' };
  if (summary.length > 500) return { error: 'คำอธิบายย่อต้องไม่เกิน 500 ตัวอักษร' };
  if (plainText(contentHtml).length < 20) return { error: 'เนื้อหาเอกสารต้องมีอย่างน้อย 20 ตัวอักษร' };
  if (/<script|javascript:|on\w+\s*=/i.test(contentHtml)) {
    return { error: 'เนื้อหาเอกสารมีโค้ดที่ไม่อนุญาต' };
  }
  if (!/^[a-zA-Z0-9._-]{1,30}$/.test(version)) {
    return { error: 'เวอร์ชันต้องมี 1–30 ตัว และใช้เฉพาะตัวอักษร ตัวเลข จุด ขีด' };
  }
  if (status === 'published') {
    if (
      providerName.length < 3 ||
      providerAddress.length < 10 ||
      !contactEmail.includes('@') ||
      !effectiveAt ||
      !effectiveAtIso
    ) {
      return {
        error:
          'ก่อนเผยแพร่ กรุณาระบุชื่อบุคคลผู้ให้บริการ ที่อยู่ อีเมล และวันที่เริ่มมีผลให้ครบ',
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
      provider_type: 'individual',
      provider_name: providerName || null,
      provider_tax_id: providerTaxId || null,
      provider_address: providerAddress || null,
      contact_email: contactEmail || null,
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
  let query = supabaseAdmin
    .from('marketplace_legal_documents')
    .select('*')
    .order('document_type');
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
  const input = inputFrom(body, caller.sub);
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
  const input = inputFrom(body, caller.sub);
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
