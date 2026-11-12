import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as z from 'zod';

const exports = {};
const source = readFileSync(new URL('../../src/sections/marketplace/seller/view/product-form-schema.ts', import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText, { exports, URL, require: name => { assert.equal(name, 'zod'); return z; } });
const { initialProductForm, ProductDraftSchema, ProductSubmissionSchema } = exports;
const draft = () => ({ ...initialProductForm, title: 'ทดสอบสินค้า' });
const submission = () => ({ ...draft(), description: '<p>รายละเอียดสินค้าอย่างครบถ้วน</p>',
  category: 'category', mediaTypeId: 'media', saleTypeId: 'sale', purchaseBenefits: ['ไฟล์ใบงานพร้อมเฉลย'] });

test('draft accepts incomplete content while submission requires actual sale fields and benefits', () => {
  assert.equal(ProductDraftSchema.safeParse(draft()).success, true);
  assert.equal(ProductSubmissionSchema.safeParse(draft()).success, false);
  assert.equal(ProductSubmissionSchema.safeParse(submission()).success, true);
  for (const purchaseBenefits of [[], ['   '], Array(11).fill('item')]) {
    assert.equal(ProductSubmissionSchema.safeParse({ ...submission(), purchaseBenefits }).success, false);
  }
  assert.equal(ProductSubmissionSchema.safeParse({ ...submission(), purchaseBenefits: Array(10).fill('item') }).success, true);
});

test('validation rejects invalid prices, credential URLs, and excessively long descriptions', () => {
  for (const price of ['NaN', 'Infinity', '-1', '']) {
    assert.equal(ProductDraftSchema.safeParse({ ...draft(), price }).success, false);
  }
  assert.equal(ProductDraftSchema.safeParse({ ...draft(), price: '100', listPrice: '90' }).success, false);
  for (const url of ['javascript:alert(1)', 'https://user:password@example.com', 'not a URL']) {
    assert.equal(ProductDraftSchema.safeParse({ ...draft(), externalLinks: [{ label: 'link', url }] }).success, false);
  }
  assert.equal(ProductDraftSchema.safeParse({ ...draft(), shortDescription: 'a'.repeat(151) }).success, false);
});
