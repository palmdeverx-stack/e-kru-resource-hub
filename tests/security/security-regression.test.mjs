import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mutationHandlerPattern = /export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\s*\(/;

async function readProjectFile(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8');
}

async function collectRouteFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectRouteFiles(entryPath);
      return entry.name === 'route.ts' ? [entryPath] : [];
    })
  );

  return files.flat();
}

test('cookie-authenticated mutation routes enforce Same-Origin requests', async () => {
  const protectedAreas = ['auth', 'marketplace', 'notifications'];
  const routeGroups = await Promise.all(
    protectedAreas.map((area) => collectRouteFiles(path.join(projectRoot, 'src/app/api', area)))
  );
  const mutationRoutes = [];

  for (const routePath of routeGroups.flat()) {
    const source = await readFile(routePath, 'utf8');
    if (!mutationHandlerPattern.test(source)) continue;

    mutationRoutes.push(path.relative(projectRoot, routePath));
    assert.match(
      source,
      /rejectCrossSiteMutation\(request\)/,
      `${path.relative(projectRoot, routePath)} must reject cross-site mutations`
    );
  }

  assert.ok(mutationRoutes.length > 0, 'expected to inspect at least one mutation route');
});

test('Stripe webhook verifies its signature instead of requiring a browser Origin', async () => {
  const source = await readProjectFile('src/app/api/stripe/webhook/route.ts');

  assert.match(source, /webhooks\.constructEvent\(/);
  assert.match(source, /getStripeWebhookSecret\(\)/);
});

test('access-token cookie and JWT keep their security constraints', async () => {
  const source = await readProjectFile('src/lib/auth-token.ts');

  assert.match(source, /const ACCESS_TOKEN_MAX_AGE_SECONDS = 30 \* 60/);
  assert.match(source, /httpOnly:\s*true/);
  assert.match(source, /secure:\s*process\.env\.NODE_ENV === 'production'/);
  assert.match(source, /sameSite:\s*'lax'/);
  assert.match(source, /algorithm:\s*'HS256'/);
  assert.match(source, /algorithms:\s*\['HS256'\]/);
});

test('rate limiting fails closed when its storage is unavailable', async () => {
  const source = await readProjectFile('src/lib/auth-rate-limit.ts');

  assert.match(source, /if \(error\)[\s\S]{0,180}return false/);
  assert.match(source, /catch \(error\)[\s\S]{0,180}return false/);
  assert.match(source, /return data === true/);
  assert.doesNotMatch(source, /Rate limit check failed[\s\S]{0,180}return true/);
});

test('marketplace downloads keep authentication, ownership, payment, scan, and TTL checks', async () => {
  const source = await readProjectFile('src/app/api/marketplace/downloads/[fileId]/route.ts');

  assert.match(source, /requireAuthenticated\(request\)/);
  assert.match(source, /\.eq\('order\.buyer_id', caller\.sub\)/);
  assert.match(source, /\.in\('order\.status', \['paid', 'completed'\]\)/);
  assert.match(source, /file\.scan_status === 'rejected'/);
  assert.match(source, /createSignedUrl\(file\.storage_path, 60,/);
});
