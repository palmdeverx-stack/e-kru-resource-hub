import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const { id } = await params;
  const { data: tag, error } = await supabaseAdmin
    .from('marketplace_tags')
    .select('id, created_by, first_used_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !tag) {
    return NextResponse.json({ message: 'ไม่พบแท็ก' }, { status: error ? 500 : 404 });
  }
  if (tag.created_by !== caller.sub) {
    return NextResponse.json({ message: 'ลบได้เฉพาะแท็กที่คุณสร้างเอง' }, { status: 403 });
  }
  if (tag.first_used_at) {
    return NextResponse.json(
      { message: 'ลบไม่ได้ เนื่องจากแท็กนี้เคยถูกใช้กับสินค้าแล้ว' },
      { status: 409 }
    );
  }

  const { count, error: usageError } = await supabaseAdmin
    .from('marketplace_product_tags')
    .select('*', { count: 'exact', head: true })
    .eq('tag_id', id);
  if (usageError) return NextResponse.json({ message: usageError.message }, { status: 500 });
  if (count) {
    return NextResponse.json(
      { message: 'ลบไม่ได้ เนื่องจากมีสินค้าใช้แท็กนี้อยู่' },
      { status: 409 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from('marketplace_tags')
    .delete()
    .eq('id', id)
    .eq('created_by', caller.sub);
  if (deleteError) return NextResponse.json({ message: deleteError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
