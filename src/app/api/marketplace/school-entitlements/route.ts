import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

import { withMediaUrls } from 'src/sections/marketplace/seller/server/product-media';

type SchoolTarget = {
  id: string;
  name: string;
  membershipRole: string;
};

export async function GET(request: Request) {
  const caller = requireRole(request, ['marketplace_user', 'teacher']);
  if (!caller) {
    return NextResponse.json(
      { message: 'เฉพาะครูหรือสมาชิก Marketplace ที่ได้รับคำเชิญเท่านั้น' },
      { status: 403 }
    );
  }

  const summaryOnly = new URL(request.url).searchParams.get('summary') === '1';
  const schools = new Map<string, SchoolTarget>();
  const teacherIds = new Set<string>([caller.sub]);

  if (caller.role === 'teacher' && caller.schoolId) {
    const [{ data: school }, { data: appUser }] = await Promise.all([
      supabaseAdmin
        .from('schools')
        .select('id,name')
        .eq('id', caller.schoolId)
        .eq('is_active', true)
        .maybeSingle(),
      supabaseAdmin.from('app_users').select('auth_user_id').eq('id', caller.sub).maybeSingle(),
    ]);
    if (school) {
      schools.set(school.id, { ...school, membershipRole: 'teacher' });
    }
    if (appUser?.auth_user_id) {
      const { data: marketplaceUser } = await supabaseAdmin
        .from('marketplace_users')
        .select('id')
        .eq('auth_user_id', appUser.auth_user_id)
        .maybeSingle();
      if (marketplaceUser) teacherIds.add(marketplaceUser.id);
    }
  }

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('marketplace_school_members')
    .select('membership_role, school:schools(id,name,is_active)')
    .eq('marketplace_user_id', caller.sub);
  if (membershipError) {
    return NextResponse.json(
      {
        message:
          membershipError.code === '42P01'
            ? 'กรุณาติดตั้ง schema marketplace_school_members เวอร์ชันล่าสุด'
            : membershipError.message,
      },
      { status: 500 }
    );
  }
  for (const membership of memberships ?? []) {
    const school = (
      Array.isArray(membership.school) ? membership.school[0] : membership.school
    ) as { id: string; name: string; is_active: boolean } | null;
    if (school?.is_active) {
      schools.set(school.id, {
        id: school.id,
        name: school.name,
        membershipRole: membership.membership_role,
      });
    }
  }

  const schoolIds = [...schools.keys()];
  if (!schoolIds.length) {
    return NextResponse.json(
      summaryOnly ? { canViewSchoolEntitlements: false } : { schools: [], entitlements: [] }
    );
  }
  if (summaryOnly) {
    return NextResponse.json({ canViewSchoolEntitlements: true });
  }

  const { data: licenses, error } = await supabaseAdmin
    .from('marketplace_school_licenses')
    .select(
      'id,school_id,license_scope,feature_keys,seat_count,starts_at,expires_at,status,grants_plan_code,max_teachers,max_students,max_school_admins,line_quota,product:marketplace_products(id,title,title_en,short_description,short_description_en,cover_url,images:marketplace_product_images(*)),assignments:marketplace_teacher_license_assignments(teacher_id,revoked_at)'
    )
    .in('school_id', schoolIds)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const visibleLicenses = (licenses ?? []).filter((license) => {
    if (license.license_scope === 'school') return true;
    return (license.assignments ?? []).some(
      (assignment: { teacher_id: string; revoked_at: string | null }) =>
        !assignment.revoked_at && teacherIds.has(assignment.teacher_id)
    );
  });

  const entitlements = await Promise.all(
    visibleLicenses.map(async (license) => {
      const rawProduct = Array.isArray(license.product) ? license.product[0] : license.product;
      const product = rawProduct ? await withMediaUrls({ ...rawProduct, files: [] }) : null;
      const cover =
        product?.images?.find((image) => image.is_cover) ?? product?.images?.[0] ?? null;
      return {
        id: license.id,
        school: schools.get(license.school_id),
        licenseScope: license.license_scope,
        featureKeys: license.feature_keys,
        seatCount: license.seat_count,
        startsAt: license.starts_at,
        expiresAt: license.expires_at,
        planCode: license.grants_plan_code,
        limits: {
          teachers: license.max_teachers,
          students: license.max_students,
          schoolAdmins: license.max_school_admins,
          lineQuota: license.line_quota,
        },
        product: product
          ? {
              id: product.id,
              title: product.title,
              titleEn: product.title_en,
              shortDescription: product.short_description,
              shortDescriptionEn: product.short_description_en,
              coverUrl: cover?.url ?? product.cover_url,
            }
          : null,
      };
    })
  );

  return NextResponse.json({ schools: [...schools.values()], entitlements });
}
