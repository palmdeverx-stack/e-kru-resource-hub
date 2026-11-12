import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import ts from 'typescript';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

function moduleFrom(path, mocks, globals = {}) {
  const exports = {};
  const source = readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText, { exports, URL, Buffer, File, Blob, crypto: { randomUUID },
    process: { env: { AUTH_JWT_SECRET: 'test-secret-not-production' } },
    require: name => { assert.ok(name in mocks, name); return mocks[name]; }, ...globals });
  return exports;
}
const policy = moduleFrom('src/sections/marketplace/shared/product-upload-policy.ts', {});
const tickets = moduleFrom('src/sections/marketplace/seller/server/product-upload-ticket.ts', {
  'server-only': {}, jsonwebtoken: { default: jwt }, zod: { z },
});
const productId = '00000000-0000-4000-8000-000000000001';

function setup({ authorized = true, scanRejected = false, insertError = false } = {}) {
  let userId = 'owner';
  const rows = [];
  const objects = new Map();
  let downloads = 0;
  const storage = {
    createSignedUploadUrl: async path => ({ data: { signedUrl: 'https://storage.test/' + path }, error: null }),
    download: async path => { downloads++; return { data: objects.get(path), error: null }; },
    upload: async (path, bytes, { contentType }) => { objects.set(path, new Blob([bytes], { type: contentType })); return { error: null }; },
    remove: async paths => { paths.forEach(path => objects.delete(path)); return { error: null }; },
  };
  const db = { storage: { from: () => storage }, from: () => {
    const filters = [];
    let countOnly = false;
    let ordered = false;
    const result = () => {
      let data = rows.filter(row => filters.every(([key, value]) => row[key] === value));
      if (ordered) data = data.toSorted((a, b) => b.position - a.position);
      return { data, count: data.length, error: null };
    };
    const query = {
      select: (_, options) => { countOnly = options?.head; return query; },
      eq: (key, value) => { filters.push([key, value]); return query; },
      order: () => { ordered = true; return query; }, limit: () => query,
      maybeSingle: async () => ({ ...result(), data: result().data[0] ?? null }),
      insert: async row => { if (insertError) return { error: { message: 'database unavailable' } }; rows.push(row); return { error: null }; },
      then: resolve => resolve({ ...result(), data: countOnly ? null : result().data }),
    };
    return query;
  } };
  const api = moduleFrom('src/app/api/marketplace/seller/products/[id]/files/direct-upload/route.ts', {
    zod: { z }, 'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/supabase-admin': { supabaseAdmin: db },
    'src/lib/auth-token': { requireAuthenticated: () => authorized ? { sub: userId, role: 'marketplace_user' } : null },
    'src/lib/auth-rate-limit': { isActionAllowed: async () => true },
    'src/lib/request-security': { rejectCrossSiteMutation: () => null },
    'src/lib/server-image-optimizer': { optimizeUploadedImage: () => { throw new Error('unexpected image'); } },
    'src/lib/malware-scanner': { scanBufferForMalware: async () => ({ status: scanRejected ? 'rejected' : 'safe', engine: 'clamav', detail: 'test result' }), MalwareScannerUnavailableError: class extends Error {} },
    'src/sections/marketplace/seller/server/product-media': { refreshedFiles: async () => rows },
    'src/sections/marketplace/seller/server/owned-seller': { ownedSellerId: async () => ({ id: 'seller', status: 'active' }), ownedProduct: async () => ({ id: productId }) },
    'src/sections/marketplace/seller/server/product-upload-ticket': tickets,
    'src/sections/marketplace/shared/product-upload-policy': policy,
  });
  const post = body => api.POST({ json: async () => body }, { params: Promise.resolve({ id: productId }) });
  const init = (size = 1024, isPreview = false) => post({ action: 'init', name: 'sample.pdf', mime: 'application/pdf', size, isPreview });
  return { rows, objects, post, init, setUser: value => { userId = value; }, downloads: () => downloads };
}

test('direct upload validates authentication, 10 MB limit, MIME, and quotas before signing', async () => {
  assert.equal((await setup({ authorized: false }).init()).status, 401);
  const api = setup();
  assert.equal((await api.init(policy.PRODUCT_FILE_MAX_BYTES + 1)).status, 400);
  assert.equal((await api.post({ action: 'init', name: 'bad.html', mime: 'text/html', size: 1, isPreview: false })).status, 400);
  const fullSize = await api.init(policy.PRODUCT_FILE_MAX_BYTES);
  assert.equal(fullSize.status, 200);
  api.rows.push({ id: 'existing', product_id: productId, is_preview: true });
  assert.equal((await api.init(1024, true)).status, 400);
});

