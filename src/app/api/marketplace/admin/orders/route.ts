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
  search: z.string().trim().max(100),
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
    search: params.get('search') ?? '',
  });
  if (!filters.success) {
    return NextResponse.json({ message: 'ตัวกรองคำสั่งซื้อไม่ถูกต้อง' }, { status: 400 });
  }

  const { page, status, id, search } = filters.data;
  const offset = page * adminOrdersPageSize;
  let searchResult: { ids: string[]; total: number } | undefined;
  if (search) {
    const { data, error } = await supabaseAdmin.rpc('search_marketplace_admin_orders', {
      p_search: search,
      p_status: status || null,
      p_order_id: id || null,
      p_offset: offset,
    });
    if (error || !data) {
      return NextResponse.json(
        { message: 'ค้นหาคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่' },
        { status: 500 }
      );
    }
    searchResult = data;
    if (searchResult && !searchResult.ids.length) {
      return NextResponse.json(
        { orders: [], total: searchResult.total },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    }
  }

  let query = supabaseAdmin
    .from('marketplace_orders')
    .select(
      'id, buyer_id, status, created_at, paid_at, total, currency, seller:marketplace_sellers(display_name), payment_session:marketplace_payment_sessions(status, payment_method, rejection_reason), items:marketplace_order_items(id, title, quantity)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  query = searchResult
    ? query.in('id', searchResult.ids)
    : query.range(offset, offset + adminOrdersPageSize - 1);

  if (status) query = query.eq('status', status);
  if (id) query = query.eq('id', id);

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ message: 'โหลดคำสั่งซื้อไม่สำเร็จ' }, { status: 500 });
  }

  const orders = data ?? [];
  const buyerIds = [...new Set(orders.map((order) => order.buyer_id))];
  const buyerNames = new Map<string, string>();
  if (buyerIds.length) {
    const [marketplaceUsers, appUsers] = await Promise.all([
      supabaseAdmin
        .from('marketplace_users')
        .select('id, display_name, first_name, last_name, username')
        .in('id', buyerIds),
      supabaseAdmin
        .from('app_users')
        .select('id, first_name, last_name, username')
        .in('id', buyerIds),
    ]);
    if (marketplaceUsers.error || appUsers.error) {
      return NextResponse.json(
        { message: 'โหลดชื่อผู้ซื้อไม่สำเร็จ กรุณาลองใหม่' },
        { status: 500 }
      );
    }
    for (const user of appUsers.data ?? []) {
      const name =
        `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username?.trim();
      if (name) buyerNames.set(user.id, name);
    }
    for (const user of marketplaceUsers.data ?? []) {
      const name =
        user.display_name?.trim() ||
        `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() ||
        user.username?.trim();
      if (name) buyerNames.set(user.id, name);
    }
  }

  return NextResponse.json(
    {
      orders: orders.map(({ buyer_id, ...order }) => ({
        ...order,
        buyer_name: buyerNames.get(buyer_id) ?? null,
        buyer_reference: buyer_id.slice(0, 8).toUpperCase(),
      })),
      total: searchResult?.total ?? count ?? 0,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
