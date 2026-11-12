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
const lines = ['เอกสารนี้ใช้สำหรับยืนยันตัวตนผู้ขายในระบบ E-KRU Marketplace เท่านั้น'];
const fontLoader = moduleFrom('src/lib/server-watermark-font.ts', { 'server-only': {}, 'node:path': { join }, 'node:fs/promises': { readFile } });
const { watermarkPdfDocument } = moduleFrom('src/lib/server-document-watermark.ts', {
  'server-only': {}, '@pdf-lib/fontkit': fontkit, 'node:fs/promises': { readFile }, 'pdf-lib': pdfLib,
  './server-watermark-font': fontLoader,
});

const imageOptimizer = moduleFrom('src/lib/server-image-optimizer.ts', { 'server-only': {}, sharp, './server-watermark-font': fontLoader });

function uploadRoute(documentType = 'bank_book', realImages = false) {
  let stored;
  let optimization;
  const query = {
    select: () => query, eq: () => query, upsert: () => query,
    maybeSingle: async () => ({ data: { id: 'seller', status: 'draft' } }),
    single: async () => ({ data: { id: 'document', mime_type: stored.contentType } }),
  };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'src/lib/auth-token': { requireAuthenticated: () => ({ sub: 'owner' }) },
    'src/lib/request-security': { rejectCrossSiteMutation: () => null },
    'src/lib/supabase-admin': { supabaseAdmin: {
      from: () => query,
      storage: { from: () => ({ upload: async (_, data, options) => { stored = { data, ...options }; return {}; }, remove: async () => ({}) }) },
    } },
    'src/lib/server-image-optimizer': realImages ? imageOptimizer : { optimizeUploadedImage: async (_, options) => { optimization = options; return { data: Buffer.alloc(1.5 * 1024 * 1024), contentType: 'image/webp', extension: 'webp' }; } },
    'src/lib/server-document-watermark': { watermarkPdfDocument },
    'src/lib/document-watermark-copy': { SELLER_DOCUMENT_WATERMARK_LINES: lines },
  };
  const api = moduleFrom('src/app/api/marketplace/seller/documents/route.ts', mocks);
  return { POST: (file, preview = false) => api.POST({ url: `https://example.test/documents${preview ? '?preview=1' : ''}`, formData: async () => ({ get: name => name === 'file' ? file : documentType }) }), stored: () => stored, optimization: () => optimization };
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
