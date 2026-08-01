import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { withMediaUrls } from 'src/sections/marketplace/seller/server/product-media';

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const now = new Date().toISOString();
  const [
    { data: licenses, error },
    { data: platformLicenses, error: platformError },
    { data: subscriptions, error: subscriptionError },
  ] =
    await Promise.all([
      supabaseAdmin
        .from('marketplace_user_licenses')
        .select(
          'id,feature_keys,grants_plan_code,starts_at,expires_at,status,product:marketplace_products(id,title,title_en,short_description,short_description_en,cover_url,license_scope,license_target_system,images:marketplace_product_images(*))'
        )
        .eq('buyer_id', caller.sub)
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('expires_at', { ascending: true }),
      supabaseAdmin
        .from('marketplace_platform_licenses')
        .select(
          'id,feature_keys,grants_plan_code,starts_at,expires_at,status,product:marketplace_products(id,title,title_en,short_description,short_description_en,cover_url,license_scope,license_target_system,images:marketplace_product_images(*))'
        )
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('expires_at', { ascending: true }),
      supabaseAdmin
        .from('marketplace_license_subscriptions')
        .select(
          'id,product_id,billing_cycle,amount,currency,status,current_period_start,current_period_end,cancel_at_period_end,canceled_at'
        )
        .eq('buyer_id', caller.sub)
        .in('status', ['incomplete', 'active', 'past_due', 'paused'])
        .order('created_at', { ascending: false }),
    ]);
  if (error || platformError || subscriptionError) {
    return NextResponse.json(
      {
        message:
          (error?.code ?? platformError?.code) === '42P01'
            ? 'กรุณาติดตั้ง schema marketplace_user_licenses เวอร์ชันล่าสุด'
            : (error?.message ?? platformError?.message ?? subscriptionError?.message),
      },
      { status: 500 }
    );
  }

  const entitlements = await Promise.all(
    [...(licenses ?? []), ...(platformLicenses ?? [])].map(async (license) => {
      const rawProduct = Array.isArray(license.product) ? license.product[0] : license.product;
      const product = rawProduct ? await withMediaUrls({ ...rawProduct, files: [] }) : null;
      const cover =
        product?.images?.find((image) => image.is_cover) ?? product?.images?.[0] ?? null;
      return {
        id: license.id,
        featureKeys: license.feature_keys,
        planCode: license.grants_plan_code,
        startsAt: license.starts_at,
        expiresAt: license.expires_at,
        subscription:
          (subscriptions ?? []).find((item) => item.product_id === product?.id) ?? null,
        product: product
          ? {
              id: product.id,
              title: product.title,
              titleEn: product.title_en,
              shortDescription: product.short_description,
              shortDescriptionEn: product.short_description_en,
              coverUrl: cover?.url ?? product.cover_url,
              licenseScope: product.license_scope,
              licenseTargetSystem: product.license_target_system,
            }
          : null,
      };
    })
  );

  return NextResponse.json({ entitlements });
}
