import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';
import { syncLinkedStaffAuth, linkStaffToSupabaseAuth } from 'src/lib/staff-supabase-auth';

const ROLES = [
  'master_admin',
  'super_admin',
  'school_admin',
  'teacher',
  'student',
  'marketplace_user',
];
const CREATABLE_ADMIN_ROLES = ['super_admin', 'master_admin'] as const;
const STATUSES = ['active', 'inactive', 'unverified', 'suspended'];
const SOURCES = ['app', 'marketplace'] as const;

type AccountSource = (typeof SOURCES)[number];

function safeSearch(value: string) {
  return value
    .replace(/[^\p{L}\p{N}@._+\-\s]/gu, '')
    .trim()
    .slice(0, 100);
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    await writeSecurityAudit({
      request,
      category: 'authorization',
      action: 'system_users.read',
      result: 'denied',
    });
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูบัญชีผู้ใช้งานทั้งหมด' }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = Math.max(0, Number.parseInt(url.searchParams.get('page') ?? '0', 10) || 0);
  const pageSize = Math.min(
    100,
    Math.max(10, Number.parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20)
  );
  const role = url.searchParams.get('role') ?? '';
  const source = url.searchParams.get('source') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const search = safeSearch(url.searchParams.get('search') ?? '');

  if (role && !ROLES.includes(role)) {
    return NextResponse.json({ message: 'ประเภทบัญชีไม่ถูกต้อง' }, { status: 400 });
  }
  if (status && !STATUSES.includes(status)) {
    return NextResponse.json({ message: 'สถานะบัญชีไม่ถูกต้อง' }, { status: 400 });
  }
  if (source && !SOURCES.includes(source as AccountSource)) {
    return NextResponse.json({ message: 'แหล่งบัญชีไม่ถูกต้อง' }, { status: 400 });
  }

  let query = supabaseAdmin
    .from('system_user_accounts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (role) query = query.eq('role', role);
  if (source) query = query.eq('source', source);
  if (status === 'suspended') query = query.eq('is_suspended', true);
  if (status === 'active') {
    query = query.eq('is_suspended', false).eq('is_active', true);
  }
  if (status === 'inactive') {
    query = query.eq('source', 'app').eq('is_suspended', false).eq('is_active', false);
  }
  if (status === 'unverified') {
    query = query.eq('source', 'marketplace').eq('is_suspended', false).eq('is_active', false);
  }
  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      `username.ilike.${pattern},email.ilike.${pattern},display_name.ilike.${pattern},school_name.ilike.${pattern}`
    );
  }

  const { data, error, count } = await query;
  if (error) {
    const setupRequired = ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code ?? '');
    return NextResponse.json(
      {
        message: setupRequired
          ? 'กรุณารัน migration ระบบจัดการบัญชีผู้ใช้ก่อนใช้งาน'
          : error.message,
        setupRequired,
      },
      { status: setupRequired ? 503 : 500 }
    );
  }

  const users = (data ?? []).map((account) => ({
    ...account,
    suspended: account.is_suspended,
    email_verified: account.source === 'marketplace' ? account.is_active : true,
    school: account.school_name ? { name: account.school_name } : null,
  }));

  return NextResponse.json({
    accounts: data ?? [],
    users,
    total: count ?? 0,
    page,
    pageSize,
    currentUserId: caller.sub,
  });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    await writeSecurityAudit({
      request,
      category: 'authorization',
      action: 'system_user.created',
      result: 'denied',
    });
    return NextResponse.json({ message: 'ไม่มีสิทธิ์สร้างบัญชีผู้ดูแลระบบ' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? '').trim().toLowerCase();
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  const firstName = String(body?.firstName ?? '').trim();
  const lastName = String(body?.lastName ?? '').trim();
  const role = String(body?.role ?? '');

  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return NextResponse.json(
      { message: 'ชื่อผู้ใช้ต้องมี 3–40 ตัวอักษร และใช้เฉพาะ a-z, 0-9, จุด ขีดกลาง หรือขีดล่าง' },
      { status: 400 }
    );
  }
  if (!/^\S+@\S+\.\S+$/.test(email) || !firstName || !lastName || password.length < 8) {
    return NextResponse.json(
      { message: 'กรุณากรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 8 ตัวอักษรให้ครบถ้วน' },
      { status: 400 }
    );
  }
  if (!CREATABLE_ADMIN_ROLES.includes(role as (typeof CREATABLE_ADMIN_ROLES)[number])) {
    return NextResponse.json({ message: 'ประเภทบัญชีผู้ดูแลระบบไม่ถูกต้อง' }, { status: 400 });
  }

  const [{ data: appUser }, { data: marketplaceUser }] = await Promise.all([
    supabaseAdmin.from('app_users').select('id').ilike('username', username).maybeSingle(),
    supabaseAdmin.from('marketplace_users').select('id').ilike('username', username).maybeSingle(),
  ]);
  if (appUser || marketplaceUser) {
    return NextResponse.json({ message: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { data: user, error: insertError } = await supabaseAdmin
    .from('app_users')
    .insert({
      username,
      email,
      first_name: firstName,
      last_name: lastName,
      password_hash: passwordHash,
      password_ciphertext: null,
      must_change_password: true,
      role,
      school_id: null,
      is_active: true,
    })
    .select('id, username, email, first_name, last_name, role, school_id, is_active, created_at')
    .single();

  if (insertError || !user) {
    return NextResponse.json(
      {
        message:
          insertError?.code === '23505'
            ? 'ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้งานแล้ว'
            : (insertError?.message ?? 'สร้างบัญชีผู้ดูแลระบบไม่สำเร็จ'),
      },
      { status: insertError?.code === '23505' ? 409 : 500 }
    );
  }

  const linked = await linkStaffToSupabaseAuth(
    { ...user, role: role as 'super_admin' | 'master_admin' },
    password
  );
  if (!linked.ok) {
    await supabaseAdmin.from('app_users').delete().eq('id', user.id);
    return NextResponse.json(
      { message: `สร้างบัญชีเข้าสู่ระบบไม่สำเร็จ: ${linked.message}` },
      { status: 500 }
    );
  }

  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'account',
    action: 'system_user.created',
    targetType: 'app_user',
    targetId: user.id,
    result: 'success',
    metadata: { targetUsername: username, targetRole: role },
  });

  return NextResponse.json(
    {
      user,
      message: `สร้างบัญชี ${role === 'master_admin' ? 'Master Admin' : 'Admin'} แล้ว`,
    },
    { status: 201 }
  );
}

