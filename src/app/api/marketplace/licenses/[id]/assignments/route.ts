import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

type Context = { params: Promise<{ id: string }> };

async function loadLicense(id: string, schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from('marketplace_school_licenses')
    .select('*')
    .eq('id', id)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function POST(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'เฉพาะผู้ดูแลโรงเรียนเท่านั้น' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const teacherId = String(body?.teacherId ?? '');
  const license = await loadLicense(id, caller.schoolId).catch(() => null);
  if (!license) return NextResponse.json({ message: 'ไม่พบ License' }, { status: 404 });
  if (license.license_scope !== 'teacher') {
    return NextResponse.json(
      { message: 'License นี้เปิดใช้ทั้งโรงเรียน ไม่ต้องเพิ่มครู' },
      { status: 400 }
    );
  }
  if (license.status !== 'active' || new Date(license.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ message: 'License หมดอายุหรือถูกยกเลิกแล้ว' }, { status: 409 });
  }

  const [{ data: appTeacher }, { data: invitedTeacher }] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('id', teacherId)
      .eq('school_id', caller.schoolId)
      .eq('role', 'teacher')
      .eq('is_active', true)
      .maybeSingle(),
    supabaseAdmin
      .from('marketplace_school_members')
      .select('id')
      .eq('marketplace_user_id', teacherId)
      .eq('school_id', caller.schoolId)
      .eq('membership_role', 'teacher')
      .maybeSingle(),
  ]);
  if (!appTeacher && !invitedTeacher) {
    return NextResponse.json({ message: 'ไม่พบครูในโรงเรียนนี้' }, { status: 404 });
  }

  const { count } = await supabaseAdmin
    .from('marketplace_teacher_license_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('license_id', id)
    .is('revoked_at', null);
  if ((count ?? 0) >= Number(license.seat_count)) {
    return NextResponse.json({ message: 'ใช้ Seat ครบจำนวนแล้ว' }, { status: 409 });
  }

  const { data: existing } = await supabaseAdmin
    .from('marketplace_teacher_license_assignments')
    .select('id')
    .eq('license_id', id)
    .eq('teacher_id', teacherId)
    .is('revoked_at', null)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ message: 'ครูคนนี้อยู่ใน License แล้ว' }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from('marketplace_teacher_license_assignments').insert({
    license_id: id,
    teacher_id: teacherId,
    assigned_by: caller.sub,
  });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, message: 'เพิ่มครูเข้า License แล้ว' });
}

export async function DELETE(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireRole(request, ['school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'เฉพาะผู้ดูแลโรงเรียนเท่านั้น' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const teacherId = String(body?.teacherId ?? '');
  const license = await loadLicense(id, caller.schoolId).catch(() => null);
  if (!license) return NextResponse.json({ message: 'ไม่พบ License' }, { status: 404 });

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('marketplace_teacher_license_assignments')
    .update({ revoked_at: now, updated_at: now })
    .eq('license_id', id)
    .eq('teacher_id', teacherId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบครูใน License นี้' },
      { status: error ? 500 : 404 }
    );
  }
  return NextResponse.json({ success: true, message: 'นำครูออกจาก License แล้ว' });
}
