import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { createNotifications } from 'src/lib/notifications';
import { decodeSignatureDataUrl } from 'src/lib/signature-image';
import { canApproveSchedule, canManageClassroomSchedule } from 'src/lib/schedule-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

async function loadClassroom(id: string) {
  const { data } = await supabaseAdmin
    .from('classrooms')
    .select('id, name, grade_level, school_id')
    .eq('id', id)
    .maybeSingle();
  return data;
}

export async function GET(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const semesterId = searchParams.get('semesterId');
  if (!semesterId) {
    return NextResponse.json({ message: 'กรุณาเลือกภาคเรียน' }, { status: 400 });
  }

  const classroom = await loadClassroom(id);
  if (!classroom || !(await canManageClassroomSchedule(caller, classroom.school_id))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { data: approval } = await supabaseAdmin
    .from('classroom_schedule_approvals')
    .select(
      'status, submitted_at, approved_at, canceled_at, submitter_signature_url, submitter_signature_signed_at'
    )
    .eq('classroom_id', id)
    .eq('semester_id', semesterId)
    .maybeSingle();

  return NextResponse.json({ approval: approval ?? { status: 'draft' } });
}

export async function POST(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const { semesterId, action, signatureDataUrl } = await request.json();

  if (!semesterId || !['submit', 'approve', 'cancel'].includes(action)) {
    return NextResponse.json({ message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const classroom = await loadClassroom(id);
  if (!classroom) {
    return NextResponse.json({ message: 'ไม่พบห้องเรียนนี้' }, { status: 404 });
  }
  if (classroom.school_id !== caller.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  if (action === 'submit') {
    if (!(await canManageClassroomSchedule(caller, classroom.school_id))) {
      return NextResponse.json({ message: 'ไม่มีสิทธิ์ส่งตารางสอน' }, { status: 403 });
    }

    const submitterSignature = decodeSignatureDataUrl(signatureDataUrl);
    if (!submitterSignature) {
      return NextResponse.json({ message: 'กรุณาเซ็นลายเซ็นผู้จัดทำก่อนส่ง' }, { status: 400 });
    }

    const { data: existingApproval } = await supabaseAdmin
      .from('classroom_schedule_approvals')
      .select('id, status, submitter_signature_url')
      .eq('classroom_id', id)
      .eq('semester_id', semesterId)
      .maybeSingle();
    if (existingApproval?.status === 'submitted' && existingApproval.submitter_signature_url) {
      return NextResponse.json({ message: 'ตารางเรียนนี้ส่งให้ผู้อำนวยการแล้ว' }, { status: 409 });
    }
    if (existingApproval?.status === 'approved') {
      return NextResponse.json({ message: 'ตารางเรียนนี้ได้รับการอนุมัติแล้ว' }, { status: 409 });
    }
    const approvalId = existingApproval?.id ?? crypto.randomUUID();
    const submitterSignaturePath = `${classroom.school_id}/${approvalId}/submitter.png`;
    const { error: signatureError } = await supabaseAdmin.storage
      .from('schedule-approval-signatures')
      .upload(submitterSignaturePath, submitterSignature, {
        upsert: true,
        contentType: 'image/png',
      });
    if (signatureError) {
      return NextResponse.json({ message: signatureError.message }, { status: 500 });
    }

    const {
      data: { publicUrl: submitterSignatureUrl },
    } = supabaseAdmin.storage
      .from('schedule-approval-signatures')
      .getPublicUrl(submitterSignaturePath);
    const submittedAt = new Date().toISOString();

    const { data: approval, error } = await supabaseAdmin
      .from('classroom_schedule_approvals')
      .upsert(
        {
          id: approvalId,
          classroom_id: id,
          semester_id: semesterId,
          school_id: classroom.school_id,
          status: 'submitted',
          submitted_by: caller.sub,
          submitted_at: submittedAt,
          approved_by: null,
          approved_at: null,
          canceled_by: null,
          canceled_at: null,
          signature_url: null,
          signature_signed_at: null,
          submitter_signature_url: `${submitterSignatureUrl}?v=${Date.now()}`,
          submitter_signature_signed_at: submittedAt,
        },
        { onConflict: 'classroom_id,semester_id' }
      )
      .select(
        'status, submitted_at, approved_at, canceled_at, submitter_signature_url, submitter_signature_signed_at'
      )
      .single();

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    // Resolve approvers from their current role + staff-type/individual
    // permissions so notifications follow the same rules as the API.
    const { data: approvalCandidates } = await supabaseAdmin
      .from('app_users')
      .select('id, username, role, school_id')
      .eq('school_id', classroom.school_id)
      .in('role', ['school_admin', 'teacher'])
      .eq('is_active', true);
    const approvers = (
      await Promise.all(
        (approvalCandidates ?? []).map(async (candidate) => ({
          ...candidate,
          canApprove: await canApproveSchedule({
            sub: candidate.id,
            username: candidate.username,
            role: candidate.role as 'school_admin' | 'teacher',
            schoolId: candidate.school_id,
          }),
        }))
      )
    ).filter((candidate) => candidate.canApprove);

    await createNotifications(
      approvers.map((approver) => ({
        userId: approver.id,
        schoolId: classroom.school_id,
        type: 'schedule_submitted',
        title: `ตารางสอนห้อง ${classroom.name} ส่งมาให้ยืนยัน`,
        body: 'ฝ่ายจัดตารางสอนส่งตารางมาให้ตรวจสอบและยืนยัน',
        link:
          approver.role === 'school_admin'
            ? `/admin/schedule-approvals/${approvalId}`
            : `/teacher/schedule-approvals/${approvalId}`,
      }))
    );

    return NextResponse.json({ approval });
  }

  if (action === 'cancel') {
    if (!(await canManageClassroomSchedule(caller, classroom.school_id))) {
      return NextResponse.json({ message: 'ไม่มีสิทธิ์ยกเลิกการส่งตารางสอน' }, { status: 403 });
    }

    const { data: current } = await supabaseAdmin
      .from('classroom_schedule_approvals')
      .select('status')
      .eq('classroom_id', id)
      .eq('semester_id', semesterId)
      .maybeSingle();

    if (current?.status !== 'submitted') {
      return NextResponse.json(
        { message: 'ยกเลิกได้เฉพาะตารางสอนที่อยู่ในสถานะรอยืนยันเท่านั้น' },
        { status: 409 }
      );
    }

    const { data: approval, error } = await supabaseAdmin
      .from('classroom_schedule_approvals')
      .update({
        status: 'canceled',
        canceled_by: caller.sub,
        canceled_at: new Date().toISOString(),
      })
      .eq('classroom_id', id)
      .eq('semester_id', semesterId)
      .select('status, submitted_at, approved_at, canceled_at')
      .single();

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    return NextResponse.json({ approval });
  }

  // action === 'approve'
  if (!(await canApproveSchedule(caller))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ยืนยันตารางสอน' }, { status: 403 });
  }

  const signatureBuffer = decodeSignatureDataUrl(signatureDataUrl);
  if (!signatureBuffer) {
    return NextResponse.json({ message: 'กรุณาเซ็นลายเซ็นก่อนอนุมัติ' }, { status: 400 });
  }

  const { data: current } = await supabaseAdmin
    .from('classroom_schedule_approvals')
    .select('id, status, submitter_signature_url')
    .eq('classroom_id', id)
    .eq('semester_id', semesterId)
    .maybeSingle();

  if (current?.status !== 'submitted') {
    return NextResponse.json({ message: 'ตารางสอนนี้ยังไม่ถูกส่งมาให้ยืนยัน' }, { status: 409 });
  }
  if (!current.submitter_signature_url) {
    return NextResponse.json(
      { message: 'ผู้จัดทำตารางเรียนยังไม่ได้ลงลายเซ็นรับรอง' },
      { status: 409 }
    );
  }

  const signaturePath = `${classroom.school_id}/${current.id}/signature.png`;
  const { error: signatureError } = await supabaseAdmin.storage
    .from('schedule-approval-signatures')
    .upload(signaturePath, signatureBuffer, { upsert: true, contentType: 'image/png' });
  if (signatureError) {
    return NextResponse.json({ message: signatureError.message }, { status: 500 });
  }

  const {
    data: { publicUrl: signatureUrl },
  } = supabaseAdmin.storage.from('schedule-approval-signatures').getPublicUrl(signaturePath);
  const approvedAt = new Date().toISOString();

  const { data: approval, error } = await supabaseAdmin
    .from('classroom_schedule_approvals')
    .update({
      status: 'approved',
      approved_by: caller.sub,
      approved_at: approvedAt,
      canceled_by: null,
      canceled_at: null,
      signature_url: `${signatureUrl}?v=${Date.now()}`,
      signature_signed_at: approvedAt,
    })
    .eq('classroom_id', id)
    .eq('semester_id', semesterId)
    .select('status, submitted_at, approved_at, canceled_at, signature_url, signature_signed_at')
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const { data: homeroomTeachers } = await supabaseAdmin
    .from('classroom_homeroom_teachers')
    .select('teacher_id')
    .eq('classroom_id', id);

  await createNotifications(
    (homeroomTeachers ?? []).map((homeroom) => ({
      userId: homeroom.teacher_id,
      schoolId: classroom.school_id,
      type: 'schedule_approved',
      title: `ตารางสอนห้อง ${classroom.name} ได้รับการยืนยันแล้ว`,
      body: 'ผู้อำนวยการยืนยันตารางสอนของห้องนี้แล้ว พร้อมใช้งาน',
      link: '/teacher/timetable',
    }))
  );

  return NextResponse.json({ approval });
}
