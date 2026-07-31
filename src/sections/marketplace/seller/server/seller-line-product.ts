import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { provisionEkruSystemSeller } from './system-seller';
import {
  MARKETPLACE_SELLER_LINE_FEATURE_KEY,
  MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY,
  MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY,
} from '../line-feature';

export async function syncSellerLineFeatureProducts({
  adminUserId,
  enabled,
  byoa,
  managed,
  trial,
}: {
  adminUserId: string;
  enabled: boolean;
  byoa: { price: number; description: string };
  managed: { price: number; description: string; quota: number };
  trial: { description: string; durationDays: number; quota: number };
}) {
  const sellerResult = await provisionEkruSystemSeller(adminUserId);
  if (sellerResult.error || !sellerResult.data) {
    throw sellerResult.error ?? new Error('ไม่สามารถเตรียมร้านระบบ E-KRU ได้');
  }

  const [{ data: mediaType }, { data: saleTypes }] = await Promise.all([
    supabaseAdmin
      .from('marketplace_media_types')
      .select('id')
      .eq('delivery_mode', 'feature_unlock')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('marketplace_sale_types')
      .select('id, pricing_mode')
      .in('pricing_mode', ['paid', 'free'])
      .eq('is_active', true),
  ]);
  const paidSaleTypeId = saleTypes?.find((item) => item.pricing_mode === 'paid')?.id ?? null;
  const freeSaleTypeId = saleTypes?.find((item) => item.pricing_mode === 'free')?.id ?? null;

  const now = new Date().toISOString();
  const sharedProduct = {
    seller_id: sellerResult.data.id,
    category: 'เครื่องมือผู้ขาย',
    media_type_id: mediaType?.id ?? null,
    resource_type: 'feature_unlock',
    license_target_system: 'marketplace',
    list_price: null,
    status: enabled ? 'published' : 'archived',
    license_scope: 'individual',
    license_seat_count: 1,
    submitted_at: now,
    reviewed_at: now,
    reviewed_by: adminUserId,
    updated_at: now,
  };

  const packages = [
    {
      key: MARKETPLACE_SELLER_LINE_FEATURE_KEY,
      title: 'LINE แจ้งเตือน — ใช้ OA ของตัวเอง',
      price: byoa.price,
      description: byoa.description,
      quota: null,
      durationDays: null,
    },
    {
      key: MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY,
      title: 'LINE แจ้งเตือน — ใช้ระบบ E-KRU',
      price: managed.price,
      description: managed.description,
      quota: managed.quota,
      durationDays: null,
    },
    {
      key: MARKETPLACE_SELLER_LINE_TRIAL_FEATURE_KEY,
      title: 'LINE แจ้งเตือน — ทดลองใช้งาน',
      price: 0,
      description: trial.description,
      quota: trial.quota,
      durationDays: trial.durationDays,
    },
  ];

  return Promise.all(
    packages.map(async (item) => {
      const { data: existing, error: findError } = await supabaseAdmin
        .from('marketplace_products')
        .select('id')
        .eq('seller_id', sellerResult.data.id)
        .contains('grants_feature_keys', [item.key])
        .limit(1)
        .maybeSingle();
      if (findError) throw findError;
      const product = {
        ...sharedProduct,
        title: item.title,
        short_description: item.description,
        description: `<p>${item.description}</p>`,
        price: item.price,
        sale_type_id: item.price === 0 ? freeSaleTypeId : paidSaleTypeId,
        grants_feature_key: item.key,
        grants_feature_keys: [item.key],
        grant_duration_days: item.durationDays,
        license_line_quota: item.quota,
        purchase_benefits: [
          item.durationDays
            ? `ทดลองใช้ ${item.durationDays} วัน`
            : item.quota
              ? `โควต้า ${item.quota} ข้อความ`
              : 'ใช้ LINE OA ของผู้ขายเอง',
          item.durationDays ? 'ใช้ LINE OA ของระบบ E-KRU' : 'เลือกรายการแจ้งเตือนที่ต้องการได้',
        ],
      };
      const query = existing
        ? supabaseAdmin.from('marketplace_products').update(product).eq('id', existing.id)
        : supabaseAdmin.from('marketplace_products').insert(product);
      const { data, error } = await query.select('id, price, grant_duration_days').single();
      if (error) throw error;
      return {
        ...data,
        key: item.key,
        description: item.description,
        quota: item.quota,
        durationDays: item.durationDays,
      };
    })
  );
}
