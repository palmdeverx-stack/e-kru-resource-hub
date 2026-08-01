import type { MalwareScanResult } from 'src/lib/malware-scanner';

import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import { optimizeUploadedImage } from 'src/lib/server-image-optimizer';
import { scanBufferForMalware, MalwareScannerUnavailableError } from 'src/lib/malware-scanner';

import { refreshedFiles } from 'src/sections/marketplace/seller/server/product-media';
import { ownedProduct, ownedSellerId } from 'src/sections/marketplace/seller/server/owned-seller';

const BUCKET = 'marketplace-product-files';
const MAX_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 20;

class MalwareDetectedError extends Error {}

const EXTENSION_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  if (
    !(await isActionAllowed({
      request,
      action: 'marketplace-product-file-upload',
      subject: caller.sub,
      maxAttempts: 30,
      windowSeconds: 5 * 60,
    }))
  ) {
    return NextResponse.json({ message: 'อัปโหลดไฟล์บ่อยเกินไป' }, { status: 429 });
  }

  const seller = await ownedSellerId(caller.sub);
  if (!seller) return NextResponse.json({ message: 'ไม่พบร้านค้า' }, { status: 404 });

  const { id: productId } = await params;
  const product = await ownedProduct(productId, seller.id);
  if (!product) return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });

  const formData = await request.formData();
  const files = formData
    .getAll('files')
    .filter((file): file is File => file instanceof File && file.size > 0);
  if (!files.length) {
    return NextResponse.json({ message: 'กรุณาเลือกไฟล์' }, { status: 400 });
  }

  const invalid = files.find((file) => !EXTENSION_BY_TYPE[file.type] || file.size > MAX_SIZE);
  if (invalid) {
    return NextResponse.json(
      { message: `ไฟล์ "${invalid.name}" ไม่รองรับหรือมีขนาดเกิน 50MB` },
      { status: 400 }
    );
  }

  const { count: existingCount } = await supabaseAdmin
    .from('marketplace_product_files')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', productId);
  if ((existingCount ?? 0) + files.length > MAX_FILES) {
    return NextResponse.json(
      { message: `อัปโหลดไฟล์ได้สูงสุด ${MAX_FILES} ไฟล์ต่อสินค้า` },
      { status: 400 }
    );
  }

  const { data: maxPositionRow } = await supabaseAdmin
    .from('marketplace_product_files')
    .select('position')
    .eq('product_id', productId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextPosition = (maxPositionRow?.position ?? -1) + 1;

  const uploadedPaths: string[] = [];
  const rows: Record<string, unknown>[] = [];
  try {
    for (const file of files) {
      const image =
        file.type === 'image/png'
          ? await optimizeUploadedImage(file, { output: 'original', resize: false })
          : null;
      const fileBuffer = image?.data
        ? Buffer.from(image.data)
        : Buffer.from(await file.arrayBuffer());
      let scan: MalwareScanResult | null = null;
      let pendingScanReason: string | null = null;
      try {
        scan = await scanBufferForMalware(fileBuffer);
      } catch (scanError) {
        if (!(scanError instanceof MalwareScannerUnavailableError)) throw scanError;
        pendingScanReason = scanError.message;
      }
      if (scan?.status === 'rejected') {
        throw new MalwareDetectedError(`ไฟล์ "${file.name}" ถูกปฏิเสธ เนื่องจากตรวจพบไฟล์อันตราย`);
      }
      const extension = image?.extension ?? EXTENSION_BY_TYPE[file.type];
      const path = `${productId}/file-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, fileBuffer, {
          contentType: image?.contentType ?? file.type,
        });
      if (uploadError) throw new Error(uploadError.message);
      uploadedPaths.push(path);
      rows.push({
        product_id: productId,
        storage_bucket: BUCKET,
        storage_path: path,
        file_name: file.name.slice(0, 255),
        mime_type: image?.contentType ?? file.type,
        file_size: image?.size ?? file.size,
        position: nextPosition++,
        is_preview: false,
        scan_status: scan?.status ?? 'pending_scan',
        scan_engine: scan?.engine ?? null,
        scan_result: scan?.detail.slice(0, 1000) ?? pendingScanReason?.slice(0, 1000) ?? null,
        scanned_at: scan ? new Date().toISOString() : null,
      });
    }
    const { error: insertError } = await supabaseAdmin
      .from('marketplace_product_files')
      .insert(rows);
    if (insertError) throw new Error(insertError.message);
  } catch (uploadError) {
    if (uploadedPaths.length) await supabaseAdmin.storage.from(BUCKET).remove(uploadedPaths);
    if (uploadError instanceof MalwareDetectedError) {
      return NextResponse.json({ message: uploadError.message }, { status: 422 });
    }
    return NextResponse.json(
      { message: uploadError instanceof Error ? uploadError.message : 'อัปโหลดไฟล์ไม่สำเร็จ' },
      { status: 500 }
    );
  }

  return NextResponse.json({ files: await refreshedFiles(productId) });
}
