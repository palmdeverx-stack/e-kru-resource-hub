import 'server-only';

import type { AppRole } from 'src/lib/auth-token';

import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';
import { requireRole, requireAuthenticated } from 'src/lib/auth-token';

const AUDIENCES = new Set(['all', 'authenticated', 'guests', 'roles']);
const ROLES = new Set<AppRole>([
  'master_admin',
  'school_admin',
  'teacher',
  'student',
  'marketplace_user',
]);

type AnnouncementInput = {
  title: string;
  message: string;
  imageUrl: string | null;
  linkUrl: string | null;
  buttonLabel: string | null;
  audience: string;
  roleTargets: AppRole[];
  priority: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

function optionalUrl(value: unknown, allowRelative = false) {
  const url = String(value ?? '').trim();
  if (!url) return null;
  if (allowRelative && url.startsWith('/') && !url.startsWith('//')) return url.slice(0, 1000);
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? url.slice(0, 1000) : null;
  } catch {
    return null;
  }
}

function optionalDate(value: unknown): { value: string | null; valid: boolean } {
  const raw = String(value ?? '').trim();
  if (!raw) return { value: null, valid: true };
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp)
    ? { value: null, valid: false }
    : { value: new Date(timestamp).toISOString(), valid: true };
}

function parseInput(body: Record<string, unknown> | null):
  | { data: AnnouncementInput }
  | { error: string } {
  const title = String(body?.title ?? '').trim();
  const message = String(body?.message ?? '').trim();
  const audience = String(body?.audience ?? 'all');
  const roleTargets = Array.isArray(body?.roleTargets)
    ? body.roleTargets.filter((role): role is AppRole => ROLES.has(role as AppRole))
    : [];
  const priority = Number(body?.priority ?? 0);
  const parsedStartsAt = optionalDate(body?.startsAt);
  const parsedEndsAt = optionalDate(body?.endsAt);
  const startsAt = parsedStartsAt.value;
  const endsAt = parsedEndsAt.value;
  const imageUrl = optionalUrl(body?.imageUrl);
  const rawImageUrl = String(body?.imageUrl ?? '').trim();
  const linkUrl = optionalUrl(body?.linkUrl, true);
  const rawLinkUrl = String(body?.linkUrl ?? '').trim();
  const buttonLabel = String(body?.buttonLabel ?? '').trim() || null;

  if (
    title.length < 3 ||
    title.length > 150 ||
    message.length < 3 ||
    message.length > 3000 ||
    !AUDIENCES.has(audience) ||
    (audience === 'roles' && !roleTargets.length) ||
    !Number.isInteger(priority) ||
    priority < 0 ||
    priority > 999 ||
    (rawImageUrl && !imageUrl) ||
    (rawLinkUrl && !linkUrl) ||
    (buttonLabel?.length ?? 0) > 80 ||
    !parsedStartsAt.valid ||
    !parsedEndsAt.valid ||
    (startsAt && endsAt && endsAt <= startsAt)
  ) {
    return { error: 'ข้อมูลประกาศไม่ถูกต้อง กรุณาตรวจสอบเนื้อหา กลุ่มผู้ชม และช่วงเวลา' };
  }

  return {
    data: {
      title,
      message,
      imageUrl,
      linkUrl,
      buttonLabel,
      audience,
      roleTargets,
      priority,
      isActive: body?.isActive === true,
      startsAt,
      endsAt,
    },
  };
}

function toRow(input: AnnouncementInput, updatedAt: string) {
  return {
    title: input.title,
    message: input.message,
    image_url: input.imageUrl,
    link_url: input.linkUrl,
    button_label: input.buttonLabel,
    audience: input.audience,
    role_targets: input.roleTargets,
    priority: input.priority,
    is_active: input.isActive,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    updated_at: updatedAt,
  };
}

export async function listPopupAnnouncements(request: Request) {
  const url = new URL(request.url);
  const includeAll = url.searchParams.get('all') === '1';
  const caller = requireAuthenticated(request);

  if (includeAll) {
    if (!requireRole(request, ['master_admin'])) {
      return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการประกาศ' }, { status: 403 });
    }
    const { data, error } = await supabaseAdmin
      .from('marketplace_popup_announcements')
      .select('*')
      .order('priority', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('marketplace_popup_announcements')
    .select(
      'id, title, message, image_url, link_url, button_label, audience, role_targets, priority, updated_at'
    )
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(10);
  if (error) {
    if (error.code === '42P01') return NextResponse.json({ items: [] });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const items = (data ?? [])
    .filter((item) => {
      if (item.audience === 'all') return true;
      if (item.audience === 'authenticated') return Boolean(caller);
      if (item.audience === 'guests') return !caller;
      return Boolean(caller && (item.role_targets ?? []).includes(caller.role));
    })
    .map(({ audience: _audience, role_targets: _roleTargets, ...item }) => item);
  return NextResponse.json({ items });
}

export async function createPopupAnnouncement(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์สร้างประกาศ' }, { status: 403 });
  const parsed = parseInput(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 });

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('marketplace_popup_announcements')
    .insert({ ...toRow(parsed.data, now), created_by: caller.sub })
    .select('*')
    .single();
  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'สร้างประกาศไม่สำเร็จ' }, { status: 500 });
  }
  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'admin',
    action: 'marketplace.popup_announcement_create',
    targetType: 'popup_announcement',
    targetId: data.id,
    result: 'success',
    metadata: { audience: data.audience, is_active: data.is_active },
  });
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function updatePopupAnnouncement(request: Request, id: string) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์แก้ไขประกาศ' }, { status: 403 });
  const parsed = parseInput(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('marketplace_popup_announcements')
    .update(toRow(parsed.data, new Date().toISOString()))
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบประกาศ' },
      { status: error ? 500 : 404 }
    );
  }
  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'admin',
    action: 'marketplace.popup_announcement_update',
    targetType: 'popup_announcement',
    targetId: id,
    result: 'success',
    metadata: { audience: data.audience, is_active: data.is_active },
  });
  return NextResponse.json({ item: data });
}

export async function deletePopupAnnouncement(request: Request, id: string) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์ลบประกาศ' }, { status: 403 });
  const { data, error } = await supabaseAdmin
    .from('marketplace_popup_announcements')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบประกาศ' },
      { status: error ? 500 : 404 }
    );
  }
  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'admin',
    action: 'marketplace.popup_announcement_delete',
    targetType: 'popup_announcement',
    targetId: id,
    result: 'success',
  });
  return NextResponse.json({ success: true });
}
