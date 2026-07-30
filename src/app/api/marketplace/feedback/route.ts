import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

const CATEGORIES = new Set(['feature', 'improvement', 'bug', 'blocker', 'general']);

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  let query = supabaseAdmin
    .from('marketplace_feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (caller.role !== 'master_admin') query = query.eq('reporter_id', caller.sub);

  const { data, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data ?? [] });
}

export async function POST(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  if (caller.role === 'master_admin') {
    return NextResponse.json(
      { message: 'บัญชีผู้ดูแลระบบใช้สำหรับตรวจสอบ Feedback เท่านั้น' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const category = String(body?.category ?? '');
  const title = String(body?.title ?? '').trim();
  const systemArea = String(body?.systemArea ?? '').trim();
  const currentBehavior = String(body?.currentBehavior ?? '').trim();
  const requestedChange = String(body?.requestedChange ?? '').trim();
  const blockerDetail = String(body?.blockerDetail ?? '').trim();
  const pageUrl = String(body?.pageUrl ?? '').trim();
  const detailLength = currentBehavior.length + requestedChange.length + blockerDetail.length;

  if (
    !CATEGORIES.has(category) ||
    title.length < 3 ||
    title.length > 150 ||
    systemArea.length > 100 ||
    detailLength < 10 ||
    currentBehavior.length > 4000 ||
    requestedChange.length > 4000 ||
    blockerDetail.length > 4000 ||
    pageUrl.length > 500
  ) {
    return NextResponse.json(
      { message: 'กรุณาระบุหัวข้อและรายละเอียด Feedback ให้ครบถ้วน' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('marketplace_feedback')
    .insert({
      reporter_id: caller.sub,
      reporter_username: caller.username,
      reporter_role: caller.role,
      school_id: caller.schoolId,
      category,
      title,
      system_area: systemArea || null,
      current_behavior: currentBehavior || null,
      requested_change: requestedChange || null,
      blocker_detail: blockerDetail || null,
      page_url: pageUrl || null,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'ส่ง Feedback ไม่สำเร็จ' },
      { status: 500 }
    );
  }
  return NextResponse.json({ feedback: data }, { status: 201 });
}
