import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(directory, entry.name)] : []);
}

test('every browser fetch call site explicitly uses the TanStack API gateway', () => {
  let modules = 0;
  let calls = 0;
  const uncovered = [];
  for (const file of files(join(root, 'src'))) {
    const name = relative(root, file);
    const source = readFileSync(file, 'utf8');
    if (!(source.startsWith("'use client';") || name === 'src/sections/marketplace/shared/api.ts')) continue;
    const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
    let count = 0;
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetch') count++;
      ts.forEachChild(node, visit);
    }
    visit(ast);
    if (!count) continue;
    modules++;
    calls += count;
    const connected = ast.statements.some(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'src/lib/api-fetch' && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(item => item.name.text === 'fetch' && item.propertyName?.text === 'apiFetch'));
    if (!connected) uncovered.push(name);
  }
  assert.deepEqual(uncovered, []);
  assert.ok(modules > 0);
  assert.ok(calls >= 100);
  console.log(`Covered ${calls} browser fetch call sites in ${modules} modules`);
});
