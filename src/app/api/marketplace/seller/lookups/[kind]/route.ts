import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { SellerLookupSchema } from 'src/sections/marketplace/shared/seller-category-schema';

type Context = { params: Promise<{ kind: string }> };
export async function POST(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const { kind } = await params;
  if (!['grade-levels', 'curricula'].includes(kind))
    return NextResponse.json({ message: 'ไม่พบประเภทรายการ' }, { status: 404 });
  if (
    !(await isActionAllowed({
      request,
      action: 'seller-lookup-create',
      subject: caller.sub,
      maxAttempts: 20,
      windowSeconds: 600,
    }))
  ) {
    return NextResponse.json(
      { message: 'เพิ่มรายการบ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
      { status: 429 }
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
  const validation = SellerLookupSchema.safeParse(body);
  if (!validation.success)
    return NextResponse.json(
      { message: validation.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' },
      { status: 400 }
    );
  const { data, error } = await supabaseAdmin.rpc('marketplace_create_seller_lookup', {
    p_user_id: caller.sub,
    p_kind: kind,
    p_name: validation.data.name,
    p_grade_group: validation.data.gradeGroup,
  });
  if (error) {
    const status = error.code === '42501' ? 403 : error.code === '23514' ? 409 : 500;
    return NextResponse.json(
      { message: status === 500 ? 'ยังไม่สามารถเพิ่มรายการได้ กรุณาติดต่อผู้ดูแล' : error.message },
      { status }
    );
  }
  return NextResponse.json(data);
}
