import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canViewViaPermission } from 'src/lib/department-permission-access';

import { getSchoolDocumentTemplate } from 'src/sections/documents/document-catalog';

// ----------------------------------------------------------------------

const DOCUMENT_FIELDS =
  'id, school_id, created_by, template_slug, title, purpose, status, submitted_at, completed_at, created_at, updated_at';

async function authorize(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller?.schoolId || !(await canViewViaPermission(caller, 'documents.access'))) {
    return null;
  }

  return caller;
}

export async function GET(request: Request) {
  const caller = await authorize(request);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึงเอกสาร' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('school_user_documents')
    .select(DOCUMENT_FIELDS)
    .eq('school_id', caller.schoolId)
    .eq('created_by', caller.sub)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(request: Request) {
  const caller = await authorize(request);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์สร้างเอกสาร' }, { status: 403 });
  }

  const body = await request.json();
  const templateSlug = typeof body.templateSlug === 'string' ? body.templateSlug.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : '';
  const template = getSchoolDocumentTemplate(templateSlug);

  if (!template) {
    return NextResponse.json({ message: 'กรุณาเลือกประเภทเอกสาร' }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ message: 'กรุณาระบุชื่อเอกสาร' }, { status: 400 });
  }
  if (title.length > 200 || purpose.length > 1000) {
    return NextResponse.json({ message: 'ข้อมูลเอกสารยาวเกินกำหนด' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('school_user_documents')
    .insert({
      school_id: caller.schoolId,
      created_by: caller.sub,
      template_slug: template.slug,
      title,
      purpose: purpose || null,
      status: 'draft',
    })
    .select(DOCUMENT_FIELDS)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถสร้างเอกสารได้' },
      { status: 500 }
    );
  }

  return NextResponse.json({ document: data }, { status: 201 });
}
