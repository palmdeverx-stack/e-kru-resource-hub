import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import { optimizeUploadedImage } from 'src/lib/server-image-optimizer';
import { watermarkPdfDocument } from 'src/lib/server-document-watermark';
import { SELLER_DOCUMENT_WATERMARK_LINES } from 'src/lib/document-watermark-copy';

const TYPES = new Set([
  'store_logo',
  'store_cover',
  'identity_card',
  'bank_book',
  'company_certificate',
  'vat_certificate',
  'receipt_signature',
]);

function hasValidSignatureHeader(bytes: Uint8Array, mimeType: string) {
  if (mimeType === 'image/png') {
    return (
      bytes.length >= 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    );
  }
  return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
}

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const documentId = new URL(request.url).searchParams.get('documentId');
  if (!documentId) {
    return NextResponse.json({ message: 'ไม่พบรหัสเอกสาร' }, { status: 400 });
  }

  const { data: document, error } = await supabaseAdmin
    .from('marketplace_seller_documents')
    .select('id, seller_id, storage_bucket, storage_path, file_name, mime_type')
    .eq('id', documentId)
    .maybeSingle();
  if (error || !document) {
    return NextResponse.json({ message: 'ไม่พบเอกสาร' }, { status: 404 });
  }

  const { data: seller } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('owner_id')
    .eq('id', document.seller_id)
    .maybeSingle();
  const isAdmin = caller.role === 'master_admin' || caller.role === 'marketplace_admin';
  if (!seller || (seller.owner_id !== caller.sub && !isAdmin)) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูเอกสารนี้' }, { status: 403 });
  }

  const { data: file, error: downloadError } = await supabaseAdmin.storage
    .from(document.storage_bucket)
    .download(document.storage_path);
  if (downloadError || !file) {
    return NextResponse.json(
      { message: downloadError?.message ?? 'ไม่สามารถโหลดเอกสารได้' },
      { status: 404 }
    );
  }

  const encodedFileName = encodeURIComponent(document.file_name || 'document');
  return new Response(file, {
    headers: {
      'Content-Type': document.mime_type || file.type || 'application/octet-stream',
      'Content-Disposition': `inline; filename="document"; filename*=UTF-8''${encodedFileName}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const formData = await request.formData();
  const documentType = String(formData.get('documentType') ?? '');
  const file = formData.get('file');
  if (!TYPES.has(documentType) || !(file instanceof File)) {
    return NextResponse.json({ message: 'ประเภทเอกสารหรือไฟล์ไม่ถูกต้อง' }, { status: 400 });
  }
  const isAsset = ['store_logo', 'store_cover'].includes(documentType);
  const isReceiptSignature = documentType === 'receipt_signature';
  const accepted = isReceiptSignature
    ? ['image/jpeg', 'image/png']
    : isAsset
      ? ['image/jpeg', 'image/png', 'image/webp']
      : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const maxSizeMb = isReceiptSignature || isAsset || documentType === 'bank_book' ? 2 : 10;
  const maxSize = maxSizeMb * 1024 * 1024;
  if (!accepted.includes(file.type) || file.size > maxSize) {
    return NextResponse.json(
      {
        message: `ไฟล์ไม่ถูกต้องหรือมีขนาดเกิน ${maxSizeMb} MB`,
      },
      { status: 400 }
    );
  }
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  if (isReceiptSignature && !hasValidSignatureHeader(fileBytes, file.type)) {
    return NextResponse.json(
      { message: 'ไฟล์ลายเซ็นไม่ใช่รูป PNG หรือ JPG ที่ถูกต้อง' },
      { status: 400 }
    );
  }
  const { data: seller } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, owner_id, status, pending_profile_data')
    .eq('owner_id', caller.sub)
    .maybeSingle();
  if (!seller) {
    return NextResponse.json({ message: 'กรุณาบันทึกข้อมูลร้านก่อนอัปโหลดไฟล์' }, { status: 409 });
  }
  if (seller.status === 'suspended') {
    return NextResponse.json({ message: 'ร้านถูกระงับการใช้งาน' }, { status: 403 });
  }

  const bucket = isAsset ? 'marketplace-seller-assets' : 'marketplace-seller-documents';
  const shouldWatermark = !isAsset && !isReceiptSignature;

  let uploadData: Uint8Array | Buffer = fileBytes;
  let storedContentType = file.type;
  let storedSize = file.size;
  let extension = file.type === 'application/pdf' ? 'pdf' : 'jpg';
  try {
    if (file.type === 'application/pdf') {
      if (shouldWatermark) {
        uploadData = await watermarkPdfDocument(fileBytes, SELLER_DOCUMENT_WATERMARK_LINES);
      }
    } else {
      const optimizedImage = await optimizeUploadedImage(file, {
        preset: isAsset ? 'content' : 'document',
        output: isAsset ? 'webp' : 'original',
        watermarkLines: shouldWatermark ? SELLER_DOCUMENT_WATERMARK_LINES : undefined,
      });
      uploadData = optimizedImage.data;
      storedContentType = optimizedImage.contentType;
      extension = optimizedImage.extension;
    }
    storedSize = uploadData.byteLength;
  } catch {
    return NextResponse.json(
      { message: 'ไม่สามารถประมวลผลและใส่ลายน้ำในเอกสารนี้ได้ กรุณาเลือกไฟล์ใหม่' },
      { status: 400 }
    );
  }
  const path = `${seller.id}/${documentType}-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, uploadData, { contentType: storedContentType });
  if (uploadError) return NextResponse.json({ message: uploadError.message }, { status: 500 });

  const { data: previous } = await supabaseAdmin
    .from('marketplace_seller_documents')
    .select('storage_bucket, storage_path')
    .eq('seller_id', seller.id)
    .eq('document_type', documentType)
    .maybeSingle();
  const uploadedAt = new Date().toISOString();
  const { data: document, error } = await supabaseAdmin
    .from('marketplace_seller_documents')
    .upsert(
      {
        seller_id: seller.id,
        document_type: documentType,
        storage_bucket: bucket,
        storage_path: path,
        file_name: file.name.slice(0, 255),
        mime_type: storedContentType,
        file_size: storedSize,
        uploaded_at: uploadedAt,
        updated_at: uploadedAt,
      },
      { onConflict: 'seller_id,document_type' }
    )
    .select('*')
    .single();
  if (error || !document) {
    await supabaseAdmin.storage.from(bucket).remove([path]);
    return NextResponse.json({ message: error?.message }, { status: 500 });
  }
  if (previous && !isReceiptSignature && !(isAsset && seller.status === 'active')) {
    await supabaseAdmin.storage.from(previous.storage_bucket).remove([previous.storage_path]);
  }
  if (isReceiptSignature) {
    const { error: receiptUpdateError } = await supabaseAdmin
      .from('marketplace_receipts')
      .update({
        provider_signature_bucket: bucket,
        provider_signature_path: path,
        provider_signature_mime_type: storedContentType,
        updated_at: new Date().toISOString(),
      })
      .eq('issued_by', seller.owner_id)
      .is('provider_signature_path', null);
    if (receiptUpdateError) {
      return NextResponse.json({ message: receiptUpdateError.message }, { status: 500 });
    }
  }

  let url: string | null = null;
  if (isAsset) {
    url = supabaseAdmin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const assetField = documentType === 'store_logo' ? 'logo_url' : 'cover_url';
    const pendingProfile = seller.pending_profile_data as Record<string, unknown> | null;
    const { error: updateSellerError } = await supabaseAdmin
      .from('marketplace_sellers')
      .update(
        seller.status === 'active'
          ? {
              [assetField]: url,
              ...(pendingProfile && {
                pending_profile_data: { ...pendingProfile, [assetField]: url },
              }),
              updated_at: new Date().toISOString(),
            }
          : { [assetField]: url, updated_at: new Date().toISOString() }
      )
      .eq('id', seller.id);
    if (updateSellerError) {
      return NextResponse.json({ message: updateSellerError.message }, { status: 500 });
    }
    if (previous && seller.status === 'active') {
      await supabaseAdmin.storage.from(previous.storage_bucket).remove([previous.storage_path]);
    }
  } else {
    url = `/api/marketplace/seller/documents?documentId=${encodeURIComponent(document.id)}`;
  }
  return NextResponse.json({
    document: { ...document, url },
    message:
      isAsset && seller.status === 'active'
        ? 'อัปโหลดรูปเรียบร้อยและแสดงผลบนหน้าร้านทันทีแล้ว'
        : 'อัปโหลดไฟล์เรียบร้อยแล้ว',
  });
}
