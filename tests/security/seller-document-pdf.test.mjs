import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as pdfLib from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import sharp from 'sharp';

function moduleFrom(file, mocks) {
  const exports = {};
  const url = new URL(`../../${file}`, import.meta.url);
  const source = readFileSync(url, 'utf8').replaceAll('import.meta.url', JSON.stringify(url.href));
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, {
    exports, URL, File, Buffer, Uint8Array, TextDecoder, Response, process: { cwd: () => process.cwd() },
    require: name => { assert.ok(mocks[name], name); return mocks[name]; },
  });
  return exports;
}
const uploadPolicy = moduleFrom('src/sections/marketplace/shared/seller-document-upload-policy.ts', {});

const lines = ['เอกสารนี้ใช้สำหรับยืนยันตัวตนผู้ขายในระบบ E-KRU Marketplace เท่านั้น'];
const fontLoader = moduleFrom('src/lib/server-watermark-font.ts', { 'server-only': {}, 'node:path': { join }, 'node:fs/promises': { readFile } });
const { watermarkPdfDocument } = moduleFrom('src/lib/server-document-watermark.ts', {
  'server-only': {}, '@pdf-lib/fontkit': fontkit, 'node:fs/promises': { readFile }, 'pdf-lib': pdfLib,
  './server-watermark-font': fontLoader,
});

const imageOptimizer = moduleFrom('src/lib/server-image-optimizer.ts', { 'server-only': {}, sharp, './server-watermark-font': fontLoader });

function uploadRoute(documentType = 'bank_book', realImages = false, options = {}) {
  let stored;
  let optimization;
  const query = {
    select: () => query, eq: () => query, upsert: () => query, update: () => query, is: () => query,
    maybeSingle: async () => ({ data: options.sellerMissing ? null : { id: options.sellerId ?? 'seller', owner_id: 'owner', owner_role: options.ownerRole ?? 'master_admin', status: options.status ?? 'draft' } }),
    single: async () => ({ data: { id: 'document', mime_type: stored.contentType } }),
  };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/auth-token': { requireAuthenticated: () => options.anonymous ? null : ({ sub: options.userId ?? 'owner', role: options.role ?? 'master_admin' }) },
    'src/lib/request-security': { rejectCrossSiteMutation: () => options.crossSite ? { status: 403 } : null },
    'src/lib/supabase-admin': { supabaseAdmin: {
      from: () => query,
      storage: { from: () => ({ getPublicUrl: path => ({ data: { publicUrl: 'https://storage.example.test/' + path } }), upload: async (path, data, options) => { stored = { path, data, ...options }; return {}; }, remove: async () => ({}) }) },
    } },
    'src/lib/server-image-optimizer': realImages ? imageOptimizer : { optimizeUploadedImage: async (_, options) => { optimization = options; return { data: Buffer.alloc(1.5 * 1024 * 1024), contentType: 'image/webp', extension: 'webp' }; } },
    'src/lib/server-document-watermark': { watermarkPdfDocument },
    'src/lib/document-watermark-copy': { SELLER_DOCUMENT_WATERMARK_LINES: lines },
    'src/sections/marketplace/shared/seller-document-upload-policy': uploadPolicy,
  };
  const api = moduleFrom('src/app/api/marketplace/seller/documents/route.ts', mocks);
  return { POST: (file, preview = false) => api.POST({ url: `https://example.test/documents${preview ? '?preview=1' : ''}`, formData: async () => ({ get: name => name === 'file' ? file : name === 'documentType' ? documentType : name === 'sellerId' ? options.sellerId ?? null : null }) }), stored: () => stored, optimization: () => optimization };
}

test('PDF larger than 1 MB uploads with actual Thai watermark and stays readable', async () => {
  const pdf = await pdfLib.PDFDocument.create();
  pdf.addPage().drawText('Bank book upload test', { x: 60, y: 700 });
  await pdf.attach(randomBytes(1.1 * 1024 * 1024), 'test-data.bin');
  const bytes = await pdf.save();
  assert.ok(bytes.length > 1024 * 1024);
  const api = uploadRoute();
  const response = await api.POST(new File([bytes], 'bank-book.pdf', { type: 'application/pdf' }));
  assert.equal(response.status, 200);
  assert.equal(api.stored().contentType, 'application/pdf');
  assert.equal((await pdfLib.PDFDocument.load(api.stored().data)).getPageCount(), 1);
  writeFileSync('/private/tmp/ekru-pdf-upload-test.pdf', api.stored().data);
});

test('PDF with missing browser MIME type is accepted based on extension and valid PDF content', async () => {
  const pdf = await pdfLib.PDFDocument.create();
  pdf.addPage();
  const response = await uploadRoute().POST(new File([await pdf.save()], 'bank-book.pdf', { type: '' }));
  assert.equal(response.status, 200);
});

