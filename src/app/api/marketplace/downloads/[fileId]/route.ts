import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { writeSecurityAudit } from 'src/lib/security-audit';

type Context = { params: Promise<{ fileId: string }> };

export async function GET(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  if (!caller) {
    await writeSecurityAudit({
      request,
      category: 'download',
      action: 'marketplace.product_file_download',
      targetType: 'product_file',
      result: 'denied',
      metadata: { reason: 'not_authenticated' },
    });
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const { fileId } = await params;
  const orderItemId = new URL(request.url).searchParams.get('orderItemId');
  if (!orderItemId) {
    await writeSecurityAudit({
      request,
      actorId: caller.sub,
      actorUsername: caller.username,
      actorRole: caller.role,
      category: 'download',
      action: 'marketplace.product_file_download',
      targetType: 'product_file',
      targetId: fileId,
      result: 'failure',
      metadata: { reason: 'missing_order_item' },
    });
    return NextResponse.json({ message: 'ไม่พบรายการสั่งซื้อ' }, { status: 400 });
  }

  const [{ data: file, error: fileError }, { data: orderItem, error: orderError }] =
    await Promise.all([
      supabaseAdmin
        .from('marketplace_product_files')
        .select('id, product_id, storage_bucket, storage_path, file_name')
        .eq('id', fileId)
        .maybeSingle(),
      supabaseAdmin
        .from('marketplace_order_items')
        .select('id, product_id, order:marketplace_orders!inner(id)')
        .eq('id', orderItemId)
        .eq('order.buyer_id', caller.sub)
        .in('order.status', ['paid', 'completed'])
        .maybeSingle(),
    ]);

  if (fileError || orderError) {
    return NextResponse.json(
      { message: fileError?.message ?? orderError?.message ?? 'ตรวจสอบสิทธิ์ดาวน์โหลดไม่สำเร็จ' },
      { status: 500 }
    );
  }
  if (!file || !orderItem || orderItem.product_id !== file.product_id) {
    await writeSecurityAudit({
      request,
      actorId: caller.sub,
      actorUsername: caller.username,
      actorRole: caller.role,
      category: 'download',
      action: 'marketplace.product_file_download',
      targetType: 'product_file',
      targetId: fileId,
      result: 'denied',
      metadata: { order_item_id: orderItemId, reason: 'not_entitled' },
    });
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดาวน์โหลดไฟล์นี้' }, { status: 403 });
  }

  const { data: signedFile, error: signedError } = await supabaseAdmin.storage
    .from(file.storage_bucket)
    .createSignedUrl(file.storage_path, 60, { download: file.file_name });
  if (signedError || !signedFile?.signedUrl) {
    return NextResponse.json(
      { message: signedError?.message ?? 'ไม่สามารถสร้างลิงก์ดาวน์โหลดได้' },
      { status: 500 }
    );
  }

  const { error: analyticsError } = await supabaseAdmin
    .from('marketplace_product_downloads')
    .insert({
      product_id: file.product_id,
      product_file_id: file.id,
      order_item_id: orderItem.id,
      buyer_id: caller.sub,
    });
  if (analyticsError) {
    await writeSecurityAudit({
      request,
      actorId: caller.sub,
      actorUsername: caller.username,
      actorRole: caller.role,
      category: 'download',
      action: 'marketplace.product_file_download',
      targetType: 'product_file',
      targetId: file.id,
      result: 'failure',
      metadata: { order_item_id: orderItem.id, reason: 'download_tracking_failed' },
    });
    return NextResponse.json({ message: analyticsError.message }, { status: 500 });
  }

  await writeSecurityAudit({
    request,
    actorId: caller.sub,
    actorUsername: caller.username,
    actorRole: caller.role,
    category: 'download',
    action: 'marketplace.product_file_download',
    targetType: 'product_file',
    targetId: file.id,
    result: 'success',
    metadata: {
      product_id: file.product_id,
      order_item_id: orderItem.id,
      signed_url_ttl_seconds: 60,
    },
  });

  return NextResponse.redirect(signedFile.signedUrl, 307);
}
