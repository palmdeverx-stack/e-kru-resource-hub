import 'server-only';

import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { writeSecurityAudit } from 'src/lib/security-audit';

type LandingBannerInput = {
  title: string;
  altText: string;
  desktopImageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

const BUCKET = 'marketplace-landing-banner-assets';

function optionalDate(value: unknown): { value: string | null; valid: boolean } {
  const raw = String(value ?? '').trim();
  if (!raw) return { value: null, valid: true };
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp)
    ? { value: null, valid: false }
    : { value: new Date(timestamp).toISOString(), valid: true };
}

function optionalLink(value: unknown) {
  const link = String(value ?? '').trim();
  if (!link) return null;
  if (link.startsWith('/') && !link.startsWith('//')) return link.slice(0, 1000);
  try {
    const parsed = new URL(link);
    return ['http:', 'https:'].includes(parsed.protocol) ? link.slice(0, 1000) : null;
  } catch {
    return null;
  }
}

function bannerAssetUrl(value: unknown, required: boolean) {
  const url = String(value ?? '').trim();
  if (!url) return required ? undefined : null;
  try {
    const parsed = new URL(url);
    const configuredStorageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const expectedOrigin = configuredStorageUrl ? new URL(configuredStorageUrl).origin : null;
    const expectedPath = `/storage/v1/object/public/${BUCKET}/`;
    return parsed.protocol === 'https:' &&
      (!expectedOrigin || parsed.origin === expectedOrigin) &&
      parsed.pathname.startsWith(expectedPath)
      ? url.slice(0, 1000)
      : undefined;
  } catch {
    return undefined;
  }
}

function parseInput(
  body: Record<string, unknown> | null
): { data: LandingBannerInput } | { error: string } {
  const title = String(body?.title ?? '').trim();
  const altText = String(body?.altText ?? '').trim();
  const desktopImageUrl = bannerAssetUrl(body?.desktopImageUrl, true);
  const mobileImageUrl = bannerAssetUrl(body?.mobileImageUrl, false);
  const rawLinkUrl = String(body?.linkUrl ?? '').trim();
  const linkUrl = optionalLink(body?.linkUrl);
  const sortOrder = Number(body?.sortOrder ?? 0);
  const parsedStartsAt = optionalDate(body?.startsAt);
  const parsedEndsAt = optionalDate(body?.endsAt);
  const startsAt = parsedStartsAt.value;
  const endsAt = parsedEndsAt.value;

  if (
    title.length < 3 ||
    title.length > 150 ||
    altText.length > 200 ||
    !desktopImageUrl ||
    mobileImageUrl === undefined ||
    (rawLinkUrl && !linkUrl) ||
    !Number.isInteger(sortOrder) ||
    sortOrder < 0 ||
    sortOrder > 999 ||
    !parsedStartsAt.valid ||
    !parsedEndsAt.valid ||
    (startsAt && endsAt && endsAt <= startsAt)
  ) {
    return { error: 'ข้อมูลแบนเนอร์ไม่ถูกต้อง กรุณาตรวจสอบรูป ลิงก์ ลำดับ และช่วงเวลา' };
  }

  return {
    data: {
      title,
      altText,
      desktopImageUrl,
      mobileImageUrl,
      linkUrl,
      sortOrder,
      isActive: body?.isActive === true,
      startsAt,
      endsAt,
    },
  };
}

function toRow(input: LandingBannerInput, updatedAt: string) {
  return {
    title: input.title,
    alt_text: input.altText,
    desktop_image_url: input.desktopImageUrl,
    mobile_image_url: input.mobileImageUrl,
    link_url: input.linkUrl,
    sort_order: input.sortOrder,
    is_active: input.isActive,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    updated_at: updatedAt,
  };
}

function storagePathFromUrl(url: string | null) {
  if (!url) return null;
  try {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const path = new URL(url).pathname;
    return path.startsWith(marker) ? decodeURIComponent(path.slice(marker.length)) : null;
  } catch {
    return null;
  }
}

async function removeBannerAssets(urls: Array<string | null>) {
  const paths = [...new Set(urls.map(storagePathFromUrl).filter((path): path is string => !!path))];
  if (paths.length) await supabaseAdmin.storage.from(BUCKET).remove(paths);
}

export async function listLandingBanners(request: Request) {
  const includeAll = new URL(request.url).searchParams.get('all') === '1';
  if (includeAll) {
    if (!requireRole(request, ['master_admin'])) {
      return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการแบนเนอร์หน้าหลัก' }, { status: 403 });
    }
    const { data, error } = await supabaseAdmin
      .from('marketplace_landing_banners')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false });
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('marketplace_landing_banners')
    .select(
      'id, title, alt_text, desktop_image_url, mobile_image_url, link_url, sort_order, is_active, starts_at, ends_at, created_at, updated_at'
    )
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(10);
  if (error) {
    if (error.code === '42P01') return NextResponse.json({ items: [] });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function createLandingBanner(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์สร้างแบนเนอร์' }, { status: 403 });
  const parsed = parseInput(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 });

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('marketplace_landing_banners')
    .insert({ ...toRow(parsed.data, now), created_by: caller.sub })
    .select('*')
    .single();
  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'สร้างแบนเนอร์ไม่สำเร็จ' },
      { status: 500 }
    );
  }
  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'admin',
    action: 'marketplace.landing_banner_create',
    targetType: 'landing_banner',
    targetId: data.id,
    result: 'success',
    metadata: { is_active: data.is_active, sort_order: data.sort_order },
  });
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function updateLandingBanner(request: Request, id: string) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์แก้ไขแบนเนอร์' }, { status: 403 });
  const parsed = parseInput(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 });

  const { data: previous } = await supabaseAdmin
    .from('marketplace_landing_banners')
    .select('desktop_image_url, mobile_image_url')
    .eq('id', id)
    .maybeSingle();
  const { data, error } = await supabaseAdmin
    .from('marketplace_landing_banners')
    .update(toRow(parsed.data, new Date().toISOString()))
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบแบนเนอร์' },
      { status: error ? 500 : 404 }
    );
  }

  if (previous) {
    const replacedUrls = [previous.desktop_image_url, previous.mobile_image_url].filter(
      (url) => url && url !== data.desktop_image_url && url !== data.mobile_image_url
    );
    await removeBannerAssets(replacedUrls);
  }
  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'admin',
    action: 'marketplace.landing_banner_update',
    targetType: 'landing_banner',
    targetId: id,
    result: 'success',
    metadata: { is_active: data.is_active, sort_order: data.sort_order },
  });
  return NextResponse.json({ item: data });
}

export async function deleteLandingBanner(request: Request, id: string) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller) return NextResponse.json({ message: 'ไม่มีสิทธิ์ลบแบนเนอร์' }, { status: 403 });
  const { data, error } = await supabaseAdmin
    .from('marketplace_landing_banners')
    .delete()
    .eq('id', id)
    .select('id, desktop_image_url, mobile_image_url')
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบแบนเนอร์' },
      { status: error ? 500 : 404 }
    );
  }
  await removeBannerAssets([data.desktop_image_url, data.mobile_image_url]);
  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'admin',
    action: 'marketplace.landing_banner_delete',
    targetType: 'landing_banner',
    targetId: id,
    result: 'success',
  });
  return NextResponse.json({ success: true });
}
