import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  if (!requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูข้อมูลร้านค้า' }, { status: 403 });
  }

  const { id } = await params;
  const { data: seller, error } = await supabaseAdmin
    .from('marketplace_sellers')
    .select('*')
    .eq('id', id)
    .neq('owner_role', 'master_admin')
    .maybeSingle();
  if (error || !seller) {
    return NextResponse.json(
      { message: error?.message ?? 'ไม่พบคำขอเปิดร้าน' },
      { status: error ? 500 : 404 }
    );
  }

  const [
    { data: documents, error: documentsError },
    { data: payoutAccount, error: payoutError },
  ] = await Promise.all([
      supabaseAdmin
        .from('marketplace_seller_documents')
        .select('*')
        .eq('seller_id', seller.id)
        .order('uploaded_at', { ascending: true }),
      supabaseAdmin
        .from('marketplace_seller_payout_accounts')
        .select('*')
        .eq('seller_id', seller.id)
        .maybeSingle(),
    ]);
  if (documentsError || payoutError) {
    return NextResponse.json(
      { message: documentsError?.message ?? payoutError?.message },
      { status: 500 }
    );
  }

  const signedDocuments = await Promise.all(
    (documents ?? []).map(async (document) => {
      if (document.storage_bucket === 'marketplace-seller-assets') {
        const publicUrl = supabaseAdmin.storage
          .from(document.storage_bucket)
          .getPublicUrl(document.storage_path).data.publicUrl;
        return { ...document, url: publicUrl };
      }
      const signed = await supabaseAdmin.storage
        .from(document.storage_bucket)
        .createSignedUrl(document.storage_path, 15 * 60);
      return { ...document, url: signed.data?.signedUrl ?? null };
    })
  );

  return NextResponse.json({
    seller: {
      ...seller,
      documents: signedDocuments,
      payout_account: payoutAccount,
    },
  });
}
