import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../src/sections/marketplace/seller/view/product-form-view.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const syncPendingFiles =');
const end = source.indexOf('  const saveProduct =', start);

test('retry uploads only the failed group and keeps preview files separate', async () => {
  const calls = [];
  let fail = true;
  const state = {
    files: [], pendingDeletedFileIds: [], pendingFilePreview: {},
    pendingProductFiles: [
      { key: 'real', file: { name: 'full.pdf', size: 10 }, isPreview: false },
      { key: 'preview', file: { name: 'sample.pdf', size: 10 }, isPreview: true },
    ],
    setFilesUploading: () => {},
  };
  state.uploadProductFiles = async (_, files, isPreview) => {
    calls.push(isPreview);
    if (isPreview && fail) throw new Error('temporary failure');
    return { files: [...state.files, ...files.map(file => ({ ...file, is_preview: isPreview }))] };
  };
  for (const [setter, key] of Object.entries({
    setFiles: 'files', setPendingProductFiles: 'pendingProductFiles',
    setPendingDeletedFileIds: 'pendingDeletedFileIds', setPendingFilePreview: 'pendingFilePreview',
  })) {
    state[setter] = value => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  }
  const context = vm.createContext(state);
  vm.runInContext(ts.transpileModule(`globalThis.sync = id => {
    const { files, pendingDeletedFileIds, pendingFilePreview, pendingProductFiles } = globalThis;
    ${source.slice(start, end)} return syncPendingFiles(id);
  };`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  await assert.rejects(context.sync('product'), /temporary failure/);
  assert.deepEqual(Array.from(state.pendingProductFiles, file => file.key), ['preview']);
  fail = false;
  await context.sync('product');
  assert.deepEqual(calls, [false, true, true]);
  assert.equal(state.pendingProductFiles.length, 0);
  assert.equal(state.files.filter(file => file.is_preview).length, 1);
});

test('file selection accepts 10 MB and rejects larger files or more than five total', () => {
  const dropStart = source.indexOf('  const handleFileDrop =');
  const dropEnd = source.indexOf('  const handleImageDelete =', dropStart);
  const state = {
    MAX_PRODUCT_FILE_SIZE: 10 * 1024 * 1024, MAX_PRODUCT_FILES: 5,
    MAX_PREVIEW_FILE_SIZE: 10 * 1024 * 1024, MAX_PREVIEW_FILES: 1, pendingFilePreview: {},
    visibleFiles: [], pendingProductFiles: [], error: '',
    crypto: { randomUUID: () => 'file' },
  };
  state.setError = (value) => { state.error = value; };
  state.setPendingProductFiles = (update) => { state.pendingProductFiles = update(state.pendingProductFiles); };
  const context = vm.createContext(state);
  vm.runInContext(ts.transpileModule(`${source.slice(dropStart, dropEnd)}\nglobalThis.drop = handleFileDrop;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  context.drop([{ size: 10 * 1024 * 1024 }]);
  assert.equal(state.pendingProductFiles.length, 1);
  context.drop([{ size: 10 * 1024 * 1024 + 1 }]);
  assert.match(state.error, /10 MB/);
  assert.equal(state.pendingProductFiles.length, 1);
  state.visibleFiles = Array.from({ length: 4 }, () => ({ is_preview: false }));
  context.drop([{ size: 1 }]);
  assert.equal(state.pendingProductFiles.length, 1);
  assert.match(state.error, /0/);
  context.drop([{ size: 10 * 1024 * 1024 }], true);
  assert.equal(state.pendingProductFiles.length, 2);
  context.drop([{ size: 1 }], true);
  assert.equal(state.pendingProductFiles.length, 2);
  context.drop([{ size: 10 * 1024 * 1024 + 1 }], true);
  assert.match(state.error, /10 MB/);
});

test('cover selection retries without uploading the image twice', async () => {
  const imageStart = source.indexOf('  const syncPendingImages =');
  const imageEnd = source.indexOf('  const syncPendingFiles =', imageStart);
  let uploads = 0;
  let fail = true;
  const cover = { id: 'new-cover', is_cover: false };
  const state = {
    images: [], pendingDeletedImageIds: [], pendingCover: { name: 'cover.png' },
    pendingPreviewImages: [], pendingCoverIdRef: { current: null },
    setImagesUploading: () => {},
    uploadProductImages: async () => { uploads++; return { images: [cover] }; },
    setProductCoverImage: async () => {
      if (fail) throw new Error('cover update failed');
      return { images: [{ ...cover, is_cover: true }] };
    },
  };
  for (const [setter, key] of Object.entries({
    setImages: 'images', setPendingCover: 'pendingCover',
    setPendingPreviewImages: 'pendingPreviewImages', setPendingDeletedImageIds: 'pendingDeletedImageIds',
  })) state[setter] = value => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  const context = vm.createContext(state);
  vm.runInContext(ts.transpileModule(`globalThis.sync = id => {
    const { images, pendingDeletedImageIds, pendingCover, pendingPreviewImages } = globalThis;
    ${source.slice(imageStart, imageEnd)} return syncPendingImages(id);
  };`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  await assert.rejects(context.sync('product'), /cover update failed/);
  assert.equal(uploads, 1);
  assert.equal(state.pendingCover, null);
  assert.equal(state.pendingCoverIdRef.current, 'new-cover');
  fail = false;
  await context.sync('product');
  assert.equal(uploads, 1);
  assert.equal(state.images[0].is_cover, true);
});

test('preview images upload one per request and retry only the failed image', async () => {
  const imageStart = source.indexOf('  const syncPendingImages =');
  const imageEnd = source.indexOf('  const syncPendingFiles =', imageStart);
  const first = { name: 'first.png' };
  const second = { name: 'second.png' };
  const calls = [];
  let fail = true;
  const state = {
    images: [], pendingDeletedImageIds: [], pendingCover: null,
    pendingPreviewImages: [first, second], pendingCoverIdRef: { current: null },
    setImagesUploading: () => {},
  };
  state.uploadProductImages = async (_, files, isPreview) => {
    assert.equal(files.length, 1);
    assert.equal(isPreview, true);
    calls.push(files[0].name);
    if (files[0] === second && fail) throw new Error('temporary failure');
    return { images: [...state.images, { id: files[0].name }] };
  };
  for (const [setter, key] of Object.entries({
    setImages: 'images', setPendingCover: 'pendingCover',
    setPendingPreviewImages: 'pendingPreviewImages', setPendingDeletedImageIds: 'pendingDeletedImageIds',
  })) state[setter] = value => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  const context = vm.createContext(state);
  vm.runInContext(ts.transpileModule(`globalThis.sync = id => {
    const { images, pendingDeletedImageIds, pendingCover, pendingPreviewImages } = globalThis;
    ${source.slice(imageStart, imageEnd)} return syncPendingImages(id);
  };`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  await assert.rejects(context.sync('product'), /temporary failure/);
  assert.equal(state.pendingPreviewImages.length, 1);
  assert.equal(state.pendingPreviewImages[0], second);
  fail = false;
  await context.sync('product');
  assert.deepEqual(calls, ['first.png', 'second.png', 'second.png']);
  assert.equal(state.pendingPreviewImages.length, 0);
});
