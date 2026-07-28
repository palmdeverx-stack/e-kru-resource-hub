import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canEditGradebook } from 'src/lib/grade-review-access';
import {
  loadTeacherAssignment,
  canAccessTeacherAssignment,
} from 'src/lib/teacher-assignment-access';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };

const BUCKET = 'assignment-attachments';

async function loadAssignmentWithAccess(id: string) {
  const { data: assignment } = await supabaseAdmin
    .from('assignments')
    .select('id, teacher_assignment_id, category')
    .eq('id', id)
    .maybeSingle();

  if (!assignment) return null;

  const teacherAssignment = await loadTeacherAssignment(assignment.teacher_assignment_id);

  return { assignment, teacherAssignment };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const loaded = await loadAssignmentWithAccess(id);
  if (!loaded || !canAccessTeacherAssignment(caller, loaded.teacherAssignment)) {
    return NextResponse.json({ message: 'ไม่พบรายการคะแนนหรือไม่มีสิทธิ์แก้ไข' }, { status: 404 });
  }
  if (!(await canEditGradebook(loaded.assignment.teacher_assignment_id))) {
    return NextResponse.json(
      { message: 'ผลการเรียนถูกส่งตรวจแล้ว ต้องรอฝ่ายวิชาการส่งกลับแก้ไขก่อน' },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const fullScore = Number(body?.fullScore);

  if (!title || title.length > 200) {
    return NextResponse.json(
      { message: 'กรุณากรอกชื่อรายการไม่เกิน 200 ตัวอักษร' },
      { status: 400 }
    );
  }
  if (description.length > 5000) {
    return NextResponse.json({ message: 'รายละเอียดต้องไม่เกิน 5,000 ตัวอักษร' }, { status: 400 });
  }
  if (!Number.isFinite(fullScore) || fullScore <= 0) {
    return NextResponse.json({ message: 'คะแนนเต็มต้องมากกว่า 0' }, { status: 400 });
  }

  const { data: highestScore, error: scoreError } = await supabaseAdmin
    .from('scores')
    .select('score')
    .eq('assignment_id', id)
    .not('score', 'is', null)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (scoreError) {
    return NextResponse.json({ message: scoreError.message }, { status: 500 });
  }
  if (highestScore?.score != null && Number(highestScore.score) > fullScore) {
    return NextResponse.json(
      { message: `คะแนนเต็มต้องไม่น้อยกว่าคะแนนสูงสุดที่กรอกไว้ (${highestScore.score})` },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('assignments')
    .update({ title, description: description || null, full_score: fullScore })
    .eq('id', id)
    .select(
      `id, title, description, full_score, due_at, category, created_at,
       attachments:assignment_attachments(id, file_name, file_url, mime_type, file_size, created_at)`
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถแก้ไขรายการคะแนนได้' },
      { status: 500 }
    );
  }

  return NextResponse.json({ assignment: data });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { id } = await params;
  const loaded = await loadAssignmentWithAccess(id);
  if (!loaded || !canAccessTeacherAssignment(caller, loaded.teacherAssignment)) {
    return NextResponse.json({ message: 'ไม่พบรายการคะแนนหรือไม่มีสิทธิ์ลบ' }, { status: 404 });
  }
  if (!(await canEditGradebook(loaded.assignment.teacher_assignment_id))) {
    return NextResponse.json(
      { message: 'ผลการเรียนถูกส่งตรวจแล้ว ต้องรอฝ่ายวิชาการส่งกลับแก้ไขก่อน' },
      { status: 409 }
    );
  }

  const { data: attachments } = await supabaseAdmin
    .from('assignment_attachments')
    .select('storage_path')
    .eq('assignment_id', id);

  const { error } = await supabaseAdmin.from('assignments').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const storagePaths = attachments?.map((file) => file.storage_path).filter(Boolean) ?? [];
  if (storagePaths.length) {
    await supabaseAdmin.storage.from(BUCKET).remove(storagePaths);
  }

  return NextResponse.json({ success: true });
}
