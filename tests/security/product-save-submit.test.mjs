import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual save handler with deferred validation; no browser or provider calls.
const source = readFileSync(new URL('../../src/sections/marketplace/seller/view/product-form-view.tsx', import.meta.url), 'utf8');
const syntax = ts.createSourceFile('product-form-view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function findHandler(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(syntax) === 'saveProduct') {
    handler = `const saveProduct = ${node.initializer.getText(syntax)};`;
  }
  ts.forEachChild(node, findHandler);
}
findHandler(syntax);
assert.ok(handler);
function setup({ valid = true, fail = false } = {}) {
  let finishValidation;
  const validation = new Promise(resolve => { finishValidation = resolve; });
  const state = { action: null, drafts: 0, updates: 0, errors: [] };
  const context = {
    saveInProgressRef: { current: false },
    setSaveAction: action => { state.action = action; },
    setError: error => state.errors.push(error), setMessage: () => {},
    trigger: async () => { await validation; return valid; },
    user: { role: 'master_admin' }, selectedSaleType: null,
    form: { title: 'Product', externalLinks: [], tagIds: [] }, requirements: [],
    ProductSubmissionSchema: { safeParse: () => ({ success: true }) }, getValues: () => ({}),
    ensureDraft: async () => { state.drafts++; return 'product'; },
    productInput: () => ({}), submissionAcceptance: {},
    updateProduct: async () => { state.updates++; if (fail) throw Error('write failed'); return { product: {} }; },
    getManagedProduct: async () => ({ product: {} }),
    setTags: () => {}, syncPendingImages: async () => {}, syncPendingFiles: async () => {},
    hydrate: () => {}, router: { push: () => {}, replace: () => {} },
  };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(handler + '\nglobalThis.save = saveProduct;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { state, save: context.save, release: () => finishValidation() };
}
for (const submit of [false, true]) {
  test(`duplicate clicks are blocked during validation and writes (${submit ? 'submit' : 'draft'})`, async () => {
    const api = setup();
    const first = api.save(submit);
    assert.equal(api.state.action, submit ? 'submit' : 'draft');
    assert.equal(await api.save(!submit), false);
    api.release();
    assert.equal(await first, true);
    assert.equal(api.state.drafts, 1);
    assert.equal(api.state.action, null);
  });
}
for (const config of [{ valid: false }, { fail: true }]) {
  test(`validation/write failures release the lock for retry: ${JSON.stringify(config)}`, async () => {
    const api = setup(config);
    api.release();
    assert.equal(await api.save(), false);
    assert.equal(api.state.action, null);
    const before = api.state.errors.length;
    assert.equal(await api.save(), false);
    assert.ok(api.state.errors.length > before);
  });
}
