import type { SchoolFeatureKey } from 'src/lib/school-subscription-config';

import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { ALL_SCHOOL_FEATURE_KEYS } from 'src/lib/school-subscription-config';

import { ownedSellerId } from 'src/sections/marketplace/seller/server/owned-seller';
import { notifyMarketplaceAdmins } from 'src/sections/marketplace/admin/server/line-notifications';
import {
  withMediaUrls,
  PRODUCT_MANAGE_SELECT,
} from 'src/sections/marketplace/seller/server/product-media';

const FILE_OPTIONAL_RESOURCE_TYPES = new Set(['service', 'feature_unlock']);

type Context = { params: Promise<{ id: string }> };

function plainTextLength(html: string) {
  return html.replace(/<[^>]*>/g, '').trim().length;
}

export async function GET(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const seller = await ownedSellerId(caller.sub);
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });

  const { id } = await params;
  const { data: product, error } = await supabaseAdmin
    .from('marketplace_products')
    .select(PRODUCT_MANAGE_SELECT)
    .eq('id', id)
    .eq('seller_id', seller.id)
    .maybeSingle();
  if (error || !product) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบสินค้า' },
      { status: error ? 500 : 404 }
    );
  }
  return NextResponse.json({ product: await withMediaUrls(product) });
}

export async function PATCH(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const seller = await ownedSellerId(caller.sub);
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });
  if (seller.status !== 'active') {
    return NextResponse.json(
      { message: 'ร้านต้องได้รับการอนุมัติก่อนจึงจะแก้ไขและส่งสินค้าได้' },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (title.length < 3) {
      return NextResponse.json(
        { message: 'กรุณากรอกชื่อสินค้าอย่างน้อย 3 ตัวอักษร' },
        { status: 400 }
      );
    }
    update.title = title;
  }
  if (body.titleEn !== undefined) {
    update.title_en = String(body.titleEn).trim() || null;
  }
  if (body.shortDescription !== undefined) {
    const shortDescription = String(body.shortDescription).trim();
    if (shortDescription.length > 150) {
      return NextResponse.json(
        { message: 'คำอธิบายสั้นต้องไม่เกิน 150 ตัวอักษร' },
        { status: 400 }
      );
    }
    update.short_description = shortDescription || null;
  }
  if (body.shortDescriptionEn !== undefined) {
    const shortDescriptionEn = String(body.shortDescriptionEn).trim();
    if (shortDescriptionEn.length > 150) {
      return NextResponse.json(
        { message: 'คำอธิบายสั้นภาษาอังกฤษต้องไม่เกิน 150 ตัวอักษร' },
        { status: 400 }
      );
    }
    update.short_description_en = shortDescriptionEn || null;
  }
  if (body.description !== undefined) {
    update.description = String(body.description).trim();
  }
  if (body.descriptionEn !== undefined) {
    update.description_en = String(body.descriptionEn).trim() || null;
  }
  if (body.category !== undefined) {
    const category = String(body.category).trim();
    const { data: selectedCategory } = await supabaseAdmin
      .from('marketplace_categories')
      .select('id')
      .eq('name', category)
      .eq('is_active', true)
      .maybeSingle();
    if (!selectedCategory) {
      return NextResponse.json(
        { message: 'หมวดหมู่นี้ไม่มีอยู่หรือถูกปิดใช้งาน' },
        { status: 400 }
      );
    }
    update.category = category;
  }
  if (body.subjectLabel !== undefined) {
    update.subject_label = String(body.subjectLabel).trim() || null;
  }
  if (body.curriculumId !== undefined) {
    const curriculumId = String(body.curriculumId).trim();
    if (curriculumId) {
      const { data: curriculum } = await supabaseAdmin
        .from('marketplace_curricula')
        .select('id')
        .eq('id', curriculumId)
        .eq('is_active', true)
        .maybeSingle();
      if (!curriculum) {
        return NextResponse.json(
          { message: 'หลักสูตรนี้ไม่มีอยู่หรือถูกปิดใช้งาน' },
          { status: 400 }
        );
      }
      update.curriculum_id = curriculum.id;
    } else {
      update.curriculum_id = null;
    }
  }

  let gradeLevelIds: string[] | undefined;
  if (Array.isArray(body.gradeLevelIds)) {
    const ids: string[] = body.gradeLevelIds.map((value: unknown) => String(value));
    gradeLevelIds = ids;
    if (ids.length) {
      const { data: rows } = await supabaseAdmin
        .from('marketplace_grade_levels')
        .select('id')
        .in('id', ids)
        .eq('is_active', true);
      if ((rows?.length ?? 0) !== ids.length) {
        return NextResponse.json({ message: 'ระดับชั้นที่เลือกไม่ถูกต้อง' }, { status: 400 });
      }
    }
  }

  let tagIds: string[] | undefined;
  if (Array.isArray(body.tagIds)) {
    const ids: string[] = body.tagIds.map((value: unknown) => String(value));
    tagIds = ids;
    if (ids.length) {
      const { data: rows } = await supabaseAdmin
        .from('marketplace_tags')
        .select('id')
        .in('id', ids)
        .eq('is_active', true);
      if ((rows?.length ?? 0) !== ids.length) {
        return NextResponse.json({ message: 'แท็กที่เลือกไม่ถูกต้อง' }, { status: 400 });
      }
    }
  }

  let resolvedSaleType: { id: string; pricing_mode: string } | null = null;
  if (body.mediaTypeId !== undefined) {
    const mediaTypeId = String(body.mediaTypeId).trim();
    if (mediaTypeId) {
      const { data: mediaType } = await supabaseAdmin
        .from('marketplace_media_types')
        .select('id, delivery_mode')
        .eq('id', mediaTypeId)
        .eq('is_active', true)
        .maybeSingle();
      if (!mediaType) {
        return NextResponse.json(
          { message: 'ประเภทสื่อไม่มีอยู่หรือถูกปิดใช้งาน' },
          { status: 400 }
        );
      }
      if (mediaType.delivery_mode === 'feature_unlock' && caller.role !== 'master_admin') {
        return NextResponse.json(
          { message: 'เฉพาะร้าน E-KRU เท่านั้นที่ลงสินค้าประเภทปลดล็อกฟีเจอร์ระบบได้' },
          { status: 403 }
        );
      }
      update.media_type_id = mediaType.id;
      update.resource_type = mediaType.delivery_mode;
    } else {
      update.media_type_id = null;
    }
  }
  if (body.grantsFeatureKey !== undefined) {
    const grantsFeatureKey = String(body.grantsFeatureKey).trim();
    if (grantsFeatureKey) {
      if (!ALL_SCHOOL_FEATURE_KEYS.includes(grantsFeatureKey as SchoolFeatureKey)) {
        return NextResponse.json({ message: 'ฟีเจอร์ที่เลือกไม่ถูกต้อง' }, { status: 400 });
      }
      update.grants_feature_key = grantsFeatureKey;
    } else {
      update.grants_feature_key = null;
    }
  }
  if (body.grantsFeatureKeys !== undefined) {
    if (!Array.isArray(body.grantsFeatureKeys)) {
      return NextResponse.json({ message: 'รายการฟีเจอร์ไม่ถูกต้อง' }, { status: 400 });
    }
    const featureKeys: string[] = [
      ...new Set<string>(
        body.grantsFeatureKeys.map((value: unknown) => String(value).trim()).filter(Boolean)
      ),
    ];
    if (
      featureKeys.some(
        (featureKey) => !ALL_SCHOOL_FEATURE_KEYS.includes(featureKey as SchoolFeatureKey)
      )
    ) {
      return NextResponse.json({ message: 'มีฟีเจอร์ในแพ็กเกจที่ไม่ถูกต้อง' }, { status: 400 });
    }
    const licenseScope = String(body.licenseScope ?? 'school');
    if (
      licenseScope === 'teacher' &&
      featureKeys.some((featureKey) => !featureKey.startsWith('teacher.'))
    ) {
      return NextResponse.json(
        { message: 'License รายครูเลือกได้เฉพาะฟีเจอร์สำหรับครู' },
        { status: 400 }
      );
    }
    update.grants_feature_keys = featureKeys;
    update.grants_feature_key = featureKeys[0] ?? null;
  }
  if (body.licenseScope !== undefined) {
    const licenseScope = String(body.licenseScope);
    if (!['individual', 'school', 'teacher'].includes(licenseScope)) {
      return NextResponse.json({ message: 'รูปแบบ License ไม่ถูกต้อง' }, { status: 400 });
    }
    update.license_scope = licenseScope;
  }
  if (body.licenseSeatCount !== undefined) {
    const seatCount = Number(body.licenseSeatCount);
    if (!Number.isInteger(seatCount) || seatCount <= 0 || seatCount > 10000) {
      return NextResponse.json(
        { message: 'จำนวน Seat ต้องเป็นเลขจำนวนเต็มระหว่าง 1–10,000' },
        { status: 400 }
      );
    }
    update.license_seat_count = seatCount;
  }
  if (body.grantDurationDays !== undefined) {
    const grantDurationDays = Number(body.grantDurationDays);
    if (!Number.isFinite(grantDurationDays) || grantDurationDays <= 0) {
      return NextResponse.json({ message: 'ระยะเวลาปลดล็อกต้องมากกว่า 0 วัน' }, { status: 400 });
    }
    update.grant_duration_days = grantDurationDays;
  }
  const requestedPlanCode =
    body.grantsPlanCode !== undefined ? String(body.grantsPlanCode).trim() : undefined;
  if (requestedPlanCode === '') update.grants_plan_code = null;
  for (const [inputKey, column] of [
    ['licenseMaxTeachers', 'license_max_teachers'],
    ['licenseMaxStudents', 'license_max_students'],
    ['licenseMaxSchoolAdmins', 'license_max_school_admins'],
    ['licenseLineQuota', 'license_line_quota'],
  ] as const) {
    if (body[inputKey] === undefined) continue;
    const value = Number(body[inputKey]);
    if (!Number.isInteger(value) || value < 0) {
      return NextResponse.json(
        { message: 'ข้อจำกัด License ต้องเป็นเลขจำนวนเต็มตั้งแต่ 0' },
        { status: 400 }
      );
    }
    update[column] = value;
  }
  if (requestedPlanCode) {
    if (caller.role !== 'master_admin') {
      return NextResponse.json(
        { message: 'เฉพาะร้าน E-KRU เท่านั้นที่เชื่อมแพ็กเกจจากระบบได้' },
        { status: 403 }
      );
    }
    const licenseScope = String(body.licenseScope ?? 'school');
    if (licenseScope === 'teacher') {
      return NextResponse.json(
        { message: 'แพ็กเกจ E-KRU ไม่รองรับ License แบบ Seat รายครู' },
        { status: 400 }
      );
    }
    const { data: plan, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select(
        'code,plan_scope,billing_cycle,max_school_admins,max_teachers,max_students,max_line_notifications,enabled_features'
      )
      .eq('code', requestedPlanCode)
      .eq('is_active', true)
      .maybeSingle();
    if (planError || !plan) {
      return NextResponse.json(
        { message: planError?.message ?? 'ไม่พบแพ็กเกจ E-KRU ที่เปิดใช้งาน' },
        { status: planError ? 500 : 400 }
      );
    }
    const expectedPlanScope = licenseScope === 'individual' ? 'individual' : 'school';
    if (plan.plan_scope !== expectedPlanScope) {
      return NextResponse.json(
        {
          message:
            expectedPlanScope === 'individual'
              ? 'แพ็กเกจนี้สำหรับโรงเรียน ไม่สามารถขายเป็นสิทธิ์บุคคลได้'
              : 'แพ็กเกจนี้สำหรับบุคคล ไม่สามารถขายให้โรงเรียนได้',
        },
        { status: 400 }
      );
    }
    update.grants_plan_code = plan.code;
    update.grants_feature_keys = plan.enabled_features;
    update.grants_feature_key = plan.enabled_features[0] ?? null;
    update.license_max_school_admins = plan.max_school_admins;
    update.license_max_teachers = plan.max_teachers;
    update.license_max_students = plan.max_students;
    update.license_line_quota = plan.max_line_notifications;
    if (plan.billing_cycle === 'monthly') update.grant_duration_days = 30;
    if (plan.billing_cycle === 'yearly') update.grant_duration_days = 365;
  }
  if (body.saleTypeId !== undefined) {
    const saleTypeId = String(body.saleTypeId).trim();
    if (saleTypeId) {
      const { data: saleType } = await supabaseAdmin
        .from('marketplace_sale_types')
        .select('id, pricing_mode')
        .eq('id', saleTypeId)
        .eq('is_active', true)
        .maybeSingle();
      if (!saleType) {
        return NextResponse.json(
          { message: 'ประเภทการจำหน่ายไม่มีอยู่หรือถูกปิดใช้งาน' },
          { status: 400 }
        );
      }
      resolvedSaleType = saleType;
      update.sale_type_id = saleType.id;
    } else {
      update.sale_type_id = null;
    }
  }
  if (body.price !== undefined) {
    let price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ message: 'ราคาต้องไม่ต่ำกว่า 0' }, { status: 400 });
    }
    if (resolvedSaleType?.pricing_mode === 'free') price = 0;
    if (resolvedSaleType?.pricing_mode === 'paid' && price <= 0) {
      return NextResponse.json(
        { message: 'สินค้าจำหน่ายแบบมีราคาต้องระบุราคามากกว่า 0 บาท' },
        { status: 400 }
      );
    }
    update.price = price;
  }
  if (body.listPrice !== undefined) {
    if (
      body.listPrice === null ||
      body.listPrice === '' ||
      resolvedSaleType?.pricing_mode === 'free'
    ) {
      update.list_price = null;
    } else {
      const listPrice = Number(body.listPrice);
      const salePrice = Number(update.price ?? body.price);
      if (
        !Number.isFinite(listPrice) ||
        listPrice < 0 ||
        !Number.isFinite(salePrice) ||
        listPrice < salePrice
      ) {
        return NextResponse.json({ message: 'ราคาเต็มต้องไม่น้อยกว่าราคาขาย' }, { status: 400 });
      }
      update.list_price = listPrice > salePrice ? listPrice : null;
    }
  }

  const step = Number(body.step);
  if (Number.isFinite(step) && step > 0) {
    update.wizard_step = Math.min(4, Math.max(1, step));
  }

  const { data: updated, error } = await supabaseAdmin
    .from('marketplace_products')
    .update(update)
    .eq('id', id)
    .eq('seller_id', seller.id)
    .select('id')
    .maybeSingle();
  if (error || !updated) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบสินค้า' },
      { status: error ? 500 : 404 }
    );
  }

  if (gradeLevelIds) {
    await supabaseAdmin.from('marketplace_product_grade_levels').delete().eq('product_id', id);
    if (gradeLevelIds.length) {
      await supabaseAdmin
        .from('marketplace_product_grade_levels')
        .insert(gradeLevelIds.map((grade_level_id) => ({ product_id: id, grade_level_id })));
    }
  }
  if (tagIds) {
    await supabaseAdmin.from('marketplace_product_tags').delete().eq('product_id', id);
    if (tagIds.length) {
      await supabaseAdmin
        .from('marketplace_product_tags')
        .insert(tagIds.map((tag_id) => ({ product_id: id, tag_id })));
    }
  }

  const { data: product, error: reloadError } = await supabaseAdmin
    .from('marketplace_products')
    .select(PRODUCT_MANAGE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (reloadError || !product) {
    return NextResponse.json({ message: reloadError?.message ?? 'ไม่พบสินค้า' }, { status: 500 });
  }

  if (body.submit) {
    if (String(product.title ?? '').trim().length < 3) {
      return NextResponse.json(
        { message: 'กรุณากรอกชื่อสินค้าอย่างน้อย 3 ตัวอักษร' },
        { status: 400 }
      );
    }
    if (plainTextLength(String(product.description ?? '')) < 10) {
      return NextResponse.json(
        { message: 'กรุณากรอกรายละเอียดสินค้าอย่างน้อย 10 ตัวอักษร' },
        { status: 400 }
      );
    }
    if (!product.category) {
      return NextResponse.json({ message: 'กรุณาเลือกหมวดหมู่สินค้า' }, { status: 400 });
    }
    if (!product.media_type_id) {
      return NextResponse.json({ message: 'กรุณาเลือกประเภทสื่อ' }, { status: 400 });
    }
    if (!product.sale_type_id) {
      return NextResponse.json({ message: 'กรุณาเลือกประเภทการจำหน่าย' }, { status: 400 });
    }
    if (!Number.isFinite(Number(product.price)) || Number(product.price) < 0) {
      return NextResponse.json({ message: 'ราคาสินค้าไม่ถูกต้อง' }, { status: 400 });
    }
    if (product.list_price != null && Number(product.list_price) < Number(product.price)) {
      return NextResponse.json({ message: 'ราคาเต็มต้องไม่น้อยกว่าราคาขาย' }, { status: 400 });
    }
    if (!(product.images as unknown[] | null)?.length) {
      return NextResponse.json({ message: 'กรุณาอัปโหลดรูปปกอย่างน้อย 1 รูป' }, { status: 400 });
    }
    const fileOptional = FILE_OPTIONAL_RESOURCE_TYPES.has(String(product.resource_type));
    if (!fileOptional && !(product.files as unknown[] | null)?.length) {
      return NextResponse.json(
        { message: 'กรุณาอัปโหลดไฟล์สินค้าอย่างน้อย 1 ไฟล์' },
        { status: 400 }
      );
    }
    if (product.resource_type === 'feature_unlock') {
      const featureKeys = (product.grants_feature_keys ?? []) as string[];
      if (!featureKeys.length) {
        return NextResponse.json(
          { message: 'กรุณาเลือกฟีเจอร์ในแพ็กเกจอย่างน้อย 1 รายการ' },
          { status: 400 }
        );
      }
      if (!(Number(product.grant_duration_days) > 0)) {
        return NextResponse.json({ message: 'กรุณาระบุระยะเวลาปลดล็อก' }, { status: 400 });
      }
      if (product.license_scope === 'teacher' && !(Number(product.license_seat_count) > 0)) {
        return NextResponse.json({ message: 'กรุณาระบุจำนวน Seat ครู' }, { status: 400 });
      }
      const isFullSystem =
        product.license_scope === 'school' && featureKeys.length === ALL_SCHOOL_FEATURE_KEYS.length;
      if (
        isFullSystem &&
        (!product.grants_plan_code ||
          product.license_max_teachers == null ||
          product.license_max_students == null ||
          product.license_max_school_admins == null ||
          product.license_line_quota == null)
      ) {
        return NextResponse.json(
          {
            message:
              'แพ็กเกจ E-KRU ทั้งระบบต้องระบุ Plan Code จำนวนครู นักเรียน ผู้ดูแล และ LINE quota ให้ครบ',
          },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    const { data: submitted, error: submitError } = await supabaseAdmin
      .from('marketplace_products')
      .update({
        status: caller.role === 'master_admin' ? 'published' : 'pending_review',
        submitted_at: now,
        reviewed_at: caller.role === 'master_admin' ? now : null,
        reviewed_by: caller.role === 'master_admin' ? caller.sub : null,
        rejection_reason: null,
        updated_at: now,
      })
      .eq('id', id)
      .eq('seller_id', seller.id)
      .select(PRODUCT_MANAGE_SELECT)
      .maybeSingle();
    if (submitError || !submitted) {
      return NextResponse.json(
        { message: submitError?.message ?? 'ไม่สามารถส่งสินค้าได้' },
        { status: 500 }
      );
    }

    if (submitted.status === 'pending_review') {
      await notifyMarketplaceAdmins({
        event: 'product_approval',
        sourceId: submitted.id,
        message: [
          '📚 มีสินค้ารออนุมัติ',
          `ชื่อสินค้า: ${submitted.title}`,
          `หมวดหมู่: ${submitted.category}`,
        ].join('\n'),
        actionUrl: `${new URL(request.url).origin}/dashboard/product-approvals`,
      });
    }

    return NextResponse.json({ product: await withMediaUrls(submitted) });
  }

  return NextResponse.json({ product: await withMediaUrls(product) });
}

export async function DELETE(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const seller = await ownedSellerId(caller.sub);
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });

  const { id } = await params;
  const { data: product, error } = await supabaseAdmin
    .from('marketplace_products')
    .select(
      'id, status, images:marketplace_product_images(storage_bucket, storage_path), files:marketplace_product_files(storage_bucket, storage_path)'
    )
    .eq('id', id)
    .eq('seller_id', seller.id)
    .maybeSingle();
  if (error || !product) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบสินค้า' },
      { status: error ? 500 : 404 }
    );
  }
  if (!['draft', 'rejected'].includes(product.status)) {
    return NextResponse.json(
      { message: 'ลบได้เฉพาะสินค้าที่เป็นแบบร่างหรือไม่ผ่านการอนุมัติเท่านั้น' },
      { status: 409 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from('marketplace_products')
    .delete()
    .eq('id', id)
    .eq('seller_id', seller.id);
  if (deleteError) {
    return NextResponse.json({ message: deleteError.message }, { status: 500 });
  }

  const byBucket = new Map<string, string[]>();
  for (const media of [...(product.images ?? []), ...(product.files ?? [])]) {
    const paths = byBucket.get(media.storage_bucket) ?? [];
    paths.push(media.storage_path);
    byBucket.set(media.storage_bucket, paths);
  }
  await Promise.all(
    [...byBucket.entries()].map(([bucket, paths]) =>
      supabaseAdmin.storage.from(bucket).remove(paths)
    )
  );

  return NextResponse.json({ success: true });
}
