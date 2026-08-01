import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import { optimizeUploadedImage } from 'src/lib/server-image-optimizer';

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
    .select('id, seller_id, storage_bucket, storage_path')
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

  if (document.storage_bucket === 'marketplace-seller-assets') {
    const publicUrl = supabaseAdmin.storage
      .from(document.storage_bucket)
      .getPublicUrl(document.storage_path).data.publicUrl;
    return NextResponse.redirect(publicUrl, 307);
  }

  const { data: signed, error: signedError } = await supabaseAdmin.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 60);
  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ message: 'สร้างลิงก์ดูเอกสารไม่สำเร็จ' }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl, 307);
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
  const optimizedImage =
    file.type === 'application/pdf'
      ? null
      : await optimizeUploadedImage(file, {
          preset: isAsset ? 'content' : 'document',
          output: isAsset ? 'webp' : 'original',
        });
  const uploadData = optimizedImage?.data ?? fileBytes;
  const storedContentType = optimizedImage?.contentType ?? file.type;
  const storedSize = optimizedImage?.size ?? file.size;
  const extension = optimizedImage?.extension ?? 'pdf';
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
        updated_at: new Date().toISOString(),
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
    const { error: updateSellerError } = await supabaseAdmin
      .from('marketplace_sellers')
      .update(
        seller.status === 'active'
          ? {
              pending_profile_data: {
                ...((seller.pending_profile_data ?? {}) as Record<string, unknown>),
                [assetField]: url,
              },
              profile_review_status: 'draft',
              profile_rejection_reason: null,
              updated_at: new Date().toISOString(),
            }
          : { [assetField]: url, updated_at: new Date().toISOString() }
      )
      .eq('id', seller.id);
    if (updateSellerError) {
      return NextResponse.json({ message: updateSellerError.message }, { status: 500 });
    }
  } else {
    url = `/api/marketplace/seller/documents?documentId=${encodeURIComponent(document.id)}`;
  }
  return NextResponse.json({ document: { ...document, url } });
}
