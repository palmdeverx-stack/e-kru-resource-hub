import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';

function loadModule(path, mocks = {}) {
  const exports = {};
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(outputText, {
    exports,
    URL,
    require: (name) => {
      assert.ok(mocks[name], name);
      return mocks[name];
    },
  });
  return exports;
}

const paymentMessage = loadModule('../../src/sections/marketplace/shared/payment-message.ts');
const orderList = loadModule('../../src/sections/marketplace/admin/order-list.ts', {
  '../shared/payment-message': paymentMessage,
});
const orderId = '7c1cde16-91cd-4550-92f6-59ab923952f7';

function setup({
  role = 'master_admin',
  active = true,
  dbError = null,
  buyerError = null,
  searchResult = null,
  rows = [{ id: orderId, status: 'cancelled', buyer_id: 'marketplace-buyer' }],
} = {}) {
  const calls = [];
  const query = {
    then: (resolve) => resolve({ data: rows, count: 26, error: dbError }),
  };
  for (const method of ['select', 'order', 'range', 'eq', 'in']) {
    query[method] = (...args) => {
      calls.push([method, ...args]);
      return query;
    };
  }
  const { GET } = loadModule('../../src/app/api/marketplace/admin/orders/route.ts', {
    zod: { z },
    'next/server': {
      NextResponse: { json: (body, options = {}) => ({ status: 200, ...options, body }) },
    },
    'src/lib/auth-token': {
      requireRole: (_, roles) => (roles.includes(role) ? { sub: 'admin', role } : null),
      isActiveTokenAccount: async () => active,
    },
    'src/lib/supabase-admin': {
      supabaseAdmin: {
        rpc: async (name, args) => {
          calls.push([name, args]);
          return { data: searchResult, error: null };
        },
        from: (table) => {
          calls.push(['from', table]);
          if (table === 'marketplace_orders') return query;
          return {
            select: (columns) => ({
              in: async (key, ids) => {
                calls.push(['buyer lookup', table, columns, key, ...ids]);
                return table === 'marketplace_users'
                  ? {
                      data: [{ id: 'marketplace-buyer', display_name: 'ครูออม' }],
                      error: buyerError,
                    }
                  : {
                      data: [{ id: 'app-user-123', first_name: 'สมใจ', last_name: 'ใจดี' }],
                      error: null,
                    };
              },
            }),
          };
        },
      },
    },
    'src/sections/marketplace/admin/order-list': orderList,
  });
  return {
    calls,
    get: (queryString = '') => GET({ url: `https://example.test/api/orders${queryString}` }),
  };
}

test('order data is restricted to active Super Admin sessions', async () => {
  for (const config of [{ role: null }, { role: 'marketplace_admin' }, { active: false }]) {
    const api = setup(config);
    assert.equal((await api.get()).status, 403);
    assert.deepEqual(api.calls, []);
  }
});

test('validates filters before reading orders', async () => {
  const api = setup();
  for (const params of ['?status=unknown', '?page=-1', '?page=2.5', '?id=invalid']) {
    assert.equal((await api.get(params)).status, 400);
  }
  assert.deepEqual(api.calls, []);
});

test('returns bounded results and applies status and order ID filters', async () => {
  const api = setup();
  const response = await api.get(`?page=1&status=cancelled&id=${orderId}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.orders[0].id, orderId);
  assert.equal(response.body.orders[0].buyer_name, 'ครูออม');
  assert.equal(response.body.orders[0].buyer_id, undefined);
  assert.equal(response.body.total, 26);
  assert.equal(response.headers['Cache-Control'], 'private, no-store');
  assert.deepEqual(api.calls[0], ['from', 'marketplace_orders']);
  assert.deepEqual(
    api.calls.slice(2, 7).map(([method, key, value]) => [method, key, value?.ascending ?? value]),
    [
      ['order', 'created_at', false],
      ['order', 'id', false],
      ['range', 25, 49],
      ['eq', 'status', 'cancelled'],
      ['eq', 'id', orderId],
    ]
  );
});

test('uses filtered search pagination before reading order details', async () => {
  const api = setup({ searchResult: { ids: [orderId], total: 51 } });
  const response = await api.get(`?page=1&status=cancelled&search=${encodeURIComponent('ครูออม')}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.total, 51);
  assert.equal(api.calls[0][0], 'search_marketplace_admin_orders');
  assert.deepEqual(
    { ...api.calls[0][1] },
    {
      p_search: 'ครูออม',
      p_status: 'cancelled',
      p_order_id: null,
      p_offset: 25,
    }
  );
  assert.ok(
    api.calls.some(([method, key, ids]) => method === 'in' && key === 'id' && ids[0] === orderId)
  );
  assert.ok(!api.calls.some(([method]) => method === 'range'));
});

