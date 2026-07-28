import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const ROOTS = ['src/app', 'src/auth', 'src/components', 'src/layouts', 'src/sections'];
const OUTPUT = 'src/locales/langs/en/ui.generated.json';
const THAI_PATTERN = /[ก-๙]/;
const PLACEHOLDER_PATTERN = /__ISCORE_VAR_\d+__/g;
const SPLITTER = '\n__ISCORE_SPLIT_7F4A__\n';

async function listSourceFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return listSourceFiles(target);
      return /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
    })
  );
  return files.flat();
}

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function collectFromSource(source, filename, exact, templates) {
  const sourceFile = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  function visit(node) {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      THAI_PATTERN.test(node.text)
    ) {
      const value = normalize(node.text);
      if (value) exact.add(value);
    }

    if (ts.isJsxText(node) && THAI_PATTERN.test(node.text)) {
      const value = normalize(node.text);
      if (value) exact.add(value);
    }

    if (ts.isTemplateExpression(node)) {
      let value = node.head.text;
      node.templateSpans.forEach((span, index) => {
        value += `__ISCORE_VAR_${index}__${span.literal.text}`;
      });
      value = normalize(value);
      if (THAI_PATTERN.test(value)) templates.add(value);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

async function translateBatch(values) {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'th',
    tl: 'en',
    dt: 't',
    q: values.join(SPLITTER),
  });
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
  if (!response.ok) throw new Error(`Translation request failed: ${response.status}`);
  const payload = await response.json();
  const translated = payload[0].map((part) => part[0]).join('');
  const parts = translated.split(SPLITTER.trim()).map(normalize);
  if (parts.length !== values.length) {
    throw new Error(`Translation batch mismatch: ${values.length} source / ${parts.length} target`);
  }
  return parts;
}

async function translateAll(values) {
  const result = new Map();
  let batch = [];
  let length = 0;

  async function flush() {
    if (!batch.length) return;
    const translated = await translateBatch(batch);
    batch.forEach((source, index) => result.set(source, translated[index]));
    batch = [];
    length = 0;
  }

  for (const value of values) {
    if (length + value.length > 2600 || batch.length >= 30) await flush();
    batch.push(value);
    length += value.length;
  }
  await flush();
  return result;
}

const files = (await Promise.all(ROOTS.map(listSourceFiles))).flat();
const exact = new Set();
const templates = new Set();

for (const file of files) {
  collectFromSource(await fs.readFile(file, 'utf8'), file, exact, templates);
}

const sources = [...exact, ...templates].sort((a, b) => a.localeCompare(b, 'th'));
const translated = await translateAll(sources);
const output = {
  generatedAt: new Date().toISOString(),
  exact: Object.fromEntries([...exact].sort().map((source) => [source, translated.get(source)])),
  templates: [...templates]
    .sort((a, b) => b.length - a.length)
    .map((source) => ({
      source,
      target: translated.get(source),
      placeholders: source.match(PLACEHOLDER_PATTERN)?.length ?? 0,
    })),
};

await fs.writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Generated ${exact.size} exact and ${templates.size} template translations in ${OUTPUT}`
);
