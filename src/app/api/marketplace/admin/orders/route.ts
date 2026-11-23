import { z } from 'zod';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireRole, isActiveTokenAccount } from 'src/lib/auth-token';

import { orderStatus, adminOrdersPageSize } from 'src/sections/marketplace/admin/order-list';

const filtersSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(0)
    .max(Math.floor(2_147_483_647 / adminOrdersPageSize) - 1),
  status: z.string().refine((status) => status === '' || Object.hasOwn(orderStatus, status)),
  id: z.union([z.uuid(), z.literal('')]),
});

export async function GET(request: Request) {
  const caller = requireRole(request, ['master_admin']);
  if (!caller || !(await isActiveTokenAccount(caller))) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์ดูคำสั่งซื้อทั้งหมด' }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const filters = filtersSchema.safeParse({
    page: params.get('page') ?? '0',
    status: params.get('status') ?? '',
    id: params.get('id') ?? '',
  });
  if (!filters.success) {
    return NextResponse.json({ message: 'ตัวกรองคำสั่งซื้อไม่ถูกต้อง' }, { status: 400 });
  }

  const { page, status, id } = filters.data;
  const offset = page * adminOrdersPageSize;
  let query = supabaseAdmin
    .from('marketplace_orders')
    .select(
      'id, status, created_at, paid_at, total, currency, seller:marketplace_sellers(display_name), payment_session:marketplace_payment_sessions(status, payment_method, rejection_reason), items:marketplace_order_items(id, title, quantity)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + adminOrdersPageSize - 1);

  if (status) query = query.eq('status', status);
  if (id) query = query.eq('id', id);

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ message: 'โหลดคำสั่งซื้อไม่สำเร็จ' }, { status: 500 });
  }

  return NextResponse.json(
    { orders: data ?? [], total: count ?? 0 },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