test('looks up both account types once and retains a reference for missing buyers', async () => {
  const api = setup({
    rows: ['marketplace-buyer', 'app-user-123', 'missing-user', 'app-user-123'].map(
      (buyer_id, id) => ({
        id,
        buyer_id,
      })
    ),
  });
  const { body } = await api.get();
  assert.equal(body.orders[1].buyer_name, 'สมใจ ใจดี');
  assert.equal(body.orders[2].buyer_name, null);
  assert.equal(body.orders[2].buyer_reference, 'MISSING-');
  const lookups = api.calls.filter(([method]) => method === 'buyer lookup');
  assert.deepEqual(
    lookups.map((lookup) => lookup.slice(1, 2)),
    [['marketplace_users'], ['app_users']]
  );
  for (const lookup of lookups) {
    assert.deepEqual(Array.from(lookup.slice(4)), [
      'marketplace-buyer',
      'app-user-123',
      'missing-user',
    ]);
  }
});

test('returns a generic error when the query fails', async () => {
  const api = setup({ dbError: { message: 'internal database details' } });
  const response = await api.get();
  assert.equal(response.status, 500);
  assert.equal(response.body.message, 'โหลดคำสั่งซื้อไม่สำเร็จ');
  const buyerApi = setup({ buyerError: { message: 'internal database details' } });
  const buyerResponse = await buyerApi.get();
  assert.equal(buyerResponse.status, 500);
  assert.equal(buyerResponse.body.message, 'โหลดชื่อผู้ซื้อไม่สำเร็จ กรุณาลองใหม่');
});

test('shows recorded rejection or cancellation reasons and handles older orders', () => {
  const { getOrderOutcome } = orderList;
  assert.equal(
    getOrderOutcome({
      status: 'cancelled',
      payment_session: { rejection_reason: 'ผู้ซื้อยกเลิกการชำระเงิน' },
    }),
    'ผู้ซื้อยกเลิกการชำระเงิน'
  );
  assert.equal(
    getOrderOutcome({
      status: 'payment_rejected',
      payment_session: { rejection_reason: 'ยอดเงินไม่ตรง' },
    }),
    'ยอดเงินไม่ตรง'
  );
  assert.equal(
    getOrderOutcome({
      status: 'cancelled',
      payment_session: null,
    }),
    'ไม่มีบันทึกเหตุผลสำหรับคำสั่งซื้อนี้'
  );
  assert.equal(
    getOrderOutcome({
      status: 'paid',
      payment_session: { payment_method: 'free', status: 'verified' },
    }),
    'ระบบยืนยันคำสั่งซื้อฟรี'
  );
});

test('displays Thai explanations for Stripe errors saved on existing orders', () => {
  const { getOrderOutcome } = orderList;
  const describe = (reason) =>
    getOrderOutcome({
      status: 'payment_rejected',
      payment_session: { payment_method: 'stripe', rejection_reason: reason },
    });

  assert.equal(
    describe(
      'The PromptPay payment attempt of this PaymentIntent has expired. You can provide payment_method_data or a new PaymentMethod to attempt to fulfill this PaymentIntent again.'
    ),
    'รายการชำระเงินผ่านพร้อมเพย์หมดอายุ กรุณาเริ่มชำระเงินใหม่'
  );
  assert.equal(
    describe('Your card was declined.'),
    'บัตรถูกปฏิเสธ กรุณาตรวจสอบกับธนาคารผู้ออกบัตร'
  );
  assert.equal(describe('Your card has insufficient funds.'), 'ยอดเงินคงเหลือไม่เพียงพอ');
  assert.equal(
    describe('An unexpected error occurred.'),
    'ชำระเงินไม่สำเร็จ กรุณาตรวจสอบข้อมูลการชำระเงินแล้วลองใหม่'
  );
  assert.equal(
    describe('ไม่ได้ชำระเงินภายในเวลาที่ Stripe กำหนด'),
    'ไม่ได้ชำระเงินภายในเวลาที่ Stripe กำหนด'
  );
});

