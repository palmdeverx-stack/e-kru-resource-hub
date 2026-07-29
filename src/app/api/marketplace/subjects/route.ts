import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

type SubjectOption = {
  value: string;
  label: string;
  group: 'รายวิชาในระบบ' | 'กลุ่มสาระการเรียนรู้';
  code: string | null;
};

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  let learningAreasQuery = supabaseAdmin
    .from('subject_master_items')
    .select('code, name, sort_order')
    .eq('category', 'learning_area')
    .eq('is_active', true)
    .order('sort_order')
    .limit(500);
  let subjectsQuery = supabaseAdmin
    .from('subjects')
    .select('code, name')
    .eq('status', 'published')
    .order('name')
    .limit(500);

  if (caller.schoolId) {
    learningAreasQuery = learningAreasQuery.eq('school_id', caller.schoolId);
    subjectsQuery = subjectsQuery.eq('school_id', caller.schoolId);
  } else {
    // External Marketplace sellers have no school scope. System learning-area
    // rows are duplicated per school, so they are de-duplicated below.
    learningAreasQuery = learningAreasQuery.eq('is_system', true);
  }

  const [learningAreasResult, subjectsResult] = await Promise.all([
    learningAreasQuery,
    subjectsQuery,
  ]);
  const error = learningAreasResult.error || subjectsResult.error;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const unique = new Map<string, SubjectOption>();
  for (const subject of subjectsResult.data ?? []) {
    const name = String(subject.name ?? '').trim();
    if (!name) continue;
    const key = `subject:${name.toLocaleLowerCase('th-TH')}`;
    if (!unique.has(key)) {
      unique.set(key, {
        value: name,
        label: subject.code ? `${subject.code} · ${name}` : name,
        group: 'รายวิชาในระบบ',
        code: subject.code ?? null,
      });
    }
  }
  for (const area of learningAreasResult.data ?? []) {
    const name = String(area.name ?? '').trim();
    if (!name) continue;
    const key = `area:${String(area.code ?? name).toLocaleLowerCase('th-TH')}`;
    if (!unique.has(key)) {
      unique.set(key, {
        value: name,
        label: name,
        group: 'กลุ่มสาระการเรียนรู้',
        code: area.code ?? null,
      });
    }
  }

  const items = [...unique.values()].sort(
    (left, right) =>
      left.group.localeCompare(right.group, 'th-TH') ||
      left.label.localeCompare(right.label, 'th-TH')
  );
  return NextResponse.json({ items });
}
