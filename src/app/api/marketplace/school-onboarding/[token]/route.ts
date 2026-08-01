import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import { seedDefaultDepartments } from 'src/lib/default-departments';

import { hashSchoolOnboardingToken } from 'src/sections/marketplace/checkout/server/school-onboarding';
import { grantFeatureEntitlementsForOrders } from 'src/sections/marketplace/checkout/server/grant-feature-entitlements';

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_: Request, context: RouteContext) {
  const { token } = await context.params;
  const { data, error } = await supabaseAdmin
    .from('marketplace_school_onboardings')
    .select('expires_at,completed_at,school:schools(id,name)')
    .eq('token_hash', hashSchoolOnboardingToken(token))
    .maybeSingle();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'ลิงก์ไม่ถูกต้อง' }, { status: 404 });
  return NextResponse.json({ onboarding: data });
}

export async function POST(request: Request, context: RouteContext) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireRole(request, ['marketplace_user']);
  if (!caller) {
    return NextResponse.json(
      { message: 'กรุณาเข้าสู่ระบบด้วยบัญชีที่ซื้อ License' },
      { status: 401 }
    );
  }
  const { token } = await context.params;
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  const code = String(body?.code ?? '').replace(/\D/g, '');
  if (
    name.length < 2 ||
    !/^\d{8}$/.test(code) ||
    body?.childDataAccepted !== true ||
    body?.dpaAccepted !== true
  ) {
    return NextResponse.json(
      { message: 'กรุณากรอกข้อมูลโรงเรียนและยอมรับเอกสารที่เกี่ยวข้องให้ครบ' },
      { status: 400 }
    );
  }

  const { data: onboarding, error } = await supabaseAdmin
    .from('marketplace_school_onboardings')
    .select('*')
    .eq('token_hash', hashSchoolOnboardingToken(token))
    .maybeSingle();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (
    !onboarding ||
    onboarding.buyer_id !== caller.sub ||
    onboarding.completed_at ||
    new Date(onboarding.expires_at) <= new Date()
  ) {
    return NextResponse.json(
      { message: 'ลิงก์ไม่ถูกต้อง หมดอายุ หรือถูกใช้งานแล้ว' },
      { status: 409 }
    );
  }

  const { data: existingSchool } = await supabaseAdmin
    .from('schools')
    .select('id')
    .eq('code', code)
    .maybeSingle();
  if (existingSchool) {
    return NextResponse.json(
      { message: 'รหัสโรงเรียนนี้มีอยู่แล้ว กรุณาติดต่อผู้ดูแลโรงเรียนเพื่อรับคำเชิญ' },
      { status: 409 }
    );
  }

  const { data: school, error: schoolError } = await supabaseAdmin
    .from('schools')
    .insert({
      name,
      code,
      email: onboarding.email,
      created_by: caller.sub,
      is_active: true,
    })
    .select('id,name')
    .single();
  if (schoolError || !school) {
    return NextResponse.json(
      { message: schoolError?.message ?? 'สร้างโรงเรียนไม่สำเร็จ' },
      { status: 500 }
    );
  }

  const { error: memberError } = await supabaseAdmin.from('marketplace_school_members').upsert(
    {
      school_id: school.id,
      marketplace_user_id: caller.sub,
      membership_role: 'school_admin',
    },
    { onConflict: 'school_id,marketplace_user_id' }
  );
  if (memberError) {
    return NextResponse.json({ message: memberError.message }, { status: 500 });
  }

  const { data: orders, error: orderError } = await supabaseAdmin
    .from('marketplace_orders')
    .update({ license_school_id: school.id, updated_at: new Date().toISOString() })
    .eq('payment_session_id', onboarding.payment_session_id)
    .eq('buyer_id', caller.sub)
    .is('license_school_id', null)
    .select('id');
  if (orderError) return NextResponse.json({ message: orderError.message }, { status: 500 });

  try {
    await seedDefaultDepartments(school.id);
    await grantFeatureEntitlementsForOrders((orders ?? []).map((order) => order.id));
  } catch (fulfillmentError) {
    return NextResponse.json(
      {
        message:
          fulfillmentError instanceof Error
            ? fulfillmentError.message
            : 'เปิดใช้งาน License ไม่สำเร็จ',
      },
      { status: 500 }
    );
  }

  const { data: legalDocuments, error: legalDocumentsError } = await supabaseAdmin
    .from('marketplace_legal_documents')
    .select('document_type,title,version,effective_at,content_html')
    .eq('status', 'published')
    .in('document_type', ['child_data_policy', 'data_processing_agreement']);
  if (legalDocumentsError) {
    return NextResponse.json({ message: legalDocumentsError.message }, { status: 500 });
  }

  const { error: onboardingUpdateError } = await supabaseAdmin
    .from('marketplace_school_onboardings')
    .update({
      school_id: school.id,
      child_data_accepted: true,
      dpa_accepted: true,
      legal_documents_snapshot: legalDocuments ?? [],
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', onboarding.id);
  if (onboardingUpdateError) {
    return NextResponse.json({ message: onboardingUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({ school, success: true });
}
