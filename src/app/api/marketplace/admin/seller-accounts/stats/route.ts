import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';

export async function GET(request: Request) {
  if (!requireRole(request, ['master_admin'])) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูบัญชีร้านค้า' }, { status: 403 });
  }
  const ids = [
    ...new Set((new URL(request.url).searchParams.get('ids') ?? '').split(',').filter(Boolean)),
  ];
  if (
    !ids.length ||
    ids.length > 50 ||
    ids.some((id) => !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id))
  ) {
    return NextResponse.json({ message: 'รหัสร้านค้าไม่ถูกต้อง' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin.rpc('marketplace_seller_account_stats', {
    seller_ids: ids,
  });
  if (error) {
    return NextResponse.json(
      {
        message:
          error.code === '42883'
            ? 'กรุณาอัปเดต Marketplace schema สำหรับสถิติร้านค้า'
            : error.message,
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ stats: data ?? [] });
}
