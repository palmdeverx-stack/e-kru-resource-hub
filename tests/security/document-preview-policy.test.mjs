import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

test('PDF preview permits local blob frames and only same-origin framing of uploaded documents', async () => {
  const exports = {};
  const source = readFileSync(new URL('../../next.config.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, process: { cwd: () => '/test-workspace', env: { NODE_ENV: 'production' } },
  });
  const rules = await exports.default.headers();
  const main = rules.find(rule => rule.source === '/:path*').headers;
  const docs = rules.find(rule => rule.source === '/api/marketplace/seller/documents').headers;
  const header = (headers, key) => headers.find(item => item.key === key).value;
  assert.match(header(main, 'Content-Security-Policy'), /frame-src 'self' blob:/);
  assert.match(header(main, 'Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.equal(header(main, 'X-Frame-Options'), 'DENY');
  assert.equal(header(docs, 'X-Frame-Options'), 'SAMEORIGIN');
  assert.match(header(docs, 'Content-Security-Policy'), /frame-ancestors 'self'/);
});
