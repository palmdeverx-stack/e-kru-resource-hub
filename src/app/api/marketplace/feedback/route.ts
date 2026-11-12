import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

const CATEGORIES = new Set(['feature', 'improvement', 'bug', 'blocker', 'general']);

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const pageSize = 20;
  const status = params.get('status') ?? '';
  const category = params.get('category') ?? '';
  const scope = () => {
    const query = supabaseAdmin.from('marketplace_feedback');
    return query;
  };
  let query = scope().select(
    'id, reporter_id, reporter_username, reporter_role, category, title, system_area, current_behavior, requested_change, blocker_detail, page_url, status, admin_note, created_at, updated_at',
    { count: 'exact' }
  );
  if (caller.role !== 'master_admin') query = query.eq('reporter_id', caller.sub);
  if (['new', 'reviewing', 'planned', 'resolved', 'closed'].includes(status))
    query = query.eq('status', status);
  if (CATEGORIES.has(category)) query = query.eq('category', category);
  const [result, allResult, pendingResult] = await Promise.all([
    query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1),
    caller.role === 'master_admin'
      ? scope().select('id', { count: 'exact', head: true })
      : Promise.resolve(null),
    caller.role === 'master_admin'
      ? scope().select('id', { count: 'exact', head: true }).in('status', ['new', 'reviewing'])
      : Promise.resolve(null),
  ]);
  const error = result.error ?? allResult?.error ?? pendingResult?.error;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({
    feedback: result.data ?? [],
    pagination: {
      page,
      pageSize,
      total: result.count ?? 0,
      totalPages: Math.ceil((result.count ?? 0) / pageSize),
    },
    counts: { all: allResult?.count ?? result.count ?? 0, pending: pendingResult?.count ?? 0 },
  });
}

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
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