test('completion binds the signed ticket to its owner and validates actual uploaded bytes', async () => {
  const api = setup();
  const signed = await api.init(1024);
  const ticket = tickets.verifyUploadTicket(signed.body.ticket);
  api.objects.set(ticket.path, new Blob([Buffer.alloc(1025)], { type: 'application/pdf' }));
  api.setUser('another-user');
  assert.equal((await api.post({ action: 'complete', ticket: signed.body.ticket })).status, 403);
  api.setUser('owner');
  assert.equal((await api.post({ action: 'complete', ticket: signed.body.ticket + 'tampered' })).status, 403);
  assert.equal((await api.post({ action: 'complete', ticket: signed.body.ticket })).status, 422);
  assert.equal(api.rows.length, 0);
  assert.equal(api.objects.has(ticket.path), false);
});

test('verified files commit once, repeated completion is idempotent, and malware never commits', async () => {
  for (const rejected of [false, true]) {
    const api = setup({ scanRejected: rejected });
    const signed = await api.init();
    const ticket = tickets.verifyUploadTicket(signed.body.ticket);
    api.objects.set(ticket.path, new Blob([Buffer.alloc(ticket.size)], { type: ticket.mime }));
    const result = await api.post({ action: 'complete', ticket: signed.body.ticket });
    assert.equal(result.status, rejected ? 422 : 200);
    assert.equal(api.rows.length, rejected ? 0 : 1);
    if (!rejected) {
      assert.equal((await api.post({ action: 'complete', ticket: signed.body.ticket })).status, 200);
      assert.equal(api.downloads(), 1);
      assert.equal(api.rows[0].scan_status, 'safe');
    }
    assert.equal(api.objects.has(ticket.path), false);
  }
});

test('database failure retains staged bytes for retry and cleans up the uncommitted final object', async () => {
  const api = setup({ insertError: true });
  const signed = await api.init();
  const ticket = tickets.verifyUploadTicket(signed.body.ticket);
  api.objects.set(ticket.path, new Blob([Buffer.alloc(ticket.size)], { type: ticket.mime }));
  assert.equal((await api.post({ action: 'complete', ticket: signed.body.ticket })).status, 500);
  assert.deepEqual([...api.objects.keys()], [ticket.path]);
  assert.equal(api.rows.length, 0);
});

test('the client sends file bytes only to Storage and retries finalization without re-uploading', async () => {
  const apiBodies = [];
  let storageUploads = 0;
  let completions = 0;
  const file = new File([Buffer.alloc(policy.PRODUCT_FILE_MAX_BYTES)], 'full.pdf', { type: 'application/pdf' });
  const api = moduleFrom('src/sections/marketplace/shared/api.ts', {
    'src/lib/api-fetch': { apiFetch: async (_, options) => {
      const body = JSON.parse(options.body);
      apiBodies.push(body);
      assert.equal('files' in body, false);
      if (body.action === 'init') return { ok: true, status: 200, json: async () => ({ signedUrl: 'https://storage.test/upload?token=private', ticket: 'signed-ticket' }) };
      completions++;
      return completions === 1
        ? { ok: false, status: 500, json: async () => ({ message: 'temporary completion failure' }) }
        : { ok: true, status: 200, json: async () => ({ files: [{ id: 'completed' }] }) };
    } },
    './product-upload-policy': policy,
  }, { fetch: async (url, options) => {
    assert.ok(url.startsWith('https://storage.test/'));
    assert.equal(options.body, file);
    assert.equal(options.credentials, 'omit');
    storageUploads++;
    return { ok: true };
  } });
  await assert.rejects(api.uploadProductFiles(productId, [file]), /temporary completion failure/);
  const result = await api.uploadProductFiles(productId, [file]);
  assert.equal(result.files[0].id, 'completed');
  assert.equal(storageUploads, 1);
  assert.deepEqual(apiBodies.map(body => body.action), ['init', 'complete', 'complete']);
  await assert.rejects(api.uploadProductFiles(productId, [new File([Buffer.alloc(policy.PRODUCT_FILE_MAX_BYTES + 1)], 'too-large.pdf')]), /10 MB/);
});


test('signed downloads use the original uploaded filename instead of the storage UUID', async () => {
  const requested = [];
  const media = moduleFrom('src/sections/marketplace/seller/server/product-media.ts', {
    'server-only': {},
    'src/lib/supabase-admin': { supabaseAdmin: { storage: { from: () => ({
      createSignedUrl: async (path, ttl, options) => { requested.push({ path, ttl, options }); return { data: { signedUrl: 'https://storage.test/signed' } }; },
    }) } } },
    '../../admin/server/platform-settings': { getPublicPlatformSettings: async () => null },
  });
  const filename = 'ใบงาน เศษส่วน ป.4.pdf';
  const result = await media.withMediaUrls({ files: [{ id: 'file', file_name: filename,
    storage_bucket: 'marketplace-product-files', storage_path: 'product/file-uuid.pdf', scan_status: 'safe' }], images: [] });
  assert.equal(result.files[0].file_name, filename);
  assert.equal(requested[0].options.download, filename);
  assert.equal(requested[0].path, 'product/file-uuid.pdf');
});
