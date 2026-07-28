import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canViewViaPermission } from 'src/lib/department-permission-access';

import { getSchoolDocumentTemplate } from 'src/sections/documents/document-catalog';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

const DOCUMENT_FIELDS =
  'id, school_id, created_by, template_slug, title, purpose, status, submitted_at, completed_at, created_at, updated_at';

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller?.schoolId || !(await canViewViaPermission(caller, 'documents.access'))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการเอกสาร' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const action =
    body.action === 'update' || body.action === 'submit' || body.action === 'cancel'
      ? body.action
      : null;

  if (!action) {
    return NextResponse.json({ message: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('school_user_documents')
    .select('id, status')
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .eq('created_by', caller.sub)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ message: currentError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ message: 'ไม่พบเอกสารนี้' }, { status: 404 });
  }
  if (action === 'submit' && current.status !== 'draft') {
    return NextResponse.json({ message: 'ส่งได้เฉพาะเอกสารฉบับร่าง' }, { status: 409 });
  }
  if (action === 'update' && current.status !== 'draft') {
    return NextResponse.json({ message: 'แก้ไขได้เฉพาะเอกสารฉบับร่าง' }, { status: 409 });
  }
  if (action === 'cancel' && !['draft', 'submitted'].includes(current.status)) {
    return NextResponse.json({ message: 'ไม่สามารถยกเลิกเอกสารสถานะนี้ได้' }, { status: 409 });
  }

  let changes: Record<string, string | null>;
  if (action === 'update') {
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

    changes = {
      template_slug: template.slug,
      title,
      purpose: purpose || null,
    };
  } else if (action === 'submit') {
    changes = { status: 'submitted', submitted_at: new Date().toISOString() };
  } else {
    changes = { status: 'cancelled' };
  }

  const { data, error } = await supabaseAdmin
    .from('school_user_documents')
    .update(changes)
    .eq('id', current.id)
    .select(DOCUMENT_FIELDS)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถอัปเดตสถานะเอกสารได้' },
      { status: 500 }
    );
  }

  return NextResponse.json({ document: data });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller?.schoolId || !(await canViewViaPermission(caller, 'documents.access'))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ลบเอกสาร' }, { status: 403 });
  }

  const { id } = await params;
  const { data: current, error: currentError } = await supabaseAdmin
    .from('school_user_documents')
    .select('id, status')
    .eq('id', id)
    .eq('school_id', caller.schoolId)
    .eq('created_by', caller.sub)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ message: currentError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ message: 'ไม่พบเอกสารนี้' }, { status: 404 });
  }
  if (current.status !== 'draft') {
    return NextResponse.json({ message: 'ลบได้เฉพาะเอกสารฉบับร่าง' }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from('school_user_documents').delete().eq('id', current.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
