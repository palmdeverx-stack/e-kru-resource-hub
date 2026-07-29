import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;

  const { data: product } = await supabaseAdmin
    .from('marketplace_products')
    .select('id')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();
  if (!product) return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });

  const { data: previewFiles, error } = await supabaseAdmin
    .from('marketplace_product_files')
    .select('id, storage_bucket, storage_path, file_name, mime_type, position')
    .eq('product_id', id)
    .eq('is_preview', true)
    .order('position');
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const files = await Promise.all(
    (previewFiles ?? []).map(async (file) => {
      const { data } = await supabaseAdmin.storage
        .from(file.storage_bucket)
        .createSignedUrl(file.storage_path, 10 * 60);
      return {
        id: file.id,
        file_name: file.file_name,
        mime_type: file.mime_type,
        position: file.position,
        url: data?.signedUrl ?? null,
      };
    })
  );

  return NextResponse.json({ files });
}
