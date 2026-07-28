import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

async function getOwnMembership(teacherId: string) {
  const { data } = await supabaseAdmin
    .from('department_members')
    .select('department_id, role_in_department')
    .eq('teacher_id', teacherId)
    .maybeSingle();
  return data;
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const membership = await getOwnMembership(caller.sub);
  if (!membership) return NextResponse.json({ announcements: [] });

  const { data: targets, error: targetsError } = await supabaseAdmin
    .from('announcement_departments')
    .select('announcement_id')
    .eq('department_id', membership.department_id);
  if (targetsError)
    return NextResponse.json({ message: targetsError.message }, { status: 500 });

  const announcementIds = (targets ?? []).map((row) => row.announcement_id);
  if (!announcementIds.length) return NextResponse.json({ announcements: [] });

  const { data, error } = await supabaseAdmin
    .from('school_announcements')
    .select(
      'id, title, content, priority, created_at, author:app_users!school_announcements_created_by_fkey(first_name, last_name)'
    )
    .in('id', announcementIds)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ announcements: data });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['teacher']);
  if (!caller?.schoolId) return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const membership = await getOwnMembership(caller.sub);
  if (!membership) {
    return NextResponse.json({ message: 'คุณไม่ได้สังกัดฝ่ายใด' }, { status: 403 });
  }
  if (membership.role_in_department !== 'head') {
    return NextResponse.json({ message: 'เฉพาะหัวหน้าฝ่ายเท่านั้นที่โพสต์ประกาศได้' }, { status: 403 });
  }

  const { title, content } = await request.json();
  if (typeof title !== 'string' || !title.trim() || title.length > 200) {
    return NextResponse.json({ message: 'กรุณากรอกหัวข้อประกาศ' }, { status: 400 });
  }
  if (typeof content !== 'string' || !content.trim() || content.length > 4000) {
    return NextResponse.json({ message: 'กรุณากรอกรายละเอียดประกาศ' }, { status: 400 });
  }

  const { data: announcement, error } = await supabaseAdmin
    .from('school_announcements')
    .insert({
      school_id: caller.schoolId,
      created_by: caller.sub,
      title: title.trim(),
      content: content.trim(),
      priority: 'normal',
      announcement_type: 'general',
      is_published: true,
    })
    .select('id, title, content, priority, created_at')
    .single();

  if (error || !announcement) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่สามารถสร้างประกาศได้' },
      { status: 500 }
    );
  }

  const { error: targetError } = await supabaseAdmin
    .from('announcement_departments')
    .insert({ announcement_id: announcement.id, department_id: membership.department_id });

  if (targetError) {
    await supabaseAdmin.from('school_announcements').delete().eq('id', announcement.id);
    return NextResponse.json({ message: targetError.message }, { status: 500 });
  }

  return NextResponse.json({ announcement }, { status: 201 });
}
