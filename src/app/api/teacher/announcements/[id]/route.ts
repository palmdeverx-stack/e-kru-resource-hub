import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { canManageViaPermission } from 'src/lib/department-permission-access';
import {
  removeAnnouncementImage,
  replaceAnnouncementImage,
  validateAnnouncementImage,
} from 'src/lib/announcement-image';

// ----------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> };
const TYPES = ['general', 'holiday', 'exam'];
const PRIORITIES = ['normal', 'important', 'urgent'];

async function getOwnedAnnouncement(
  id: string,
  schoolId: string,
  teacherId: string,
  isAdminLike: boolean
) {
  let query = supabaseAdmin
    .from('school_announcements')
    .select('id, image_url')
    .eq('id', id)
    .eq('school_id', schoolId);
  if (!isAdminLike) query = query.eq('created_by', teacherId);
  return query.maybeSingle();
}

async function getAllowedClassroomIds(schoolId: string, teacherId: string, isAdminLike: boolean) {
  if (isAdminLike) {
    const { data, error } = await supabaseAdmin
      .from('classrooms')
      .select('id')
      .eq('school_id', schoolId);
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((classroom) => classroom.id));
  }

  const { data, error } = await supabaseAdmin
    .from('classroom_homeroom_teachers')
    .select('classroom:classrooms!inner(id, school_id)')
    .eq('teacher_id', teacherId)
    .eq('classrooms.school_id', schoolId);
  if (error) throw new Error(error.message);

  return new Set(
    (data ?? []).map((row) => (row.classroom as unknown as { id: string }).id).filter(Boolean)
  );
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const isAdminLike = await canManageViaPermission(caller, 'announcements.manage');
  const { id } = await params;
  const { data: owned } = await getOwnedAnnouncement(id, caller.schoolId, caller.sub, isAdminLike);
  if (!owned)
    return NextResponse.json({ message: 'ไม่พบประกาศหรือไม่มีสิทธิ์แก้ไข' }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ message: 'ข้อมูลประกาศไม่ถูกต้อง' }, { status: 400 });
  }
  const title = String(formData.get('title') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const announcementType = String(formData.get('announcementType') ?? '');
  const priority = String(formData.get('priority') ?? '');
  let classroomIds: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get('classroomIds') ?? '[]'));
    classroomIds = Array.isArray(parsed)
      ? Array.from(
          new Set(parsed.filter((value: unknown): value is string => typeof value === 'string'))
        )
      : [];
  } catch {
    classroomIds = [];
  }
  const eventStart =
    typeof formData.get('eventStart') === 'string' && formData.get('eventStart')
      ? String(formData.get('eventStart'))
      : null;
  const eventEnd =
    typeof formData.get('eventEnd') === 'string' && formData.get('eventEnd')
      ? String(formData.get('eventEnd'))
      : null;
  const expiresAt =
    typeof formData.get('expiresAt') === 'string' && formData.get('expiresAt')
      ? String(formData.get('expiresAt'))
      : null;
  const imageValue = formData.get('image');
  const image = imageValue instanceof File && imageValue.size ? imageValue : null;
  const removeImage = formData.get('removeImage') === 'true';

  if (
    !title ||
    (!content && !image && (!owned.image_url || removeImage)) ||
    !classroomIds.length ||
    title.length > 200 ||
    content.length > 4000
  ) {
    return NextResponse.json(
      { message: 'กรุณากรอกหัวข้อ เพิ่มข้อความหรือรูปภาพ และเลือกห้องเรียนอย่างน้อย 1 ห้อง' },
      { status: 400 }
    );
  }
  const imageError = validateAnnouncementImage(image);
  if (imageError) return NextResponse.json({ message: imageError }, { status: 400 });
  if (!TYPES.includes(announcementType) || !PRIORITIES.includes(priority)) {
    return NextResponse.json({ message: 'ประเภทหรือระดับความสำคัญไม่ถูกต้อง' }, { status: 400 });
  }
  if (eventStart && eventEnd && eventEnd < eventStart) {
    return NextResponse.json({ message: 'วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น' }, { status: 400 });
  }

  try {
    const allowedIds = await getAllowedClassroomIds(caller.schoolId, caller.sub, isAdminLike);
    if (classroomIds.some((classroomId) => !allowedIds.has(classroomId))) {
      return NextResponse.json(
        {
          message: isAdminLike
            ? 'พบห้องเรียนที่ไม่ได้อยู่ในโรงเรียนนี้'
            : 'เลือกได้เฉพาะห้องที่คุณเป็นครูประจำชั้น',
        },
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from('school_announcements')
      .update({
        title,
        content,
        priority,
        announcement_type: announcementType,
        event_start: eventStart,
        event_end: eventEnd,
        expires_at: expiresAt,
      })
      .eq('id', id);
    if (error) throw new Error(error.message);

    const { data: currentTargets, error: currentTargetsError } = await supabaseAdmin
      .from('announcement_classrooms')
      .select('classroom_id')
      .eq('announcement_id', id);
    if (currentTargetsError) throw new Error(currentTargetsError.message);

    const currentIds = new Set(currentTargets.map((target) => target.classroom_id));
    const additions = classroomIds.filter((classroomId) => !currentIds.has(classroomId));
    const removals = currentTargets
      .map((target) => target.classroom_id)
      .filter((classroomId) => !classroomIds.includes(classroomId));

    if (additions.length) {
      const { error: targetError } = await supabaseAdmin
        .from('announcement_classrooms')
        .insert(
          additions.map((classroomId) => ({ announcement_id: id, classroom_id: classroomId }))
        );
      if (targetError) throw new Error(targetError.message);
    }

    if (removals.length) {
      const { error: removeError } = await supabaseAdmin
        .from('announcement_classrooms')
        .delete()
        .eq('announcement_id', id)
        .in('classroom_id', removals);
      if (removeError) throw new Error(removeError.message);
    }

    let imageUrl = owned.image_url;
    if (image) {
      imageUrl = await replaceAnnouncementImage(caller.schoolId, id, image);
    } else if (removeImage && owned.image_url) {
      await removeAnnouncementImage(caller.schoolId, id);
      imageUrl = null;
    }
    if (imageUrl !== owned.image_url) {
      const { error: imageUpdateError } = await supabaseAdmin
        .from('school_announcements')
        .update({ image_url: imageUrl })
        .eq('id', id)
        .eq('school_id', caller.schoolId);
      if (imageUpdateError) throw new Error(imageUpdateError.message);
    }

    return NextResponse.json({ success: true, imageUrl });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ไม่สามารถแก้ไขประกาศได้' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const isAdminLike = await canManageViaPermission(caller, 'announcements.manage');
  const { id } = await params;
  const { data: owned } = await getOwnedAnnouncement(id, caller.schoolId, caller.sub, isAdminLike);
  if (!owned)
    return NextResponse.json({ message: 'ไม่พบประกาศหรือไม่มีสิทธิ์ลบ' }, { status: 404 });

  if (owned.image_url) {
    try {
      await removeAnnouncementImage(caller.schoolId, id);
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : 'ไม่สามารถลบรูปประกาศได้' },
        { status: 500 }
      );
    }
  }
  const { error } = await supabaseAdmin
    .from('school_announcements')
    .delete()
    .eq('id', id)
    .eq('school_id', caller.schoolId);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