export async function PATCH(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) {
    await writeSecurityAudit({
      request,
      category: 'authorization',
      action: 'system_user.suspension_update',
      result: 'denied',
    });
    return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการบัญชีผู้ใช้งาน' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const source = String(body?.source ?? '') as AccountSource;
  const isSuspended = body?.isSuspended;
  const reason = String(body?.reason ?? '').trim().slice(0, 500);

  if (
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !SOURCES.includes(source) ||
    typeof isSuspended !== 'boolean'
  ) {
    return NextResponse.json({ message: 'ข้อมูลบัญชีหรือสถานะไม่ถูกต้อง' }, { status: 400 });
  }
  if (isSuspended && reason.length < 3) {
    return NextResponse.json({ message: 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร' }, { status: 400 });
  }
  if (source === 'app' && id === caller.sub && isSuspended) {
    return NextResponse.json({ message: 'ไม่สามารถระงับบัญชีที่กำลังใช้งานอยู่' }, { status: 409 });
  }

  const { data: marketplaceAccount, error: scopeError } = await supabaseAdmin
    .from('system_user_accounts')
    .select('id')
    .eq('id', id)
    .eq('source', source)
    .maybeSingle();
  if (scopeError) {
    const setupRequired = ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(
      scopeError.code ?? ''
    );
    return NextResponse.json(
      {
        message: setupRequired
          ? 'กรุณารัน migration ระบบจัดการบัญชีผู้ใช้ก่อนใช้งาน'
          : scopeError.message,
        setupRequired,
      },
      { status: setupRequired ? 503 : 500 }
    );
  }
  if (!marketplaceAccount) {
    return NextResponse.json(
      { message: 'บัญชีนี้ไม่มีประวัติการใช้งาน Marketplace' },
      { status: 404 }
    );
  }

  const table = source === 'app' ? 'app_users' : 'marketplace_users';
  const { data: target, error: targetError } = await supabaseAdmin
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (targetError || !target) {
    return NextResponse.json(
      { message: targetError?.message ?? 'ไม่พบบัญชีผู้ใช้งาน' },
      { status: targetError ? 500 : 404 }
    );
  }

  if (isSuspended && target.role === 'master_admin') {
    const { count } = await supabaseAdmin
      .from('app_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'master_admin')
      .eq('is_active', true)
      .eq('is_suspended', false)
      .neq('id', id);
    if ((count ?? 0) === 0) {
      return NextResponse.json(
        { message: 'ไม่สามารถระงับ Super Admin คนสุดท้ายของระบบ' },
        { status: 409 }
      );
    }
  }

  const authShouldBeActive = !isSuspended && target.is_active !== false;
  let authError: string | null = null;
  if (source === 'app' && target.role !== 'student') {
    const authResult = await syncLinkedStaffAuth(target, { isActive: authShouldBeActive });
    if (!authResult.ok) authError = authResult.message;
  } else if (source === 'marketplace' && target.auth_user_id) {
    const authResult = await supabaseAdmin.auth.admin.updateUserById(target.auth_user_id, {
      ban_duration: authShouldBeActive ? 'none' : '876000h',
    });
    authError = authResult.error?.message ?? null;
  }
  if (authError) {
    return NextResponse.json(
      { message: `ไม่สามารถเปลี่ยนสถานะบัญชีเข้าสู่ระบบได้: ${authError}` },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabaseAdmin
    .from(table)
    .update({
      is_suspended: isSuspended,
      suspended_at: isSuspended ? now : null,
      suspended_by: isSuspended ? caller.sub : null,
      suspended_reason: isSuspended ? reason : null,
      updated_at: now,
    })
    .eq('id', id)
    .select('id, is_active, is_suspended, suspended_at, suspended_reason')
    .single();

  if (updateError || !updated) {
    const previousAuthActive = target.is_active !== false && target.is_suspended !== true;
    if (source === 'app' && target.role !== 'student') {
      await syncLinkedStaffAuth(target, { isActive: previousAuthActive });
    } else if (source === 'marketplace' && target.auth_user_id) {
      await supabaseAdmin.auth.admin.updateUserById(target.auth_user_id, {
        ban_duration: previousAuthActive ? 'none' : '876000h',
      });
    }
    return NextResponse.json(
      { message: updateError?.message ?? 'ไม่สามารถเปลี่ยนสถานะบัญชีได้' },
      { status: 500 }
    );
  }

  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'account',
    action: isSuspended ? 'system_user.suspended' : 'system_user.reactivated',
    targetType: source === 'app' ? 'app_user' : 'marketplace_user',
    targetId: id,
    result: 'success',
    metadata: {
      targetUsername: target.username,
      targetRole: source === 'marketplace' ? 'marketplace_user' : target.role,
      reason: isSuspended ? reason : null,
    },
  });

  return NextResponse.json({
    account: updated,
    message: isSuspended ? 'ระงับบัญชีแล้ว' : 'เปิดใช้งานบัญชีแล้ว',
  });
}
