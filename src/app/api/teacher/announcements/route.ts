import { after, NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { replaceAnnouncementImage, validateAnnouncementImage } from 'src/lib/announcement-image';
import { canViewViaPermission, canManageViaPermission } from 'src/lib/department-permission-access';
import {
  queueAnnouncementNotifications,
  processPendingLineNotifications,
} from 'src/lib/line-notifications';

// ----------------------------------------------------------------------

const TYPES = ['general', 'holiday', 'exam'];
const PRIORITIES = ['normal', 'important', 'urgent'];

async function getTeacherClassrooms(teacherId: string, schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from('classroom_homeroom_teachers')
    .select('classroom:classrooms!inner(id, name, grade_level, school_id)')
    .eq('teacher_id', teacherId)
    .eq('classrooms.school_id', schoolId);
  if (error) throw new Error(error.message);

  const classrooms = (data ?? []).map(
    (row) => row.classroom as unknown as { id: string; name: string; grade_level: string | null }
  );
  return Array.from(new Map(classrooms.map((item) => [item.id, item])).values());
}

async function getSchoolClassrooms(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from('classrooms')
    .select('id, name, grade_level')
    .eq('school_id', schoolId)
    .order('grade_level')
    .order('name');
  if (error) throw new Error(error.message);
  return data;
}

function parseFormData(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const announcementType = String(formData.get('announcementType') ?? '');
  const priority = String(formData.get('priority') ?? '');
  let classroomIds: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get('classroomIds') ?? '[]'));
    classroomIds = Array.isArray(parsed)
      ? Array.from(new Set(parsed.filter((id): id is string => typeof id === 'string')))
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

  return {
    title,
    content,
    announcementType,
    priority,
    classroomIds,
    eventStart,
    eventEnd,
    expiresAt,
    image,
    sendLine: formData.get('sendLine') === 'true',
  };
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  try {
    const isAdminLike = await canViewViaPermission(caller, 'announcements.manage');

    const announcementQuery = supabaseAdmin
      .from('school_announcements')
      .select(
        `id, title, content, image_url, priority, announcement_type, is_published, published_at,
         expires_at, event_start, event_end, created_at,
         targets:announcement_classrooms(classroom_id, classroom:classrooms(id, name, grade_level))`
      )
      .eq('school_id', caller.schoolId)
      .order('created_at', { ascending: false });
    const announcements = isAdminLike
      ? announcementQuery
      : announcementQuery.eq('created_by', caller.sub);

    const [{ data, error }, classrooms] = await Promise.all([
      announcements,
      isAdminLike
        ? getSchoolClassrooms(caller.schoolId)
        : getTeacherClassrooms(caller.sub, caller.schoolId),
    ]);

    if (error) throw new Error(error.message);
    return NextResponse.json({ announcements: data, classrooms });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ไม่สามารถโหลดประกาศได้' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ message: 'ข้อมูลประกาศไม่ถูกต้อง' }, { status: 400 });
  }
  const values = parseFormData(formData);
  if (
    !values.title ||
    (!values.content && !values.image) ||
    !values.classroomIds.length ||
    values.title.length > 200 ||
    values.content.length > 4000
  ) {
    return NextResponse.json(
      { message: 'กรุณากรอกหัวข้อ เพิ่มข้อความหรือรูปภาพ และเลือกห้องเรียนอย่างน้อย 1 ห้อง' },
      { status: 400 }
    );
  }
  const imageError = validateAnnouncementImage(values.image);
  if (imageError) return NextResponse.json({ message: imageError }, { status: 400 });
  if (!TYPES.includes(values.announcementType) || !PRIORITIES.includes(values.priority)) {
    return NextResponse.json({ message: 'ประเภทหรือระดับความสำคัญไม่ถูกต้อง' }, { status: 400 });
  }
  if (values.eventStart && values.eventEnd && values.eventEnd < values.eventStart) {
    return NextResponse.json({ message: 'วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น' }, { status: 400 });
  }

  try {
    const isAdminLike = await canManageViaPermission(caller, 'announcements.manage');
    const classrooms = isAdminLike
      ? await getSchoolClassrooms(caller.schoolId)
      : await getTeacherClassrooms(caller.sub, caller.schoolId);
    const allowedIds = new Set(classrooms.map((item) => item.id));
    if (values.classroomIds.some((id) => !allowedIds.has(id))) {
      return NextResponse.json(
        {
          message: isAdminLike
            ? 'พบห้องเรียนที่ไม่ได้อยู่ในโรงเรียนนี้'
            : 'เลือกได้เฉพาะห้องที่คุณเป็นครูประจำชั้น',
        },
        { status: 403 }
      );
    }

    const { data: announcement, error } = await supabaseAdmin
      .from('school_announcements')
      .insert({
        school_id: caller.schoolId,
        created_by: caller.sub,
        title: values.title,
        content: values.content,
        priority: values.priority,
        announcement_type: values.announcementType,
        event_start: values.eventStart,
        event_end: values.eventEnd,
        expires_at: values.expiresAt,
        is_published: true,
      })
      .select('id')
      .single();

    if (error || !announcement) throw new Error(error?.message ?? 'ไม่สามารถสร้างประกาศได้');

    const { error: targetError } = await supabaseAdmin.from('announcement_classrooms').insert(
      values.classroomIds.map((classroomId) => ({
        announcement_id: announcement.id,
        classroom_id: classroomId,
      }))
    );
    if (targetError) {
      await supabaseAdmin.from('school_announcements').delete().eq('id', announcement.id);
      throw new Error(targetError.message);
    }

    let imageUrl: string | null = null;
    if (values.image) {
      try {
        imageUrl = await replaceAnnouncementImage(caller.schoolId, announcement.id, values.image);
        const { error: imageUpdateError } = await supabaseAdmin
          .from('school_announcements')
          .update({ image_url: imageUrl })
          .eq('id', announcement.id)
          .eq('school_id', caller.schoolId);
        if (imageUpdateError) throw new Error(imageUpdateError.message);
      } catch (imageUploadError) {
        await supabaseAdmin.from('school_announcements').delete().eq('id', announcement.id);
        throw imageUploadError;
      }
    }

    let lineQueued = 0;
    if (values.sendLine) {
      const deliveryIds = await queueAnnouncementNotifications({
        schoolId: caller.schoolId,
        announcementId: announcement.id,
        title: values.title,
        content: values.content,
        imageUrl,
        classroomIds: values.classroomIds,
      });
      lineQueued = deliveryIds.length;
      if (deliveryIds.length) {
        after(async () => {
          await processPendingLineNotifications(caller.schoolId!, deliveryIds);
        });
      }
    }

    return NextResponse.json(
      { id: announcement.id, imageUrl, lineRequested: values.sendLine, lineQueued },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ไม่สามารถสร้างประกาศได้' },
      { status: 500 }
    );
  }
}
