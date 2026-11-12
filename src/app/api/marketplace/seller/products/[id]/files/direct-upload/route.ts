import { z } from 'zod';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import { optimizeUploadedImage } from 'src/lib/server-image-optimizer';
import { scanBufferForMalware, MalwareScannerUnavailableError } from 'src/lib/malware-scanner';

import { refreshedFiles } from 'src/sections/marketplace/seller/server/product-media';
import { ownedProduct, ownedSellerId } from 'src/sections/marketplace/seller/server/owned-seller';
import {
  signUploadTicket,
  verifyUploadTicket,
} from 'src/sections/marketplace/seller/server/product-upload-ticket';
import {
  PRODUCT_FILE_BUCKET,
  PRODUCT_FILE_MAX_BYTES,
  PRODUCT_FILE_EXTENSIONS,
} from 'src/sections/marketplace/shared/product-upload-policy';

class InvalidUploadedFile extends Error {}

const InitSchema = z.object({
  action: z.literal('init'),
  name: z
    .string()
    .min(1)
    .max(255)
    .refine((name) => name.trim().length > 0),
  mime: z.string().refine((mime) => Boolean(PRODUCT_FILE_EXTENSIONS[mime])),
  size: z.number().int().min(1).max(PRODUCT_FILE_MAX_BYTES),
  isPreview: z.boolean(),
});
const CompleteSchema = z.object({ action: z.literal('complete'), ticket: z.string().max(4096) });
const BodySchema = z.discriminatedUnion('action', [InitSchema, CompleteSchema]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const seller = await ownedSellerId(caller.sub, caller.role);
  if (!seller || seller.status !== 'active')
    return NextResponse.json({ message: 'ไม่มีสิทธิ์อัปโหลด' }, { status: 403 });
  const { id: productId } = await params;
  if (!(await ownedProduct(productId, seller.id)))
    return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ message: 'ข้อมูลไฟล์ไม่ถูกต้อง รองรับไฟล์ไม่เกิน 10 MB' }, { status: 400 });
  if (
    !(await isActionAllowed({
      request,
      action: 'marketplace-product-direct-upload',
      subject: caller.sub,
      maxAttempts: 60,
      windowSeconds: 300,
    }))
  ) {
    return NextResponse.json({ message: 'อัปโหลดบ่อยเกินไป' }, { status: 429 });
  }
  const body = parsed.data;
  if (body.action === 'init') {
    const { count, error } = await supabaseAdmin
      .from('marketplace_product_files')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .eq('is_preview', body.isPreview);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    if ((count ?? 0) >= (body.isPreview ? 1 : 5))
      return NextResponse.json({ message: 'จำนวนไฟล์ครบแล้ว' }, { status: 400 });
    const id = crypto.randomUUID();
    const path = `${productId}/pending/${id}.${PRODUCT_FILE_EXTENSIONS[body.mime]}`;
    const { data, error: signError } = await supabaseAdmin.storage
      .from(PRODUCT_FILE_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (signError || !data)
      return NextResponse.json(
        { message: signError?.message ?? 'สร้างลิงก์อัปโหลดไม่สำเร็จ' },
        { status: 500 }
      );
    return NextResponse.json({
      signedUrl: data.signedUrl,
      ticket: signUploadTicket({
        id,
        productId,
        userId: caller.sub,
        name: body.name,
        size: body.size,
        mime: body.mime,
        isPreview: body.isPreview,
        path,
      }),
    });
  }
  let ticket;
  try {
    ticket = verifyUploadTicket(body.ticket);
  } catch {
    return NextResponse.json({ message: 'สิทธิ์อัปโหลดไม่ถูกต้องหรือหมดอายุ' }, { status: 403 });
  }
  if (ticket.productId !== productId || ticket.userId !== caller.sub)
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ยืนยันไฟล์นี้' }, { status: 403 });
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('marketplace_product_files')
    .select('id')
    .eq('id', ticket.id)
    .eq('product_id', productId)
    .maybeSingle();
  if (existingError) return NextResponse.json({ message: existingError.message }, { status: 500 });
  if (existing) return NextResponse.json({ files: await refreshedFiles(productId) });
  const storage = supabaseAdmin.storage.from(PRODUCT_FILE_BUCKET);
  let finalPath: string | null = null;
  let committed = false;
  try {
    const { data, error } = await storage.download(ticket.path);
    if (error || !data)
      return NextResponse.json({ message: 'ยังไม่พบไฟล์ที่อัปโหลด กรุณาลองยืนยันอีกครั้ง' }, { status: 409 });
    if (
      data.size !== ticket.size ||
      data.size > PRODUCT_FILE_MAX_BYTES ||
      data.type.split(';')[0] !== ticket.mime
    )
      throw new InvalidUploadedFile('ขนาดหรือชนิดไฟล์จริงไม่ตรงกับข้อมูลอัปโหลด');
    const file = new File([data], ticket.name, { type: ticket.mime });
    const image = ticket.mime.startsWith('image/')
      ? await optimizeUploadedImage(file, { output: 'original', resize: false })
      : null;
    const bytes = image?.data ?? Buffer.from(await data.arrayBuffer());
    let scan = null;
    let scanReason = null;
    try {
      scan = await scanBufferForMalware(bytes);
    } catch (scanError) {
      if (!(scanError instanceof MalwareScannerUnavailableError)) throw scanError;
      scanReason = scanError.message;
    }
    if (scan?.status === 'rejected')
      throw new InvalidUploadedFile('ไฟล์ถูกปฏิเสธ เนื่องจากตรวจพบไฟล์อันตราย');
    const { count: currentCount, error: countError } = await supabaseAdmin
      .from('marketplace_product_files')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .eq('is_preview', ticket.isPreview);
    if (countError) throw new Error(countError.message);
    if ((currentCount ?? 0) >= (ticket.isPreview ? 1 : 5)) {
      return NextResponse.json(
        { message: 'จำนวนไฟล์ครบแล้ว กรุณาลบไฟล์เดิมก่อนลองยืนยันอีกครั้ง' },
        { status: 409 }
      );
    }
    const path = `${productId}/file-${ticket.id}.${image?.extension ?? PRODUCT_FILE_EXTENSIONS[ticket.mime]}`;
    const { error: uploadError } = await storage.upload(path, bytes, {
      contentType: image?.contentType ?? ticket.mime,
      upsert: false,
    });
    if (uploadError) throw new Error(uploadError.message);
    finalPath = path;
    const { data: last, error: positionError } = await supabaseAdmin
      .from('marketplace_product_files')
      .select('position')
      .eq('product_id', productId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (positionError) throw new Error(positionError.message);
    const { error: insertError } = await supabaseAdmin.from('marketplace_product_files').insert({
      id: ticket.id,
      product_id: productId,
      storage_bucket: PRODUCT_FILE_BUCKET,
      storage_path: path,
      file_name: ticket.name,
      mime_type: image?.contentType ?? ticket.mime,
      file_size: bytes.length,
      is_preview: ticket.isPreview,
      position: (last?.position ?? -1) + 1,
      scan_status: scan?.status ?? 'pending_scan',
      scan_engine: scan?.engine ?? null,
      scan_result: (scan?.detail ?? scanReason)?.slice(0, 1000) ?? null,
      scanned_at: scan ? new Date().toISOString() : null,
    });
    if (insertError) throw new Error(insertError.message);
    committed = true;
  } catch (error) {
    if (finalPath && !committed) await storage.remove([finalPath]);
    if (error instanceof InvalidUploadedFile) await storage.remove([ticket.path]);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'ยืนยันไฟล์ไม่สำเร็จ' },
      { status: error instanceof InvalidUploadedFile ? 422 : 500 }
    );
  } finally {
    if (committed) await storage.remove([ticket.path]);
  }
  return NextResponse.json({ files: await refreshedFiles(productId) });
}
