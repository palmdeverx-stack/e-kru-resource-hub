import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import sharp from 'sharp';
import fontkit from '@pdf-lib/fontkit';

const exports = {};
const mocks = {
  'server-only': {}, sharp, '@pdf-lib/fontkit': fontkit,
  './server-watermark-font': { getWatermarkFont: () => readFile(new URL('../../public/fonts/LINESeedSansTH-Regular.ttf', import.meta.url)) },
};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/lib/server-image-optimizer.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, {
  exports, File, Buffer, require: name => { assert.ok(mocks[name], name); return mocks[name]; },
});

for (const [extension, mime] of [['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']]) {
  test(`small ${extension} document can be watermarked and stays below 2 MB`, async () => {
    const original = await sharp({ create: { width: 700, height: 160, channels: 3, background: '#ffffff' } })[extension]().toBuffer();
    const result = await exports.optimizeUploadedImage(new File([original], `book.${extension}`, { type: mime }), {
      preset: 'document', output: 'webp', maxBytes: 2 * 1024 * 1024,
      watermarkLines: ['เอกสารนี้ใช้สำหรับยืนยันตัวตนผู้ขายในระบบ E-KRU Marketplace เท่านั้น'],
    });
    assert.equal(result.contentType, 'image/webp');
    assert.ok(result.size <= 2 * 1024 * 1024);
    const image = sharp(result.data);
    const metadata = await image.metadata();
    assert.equal(metadata.width, 700);
    assert.equal(metadata.height, 160);
    const { channels } = await image.stats();
    assert.ok(channels.some(channel => channel.min < 240), 'watermark must change the white image');
  });
}
