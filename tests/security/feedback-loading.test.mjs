import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const rows = Array.from({ length: 65 }, (_, index) => ({
  id: String(index), reporter_id: index < 45 ? 'self' : 'other',
  status: index % 2 === 0 ? 'new' : 'resolved', category: index % 3 === 0 ? 'bug' : 'general',
}));
function route({ role = 'marketplace_user', authorized = true, error = null } = {}) {
  let reads = 0;
  const database = { from: table => {
    assert.equal(table, 'marketplace_feedback');
    reads++;
    let filtered = rows;
    let range;
    let head = false;
    const query = {
      select: (_, options) => { head = options?.head ?? false; return query; },
      eq: (key, value) => { filtered = filtered.filter(row => row[key] === value); return query; },
      in: (key, values) => { filtered = filtered.filter(row => values.includes(row[key])); return query; },
      order: () => query,
      range: (from, to) => { range = [from, to]; return query; },
      then: resolve => resolve({ data: head ? null : range ? filtered.slice(range[0], range[1] + 1) : filtered, count: filtered.length, error }),
    };
    return query;
  } };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/auth-token': { requireAuthenticated: () => authorized ? { sub: 'self', role } : null },
    'src/lib/supabase-admin': { supabaseAdmin: database },
    'src/lib/request-security': {},
  };
  const exports = {};
  const source = readFileSync(new URL('../../src/app/api/marketplace/feedback/route.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, require: name => { assert.ok(mocks[name], name); return mocks[name]; },
  });
  return { ...exports, reads: () => reads };
}

test('feedback pages contain at most 20 own records and correct totals', async () => {
  const api = route();
  const result = await api.GET({ url: 'https://example.test/feedback?page=2' });
  assert.equal(result.status, 200);
  assert.equal(result.body.feedback.length, 20);
  assert.equal(result.body.feedback[0].id, '20');
  assert.ok(result.body.feedback.every(row => row.reporter_id === 'self'));
  assert.equal(result.body.pagination.total, 45);
  assert.equal(result.body.pagination.totalPages, 3);
  assert.equal(api.reads(), 1);
});

test('admin filters run before pagination and global counters remain accurate', async () => {
  const result = await route({ role: 'master_admin' }).GET({ url: 'https://example.test/feedback?status=new&category=bug' });
  const matching = rows.filter(row => row.status === 'new' && row.category === 'bug');
  assert.equal(result.body.feedback.length, matching.length);
  assert.equal(result.body.pagination.total, matching.length);
  assert.ok(result.body.feedback.every(row => row.status === 'new' && row.category === 'bug'));
  assert.equal(result.body.counts.all, 65);
  assert.equal(result.body.counts.pending, rows.filter(row => row.status === 'new').length);
});

test('unauthorized requests and database failures are handled', async () => {
  const unauthorized = route({ authorized: false });
  assert.equal((await unauthorized.GET({})).status, 401);
  assert.equal(unauthorized.reads(), 0);
  assert.equal((await route({ error: { message: 'unavailable' } }).GET({ url: 'https://example.test/feedback' })).status, 500);
});
