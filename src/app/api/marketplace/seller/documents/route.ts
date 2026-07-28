import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

const TYPES = new Set([
  'store_logo',
  'store_cover',
  'identity_card',
  'bank_book',
  'company_certificate',
  'vat_certificate',
]);

export async function POST(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const formData = await request.formData();
  const documentType = String(formData.get('documentType') ?? '');
  const file = formData.get('file');
  if (!TYPES.has(documentType) || !(file instanceof File)) {
    return NextResponse.json({ message: 'ประเภทเอกสารหรือไฟล์ไม่ถูกต้อง' }, { status: 400 });
  }
  const isAsset = ['store_logo', 'store_cover'].includes(documentType);
  const accepted = isAsset
    ? ['image/jpeg', 'image/png', 'image/webp']
    : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const maxSize = isAsset ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
  if (!accepted.includes(file.type) || file.size > maxSize) {
    return NextResponse.json(
      { message: `ไฟล์ไม่ถูกต้องหรือมีขนาดเกิน ${isAsset ? 5 : 10} MB` },
      { status: 400 }
    );
  }
  const { data: seller } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('id, status')
    .eq('owner_id', caller.sub)
    .maybeSingle();
  if (!seller) {
    return NextResponse.json({ message: 'กรุณาบันทึกข้อมูลร้านก่อนอัปโหลดไฟล์' }, { status: 409 });
  }
  if (seller.status === 'suspended') {
    return NextResponse.json({ message: 'ร้านถูกระงับการใช้งาน' }, { status: 403 });
  }

  const bucket = isAsset ? 'marketplace-seller-assets' : 'marketplace-seller-documents';
  const extension =
    file.type === 'application/pdf'
      ? 'pdf'
      : file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'jpg';
  const path = `${seller.id}/${documentType}-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, await file.arrayBuffer(), { contentType: file.type });
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
        mime_type: file.type,
        file_size: file.size,
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
  if (previous) {
    await supabaseAdmin.storage.from(previous.storage_bucket).remove([previous.storage_path]);
  }

  let url: string | null = null;
  if (isAsset) {
    url = supabaseAdmin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    await supabaseAdmin
      .from('marketplace_sellers')
      .update({
        [documentType === 'store_logo' ? 'logo_url' : 'cover_url']: url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', seller.id);
  } else {
    url = (await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 10 * 60)).data?.signedUrl ?? null;
  }
  return NextResponse.json({ document: { ...document, url } });
}
