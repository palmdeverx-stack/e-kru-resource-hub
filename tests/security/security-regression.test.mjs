import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mutationHandlerPattern = /export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\s*\(/;
const externalWebhookRoutes = new Set([
  'src/app/api/marketplace/shipping/webhook/shippop/route.ts',
]);

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

    const relativeRoute = path.relative(projectRoot, routePath);
    if (externalWebhookRoutes.has(relativeRoute)) continue;
    mutationRoutes.push(relativeRoute);
    assert.match(
      source,
      /rejectCrossSiteMutation\(request\)/,
      `${path.relative(projectRoot, routePath)} must reject cross-site mutations`
    );
  }

  assert.ok(mutationRoutes.length > 0, 'expected to inspect at least one mutation route');
});

test('SHIPPOP webhook requires a server-side secret and constant-time comparison', async () => {
  const source = await readProjectFile('src/app/api/marketplace/shipping/webhook/shippop/route.ts');

  assert.match(source, /process\.env\.SHIPPOP_WEBHOOK_SECRET/);
  assert.match(source, /crypto\.timingSafeEqual/);
  assert.match(source, /status: 401/);
});

test('shipping finance uses idempotent ledger entries and protects manual reconciliation', async () => {
  const accounting = await readProjectFile(
    'src/sections/marketplace/shipping/server/accounting.ts'
  );
  const reconciliation = await readProjectFile(
    'src/app/api/marketplace/admin/shipping-finance/[id]/reconcile/route.ts'
  );

  assert.match(accounting, /onConflict: 'idempotency_key'/);
  assert.match(accounting, /recordShippingPaymentFee/);
  assert.match(accounting, /recordShippingRefundForOrders/);
  assert.match(reconciliation, /requireRole\(request, \['master_admin'\]\)/);
  assert.match(reconciliation, /hasPayoutAccess\(request, caller\.sub\)/);
  assert.match(reconciliation, /rejectCrossSiteMutation\(request\)/);
});

test('official-store shipping bypasses only the regular-seller switch, not provider safety', async () => {
  const config = await readProjectFile('src/sections/marketplace/shipping/server/config.ts');
  const sellerPage = await readProjectFile('src/app/dashboard/seller/shipping/page.tsx');
  const rates = await readProjectFile('src/app/api/marketplace/shipping/rates/route.ts');

  assert.match(config, /const officialEnabled = providerConfigured && !killed/);
  assert.match(config, /officialAccessEnabled: !killed/);
  assert.match(config, /ownerRole === 'master_admin'/);
  assert.match(sellerPage, /caller\?\.role === 'master_admin' && config\.officialAccessEnabled/);
  assert.match(rates, /isMarketplaceShippingEnabledForOfficialSeller/);
  assert.match(rates, /seller\?\.owner_role/);
});

test('storefront views count unique consented visitors and exclude the store owner', async () => {
  const route = await readProjectFile('src/app/api/marketplace/stores/[slug]/view/route.ts');
  const storefront = await readProjectFile(
    'src/sections/marketplace/seller/view/storefront-view.tsx'
  );

  assert.match(route, /onConflict: 'seller_id,visitor_key'/);
  assert.match(route, /caller\?\.sub === seller\.owner_id/);
  assert.match(route, /rejectCrossSiteMutation\(request\)/);
  assert.match(storefront, /hasAnalyticsConsent\(\)/);
  assert.match(storefront, /ekru_marketplace_visitor_id/);
});

test('Stripe webhook verifies its signature instead of requiring a browser Origin', async () => {
  const source = await readProjectFile('src/app/api/stripe/webhook/route.ts');

  assert.match(source, /webhooks\.constructEvent\(/);
  assert.match(source, /getStripeWebhookSecret\(\)/);
});

test('access-token cookie and JWT keep their security constraints', async () => {
  const source = await readProjectFile('src/lib/auth-token.ts');

  assert.match(source, /const ACCESS_TOKEN_MAX_AGE_SECONDS = 24 \* 60 \* 60/);
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

test('free fixed-term individual trials cannot be purchased more than once', async () => {
  const source = await readProjectFile(
    'src/sections/marketplace/catalog/server/product-engagement.ts'
  );

  assert.match(source, /const isSingleUseTrial =/);
  assert.match(source, /Number\(price\) === 0/);
  assert.match(source, /licenseBillingCycle === 'contract'/);
  assert.match(source, /Number\(grantDurationDays\) > 0/);
  assert.match(source, /isSingleUseTrial \|\| featureKeys\?\.includes/);
  assert.match(source, /hasPurchasedProduct\(productId, buyerId\)/);
});

test('E-KRU package feature catalog includes Worksheet AI', async () => {
  const featureCatalog = await readProjectFile('src/lib/school-subscription-config.ts');
  const productManagement = await readProjectFile(
    'src/app/api/marketplace/products/[id]/manage/route.ts'
  );

  assert.match(featureCatalog, /key: 'teacher\.worksheet_ai'/);
  assert.match(productManagement, /invalidFeatureKeys/);
});