test('buyer payment API returns a plain-language reason and keeps ownership filtering', async () => {
  const filters = [];
  const session = {
    payment_method: 'stripe',
    rejection_reason: 'The PromptPay payment attempt of this PaymentIntent has expired.',
  };
  const query = {
    select: () => query,
    eq: (key, value) => {
      filters.push([key, value]);
      return query;
    },
    maybeSingle: async () => ({ data: session, error: null }),
  };
  const { GET } = loadModule('../../src/app/api/marketplace/payments/[id]/route.ts', {
    'next/server': { NextResponse: { json: (body) => body } },
    'src/lib/auth-token': { requireAuthenticated: () => ({ sub: 'buyer' }) },
    'src/lib/supabase-admin': { supabaseAdmin: { from: () => query } },
    'src/sections/marketplace/checkout/server/promptpay': {},
    'src/sections/marketplace/shared/payment-message': paymentMessage,
  });

  const result = await GET({}, { params: Promise.resolve({ id: 'payment' }) });
  assert.deepEqual(filters, [
    ['id', 'payment'],
    ['buyer_id', 'buyer'],
  ]);
  assert.equal(
    result.paymentSession.rejection_reason,
    'รายการชำระเงินผ่านพร้อมเพย์หมดอายุ กรุณาเริ่มชำระเงินใหม่'
  );
  assert.match(session.rejection_reason, /PaymentIntent/);
});

test('Super Admin detail reports payment, refund and each item’s current delivery evidence', async () => {
  const order = {
    id: orderId,
    status: 'paid',
    created_at: '2026-11-20T08:00:00Z',
    paid_at: '2026-11-20T09:00:00Z',
    payment_session_id: 'payment',
    payment: { payment_method: 'promptpay', submitted_at: '2026-11-20T08:30:00Z' },
    shipment: { status: 'shipping', booked_at: '2026-11-20T10:00:00Z' },
    items: [
      { id: 'missing', title: 'สิทธิ์ยังไม่เปิด', product: { resource_type: 'feature_unlock' } },
      {
        id: 'license',
        title: 'สิทธิ์โรงเรียน',
        school: { status: 'active', starts_at: '2026-11-20T09:00:00Z' },
      },
      { id: 'digital', title: 'ใบงาน', product: { files: [{ scan_status: 'safe' }] } },
      { id: 'scan', title: 'ไฟล์ใหม่', product: { files: [{ scan_status: 'pending_scan' }] } },
      { id: 'physical', title: 'หนังสือ', product: { resource_type: 'physical' } },
    ],
  };
  const tables = {
    marketplace_orders: order,
    security_audit_logs: [
      {
        action: 'marketplace.payment_reject',
        actor_username: 'reviewer',
        metadata: { reason: 'ยอดไม่ตรง' },
        created_at: '2026-11-20T08:40:00Z',
      },
    ],
    marketplace_stripe_refund_totals: [
      { refunded_amount: 100, charge_amount: 200, updated_at: '2026-11-20T11:00:00Z' },
    ],
  };
  let active = false;
  const reads = [];
  const { GET } = loadModule('../../src/app/api/marketplace/admin/orders/[id]/route.ts', {
    zod: { z },
    'next/server': {
      NextResponse: { json: (body, options = {}) => ({ status: 200, ...options, body }) },
    },
    'src/lib/auth-token': {
      requireRole: () => ({ sub: 'admin' }),
      isActiveTokenAccount: async () => active,
    },
    'src/lib/supabase-admin': {
      supabaseAdmin: {
        from(table) {
          reads.push(table);
          const result = { data: tables[table], error: null };
          const query = { maybeSingle: async () => result, then: (resolve) => resolve(result) };
          for (const method of ['select', 'eq', 'gt', 'in', 'order', 'limit'])
            query[method] = () => query;
          return query;
        },
      },
    },
    'src/sections/marketplace/shared/payment-message': paymentMessage,
  });
  const context = { params: Promise.resolve({ id: orderId }) };
  assert.equal((await GET({}, context)).status, 403);
  assert.deepEqual(reads, []);
  active = true;
  assert.equal((await GET({}, { params: Promise.resolve({ id: 'invalid' }) })).status, 400);
  assert.deepEqual(reads, []);
  const response = await GET({}, context);
  assert.equal(response.status, 200);
  assert.deepEqual(
    Array.from(response.body.events, (event) => event.label),
    [
      'สร้างคำสั่งซื้อ',
      'แนบสลิป',
      'สลิปไม่ผ่านการตรวจสอบ',
      'ยืนยันการชำระเงิน',
      'จองขนส่งแล้ว',
      'คืนเงินบางส่วนของรายการชำระ',
    ]
  );
  assert.equal(response.body.events[2].detail, 'โดย reviewer · ยอดไม่ตรง');
  assert.deepEqual(
    Array.from(response.body.delivery, (item) => item.status),
    [
      'ชำระแล้ว แต่ไม่พบสิทธิ์ที่เปิดใช้งาน',
      'เปิดสิทธิ์ให้โรงเรียนแล้ว',
      'มีไฟล์ให้ดาวน์โหลด',
      'ไฟล์อยู่ระหว่างตรวจสอบ',
      'กำลังจัดส่ง',
    ]
  );
});