test('invalid PDF and source files above 5 MB are rejected', async () => {
  assert.equal((await uploadRoute().POST(new File(['not a pdf'], 'bad.pdf', { type: 'application/pdf' }))).status, 400);
  assert.equal((await uploadRoute().POST(new File([Buffer.alloc(5 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' }))).status, 400);
});

test('verification images are optimized with a 2 MB storage limit', async () => {
  const api = uploadRoute();
  assert.equal((await api.POST(new File(['image'], 'book.jpg', { type: 'image/jpeg' }))).status, 200);
  assert.equal(api.optimization().maxBytes, 2 * 1024 * 1024);
});


test('preview returns actual watermarked PDF bytes without saving any document', async () => {
  const pdf = await pdfLib.PDFDocument.create();
  pdf.addPage();
  const original = await pdf.save();
  const api = uploadRoute();
  const response = await api.POST(new File([original], 'book.pdf', { type: 'application/pdf' }), true);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const result = new Uint8Array(await response.arrayBuffer());
  assert.ok(result.length > original.length);
  assert.equal((await pdfLib.PDFDocument.load(result)).getPageCount(), 1);
  assert.equal(api.stored(), undefined);
});


for (const documentType of ['identity_card', 'company_certificate', 'vat_certificate', 'bank_book']) {
  for (const [extension, mime] of [['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp'], ['pdf', 'application/pdf']]) {
    test(`${documentType}: ${extension} preview and upload process actual bytes with watermark`, async () => {
      let bytes;
      if (extension === 'pdf') {
        const pdf = await pdfLib.PDFDocument.create();
        pdf.addPage();
        bytes = await pdf.save();
      } else {
        bytes = await sharp({ create: { width: 700, height: 160, channels: 3, background: '#ffffff' } })[extension]().toBuffer();
      }
      const file = new File([bytes], `document.${extension}`, { type: mime });
      const previewApi = uploadRoute(documentType, true);
      const preview = await previewApi.POST(file, true);
      assert.equal(preview.status, 200);
      assert.equal(previewApi.stored(), undefined);
      const processedPreview = new Uint8Array(await preview.arrayBuffer());
      if (extension === 'pdf') {
        assert.equal((await pdfLib.PDFDocument.load(processedPreview)).getPageCount(), 1);
      } else {
        const stats = await sharp(processedPreview).stats();
        assert.ok(stats.channels.some(channel => channel.min < 240));
        assert.ok(processedPreview.length <= 2 * 1024 * 1024);
      }
      const api = uploadRoute(documentType, true);
      const result = await api.POST(file);
      assert.equal(result.status, 200);
      assert.equal(api.stored().contentType, extension === 'pdf' ? 'application/pdf' : 'image/webp');
      assert.ok(result.body.document.url.includes('documentId='));
    });
  }
}


test('all seller branding and signature fields upload valid images and reject files above their 2 MiB limit', async () => {
  const bytes = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#ffffff' } }).png().toBuffer();
  for (const type of ['store_logo', 'store_cover', 'receipt_signature']) {
    const api = uploadRoute(type, true);
    const response = await api.POST(new File([bytes], 'image.png', { type: 'image/png' }));
    assert.equal(response.status, 200, type);
    assert.ok(api.stored().data.byteLength > 0);
    assert.equal(response.body.document.url.startsWith(type === 'receipt_signature' ? '/api/' : 'https://'), true);
    const oversized = uploadRoute(type);
    assert.equal((await oversized.POST(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).status, 400);
    assert.equal(oversized.stored(), undefined);
  }
});

test('seller upload selection keeps exact size boundaries and supported file types consistent', () => {
  const { validateSellerUploadSelection: validate, SELLER_ASSET_UPLOAD_ACCEPT: accept } = uploadPolicy;
  assert.equal(validate({ name: 'logo.png', type: 'image/png', size: 2 * 1024 * 1024 }, accept, 2), null);
  assert.ok(validate({ name: 'logo.png', type: 'image/png', size: 2 * 1024 * 1024 + 1 }, accept, 2));
  for (const [name, type] of [['logo.svg', 'image/svg+xml'], ['logo.gif', 'image/gif'], ['logo.heic', 'image/heic']]) {
    assert.ok(validate({ name, type, size: 100 }, accept, 2));
  }
  assert.equal(validate({ name: 'bank-book.pdf', type: '', size: 5 * 1024 * 1024 }, 'image/jpeg,image/png,image/webp,application/pdf', 5), null);
  assert.ok(validate({ name: 'empty.png', type: 'image/png', size: 0 }, accept, 2));
});

test('uploads fail before storage for unauthenticated, cross-site, suspended, missing seller and empty file requests', async () => {
  const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'image.png', { type: 'image/png' });
  for (const [options, status] of [[{ anonymous: true }, 401], [{ crossSite: true }, 403], [{ status: 'suspended' }, 403], [{ sellerMissing: true }, 409]]) {
    const api = uploadRoute('store_logo', false, options);
    assert.equal((await api.POST(file)).status, status);
    assert.equal(api.stored(), undefined);
  }
  const api = uploadRoute('store_logo');
  assert.equal((await api.POST(new File([], 'empty.png', { type: 'image/png' }))).status, 400);
  assert.equal(api.stored(), undefined);
});


test('a second master admin can upload to an explicitly selected official store; other roles and ordinary stores are denied', async () => {
  const file = new File([await sharp({ create: { width: 16, height: 16, channels: 3, background: '#fff' } }).png().toBuffer()], 'logo.png', { type: 'image/png' });
  const allowed = uploadRoute('store_logo', true, { userId: 'second-admin', sellerId: 'official-store', role: 'master_admin' });
  assert.equal((await allowed.POST(file)).status, 200);
  assert.ok(allowed.stored());
  assert.ok(allowed.stored().path.startsWith('official-store/'));
  for (const options of [
    { role: 'marketplace_user' },
    { role: 'marketplace_admin' },
    { role: 'teacher' },
    { role: 'master_admin', ownerRole: 'marketplace_user' },
    { role: 'master_admin', sellerMissing: true },
  ]) {
    const api = uploadRoute('store_logo', false, { sellerId: 'official-store', ...options });
    assert.equal((await api.POST(file)).status, 403);
    assert.equal(api.stored(), undefined);
  }
});
