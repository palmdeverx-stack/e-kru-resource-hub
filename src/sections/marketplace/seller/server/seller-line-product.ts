import 'server-only';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { provisionEkruSystemSeller } from './system-seller';
import {
  MARKETPLACE_SELLER_LINE_FEATURE_KEY,
  MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY,
} from '../line-feature';

export async function syncSellerLineFeatureProducts({
  adminUserId,
  enabled,
  byoa,
  managed,
}: {
  adminUserId: string;
  enabled: boolean;
  byoa: { price: number; description: string };
  managed: { price: number; description: string; quota: number };
}) {
  const sellerResult = await provisionEkruSystemSeller(adminUserId);
  if (sellerResult.error || !sellerResult.data) {
    throw sellerResult.error ?? new Error('ไม่สามารถเตรียมร้านระบบ E-KRU ได้');
  }

  const [{ data: mediaType }, { data: saleType }] = await Promise.all([
    supabaseAdmin
      .from('marketplace_media_types')
      .select('id')
      .eq('delivery_mode', 'feature_unlock')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('marketplace_sale_types')
      .select('id')
      .eq('pricing_mode', 'paid')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
  ]);

  const now = new Date().toISOString();
  const sharedProduct = {
    seller_id: sellerResult.data.id,
    category: 'เครื่องมือผู้ขาย',
    media_type_id: mediaType?.id ?? null,
    sale_type_id: saleType?.id ?? null,
    resource_type: 'feature_unlock',
    list_price: null,
    status: enabled ? 'published' : 'archived',
    license_scope: 'individual',
    license_seat_count: 1,
    grant_duration_days: null,
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
    },
    {
      key: MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY,
      title: 'LINE แจ้งเตือน — ใช้ระบบ E-KRU',
      price: managed.price,
      description: managed.description,
      quota: managed.quota,
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
        grants_feature_key: item.key,
        grants_feature_keys: [item.key],
        license_line_quota: item.quota,
        purchase_benefits: [
          item.quota ? `โควต้า ${item.quota} ข้อความ` : 'ใช้ LINE OA ของผู้ขายเอง',
          'เลือกรายการแจ้งเตือนที่ต้องการได้',
        ],
      };
      const query = existing
        ? supabaseAdmin.from('marketplace_products').update(product).eq('id', existing.id)
        : supabaseAdmin.from('marketplace_products').insert(product);
      const { data, error } = await query.select('id, price').single();
      if (error) throw error;
      return { ...data, key: item.key, description: item.description, quota: item.quota };
    })
  );
}
