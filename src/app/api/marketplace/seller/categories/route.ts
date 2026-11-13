import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';

import { SellerCategorySchema } from 'src/sections/marketplace/shared/seller-category-schema';

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  if (
    !(await isActionAllowed({
      request,
      action: 'seller-category-create',
      subject: caller.sub,
      maxAttempts: 20,
      windowSeconds: 600,
    }))
  ) {
    return NextResponse.json(
      { message: 'เพิ่มหมวดหมู่บ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
      { status: 429 }
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
  const validation = SellerCategorySchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ message: 'ชื่อหมวดหมู่ต้องมี 2–80 ตัวอักษร' }, { status: 400 });
  }
  const { name } = validation.data;
  const { data, error } = await supabaseAdmin.rpc('marketplace_create_seller_category', {
    p_user_id: caller.sub,
    p_name: name,
  });
  if (error) {
    const status = error.code === '42501' ? 403 : error.code === '23514' ? 409 : 500;
    return NextResponse.json(
      {
        message: status === 500 ? 'ยังไม่สามารถเพิ่มหมวดหมู่ได้ กรุณาติดต่อผู้ดูแล' : error.message,
      },
      { status }
    );
  }
  return NextResponse.json(data);
}
