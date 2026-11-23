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

const orderList = loadModule('../../src/sections/marketplace/admin/order-list.ts');
const orderId = '7c1cde16-91cd-4550-92f6-59ab923952f7';

function setup({ role = 'master_admin', active = true, dbError = null } = {}) {
  const calls = [];
  const rows = [{ id: orderId, status: 'cancelled' }];
  const query = {
    then: (resolve) => resolve({ data: rows, count: 26, error: dbError }),
  };
  for (const method of ['select', 'order', 'range', 'eq']) {
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
        from: (table) => {
          calls.push(['from', table]);
          return query;
        },
      },
    },
    'src/sections/marketplace/admin/order-list': orderList,
  });
  return {
    calls,
    rows,
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
  assert.equal(response.body.orders, api.rows);
  assert.equal(response.body.total, 26);
  assert.equal(response.headers['Cache-Control'], 'private, no-store');
  assert.deepEqual(api.calls[0], ['from', 'marketplace_orders']);
  assert.deepEqual(
    api.calls.slice(2).map(([method, key, value]) => [method, key, value?.ascending ?? value]),
    [
      ['order', 'created_at', false],
      ['order', 'id', false],
      ['range', 25, 49],
      ['eq', 'status', 'cancelled'],
      ['eq', 'id', orderId],
    ]
  );
});

test('returns a generic error when the query fails', async () => {
  const api = setup({ dbError: { message: 'internal database details' } });
  const response = await api.get();
  assert.equal(response.status, 500);
  assert.equal(response.body.message, 'โหลดคำสั่งซื้อไม่สำเร็จ');
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
