import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

const GIB = 1024 ** 3;

function authorize(request: Request) {
  return requireRole(request, ['master_admin', 'marketplace_admin']);
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูพื้นที่จัดเก็บของระบบ' }, { status: 403 });
  }

  const [{ data: settings, error: settingsError }, usageResult] = await Promise.all([
    supabaseAdmin
      .from('marketplace_storage_settings')
      .select('capacity_bytes,warning_percent,critical_percent,updated_at')
      .eq('id', 'default')
      .maybeSingle(),
    supabaseAdmin.rpc('marketplace_storage_usage_summary'),
  ]);

  if (settingsError || usageResult.error) {
    const missingMigration =
      settingsError?.code === '42P01' || usageResult.error?.code === '42883';
    return NextResponse.json(
      {
        message: missingMigration
          ? 'กรุณาติดตั้ง migration ระบบตรวจสอบพื้นที่จัดเก็บก่อน'
          : settingsError?.message ?? usageResult.error?.message,
        setupRequired: missingMigration,
      },
      { status: missingMigration ? 503 : 500 }
    );
  }

  const buckets = ((usageResult.data ?? []) as Array<Record<string, unknown>>).map((bucket) => ({
    bucketId: String(bucket.bucket_id),
    objectCount: Number(bucket.object_count) || 0,
    totalBytes: Number(bucket.total_bytes) || 0,
    largestObjectBytes: Number(bucket.largest_object_bytes) || 0,
    lastUploadedAt: bucket.last_uploaded_at ? String(bucket.last_uploaded_at) : null,
  }));
  const usedBytes = buckets.reduce((sum, bucket) => sum + bucket.totalBytes, 0);
  const capacityBytes = Number(settings?.capacity_bytes) || GIB;
  const usedPercent = Math.min(100, (usedBytes / capacityBytes) * 100);
  const warningPercent = Number(settings?.warning_percent) || 80;
  const criticalPercent = Number(settings?.critical_percent) || 90;

  return NextResponse.json({
    summary: {
      usedBytes,
      capacityBytes,
      remainingBytes: Math.max(0, capacityBytes - usedBytes),
      usedPercent,
      objectCount: buckets.reduce((sum, bucket) => sum + bucket.objectCount, 0),
      status:
        usedPercent >= criticalPercent
          ? 'critical'
          : usedPercent >= warningPercent
            ? 'warning'
            : 'normal',
    },
    settings: {
      capacityGb: capacityBytes / GIB,
      warningPercent,
      criticalPercent,
      updatedAt: settings?.updated_at ?? null,
    },
    buckets,
    measuredAt: new Date().toISOString(),
  });
}

export async function PATCH(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ตั้งค่าพื้นที่จัดเก็บ' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const capacityGb = Number(body?.capacityGb);
  const warningPercent = Number(body?.warningPercent);
  const criticalPercent = Number(body?.criticalPercent);

  if (
    !Number.isFinite(capacityGb) ||
    capacityGb < 0.1 ||
    capacityGb > 100000 ||
    !Number.isInteger(warningPercent) ||
    warningPercent < 1 ||
    warningPercent > 99 ||
    !Number.isInteger(criticalPercent) ||
    criticalPercent <= warningPercent ||
    criticalPercent > 100
  ) {
    return NextResponse.json({ message: 'ค่าความจุหรือระดับแจ้งเตือนไม่ถูกต้อง' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('marketplace_storage_settings').upsert(
    {
      id: 'default',
      capacity_bytes: Math.round(capacityGb * GIB),
      warning_percent: warningPercent,
      critical_percent: criticalPercent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
