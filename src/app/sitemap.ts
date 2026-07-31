import type { MetadataRoute } from 'next';

import { supabaseAdmin } from 'src/lib/supabase-admin';

import { absoluteMarketplaceUrl } from 'src/sections/marketplace/seo/site-url';
import { SELLER_TOOLS_CATEGORY } from 'src/sections/marketplace/seller/server/seller-tools-access';

const staticRoutes: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/products', changeFrequency: 'daily', priority: 0.9 },
  { path: '/stores', changeFrequency: 'daily', priority: 0.8 },
  { path: '/terms-of-service', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/privacy-policy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/seller-agreement', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/service-agreement', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/refund-policy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/copyright-takedown-policy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/cookie-policy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/digital-product-license', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/payment-payout-policy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/product-content-policy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/complaint-dispute-policy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/child-student-data-policy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/data-processing-agreement', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/subscription-renewal-policy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/product-submission-terms', changeFrequency: 'monthly', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: absoluteMarketplaceUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const [productsResult, storesResult] = await Promise.all([
    supabaseAdmin
      .from('marketplace_products')
      .select('id, updated_at, seller:marketplace_sellers!inner(status)')
      .eq('status', 'published')
      .eq('seller.status', 'active')
      .neq('category', SELLER_TOOLS_CATEGORY)
      .order('updated_at', { ascending: false })
      .limit(10000),
    supabaseAdmin
      .from('marketplace_sellers')
      .select('id, slug, updated_at')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(10000),
  ]);

  const productEntries: MetadataRoute.Sitemap = (productsResult.data ?? []).map((product) => ({
    url: absoluteMarketplaceUrl(`/product/${encodeURIComponent(product.id)}`),
    lastModified: new Date(product.updated_at),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));
  const storeEntries: MetadataRoute.Sitemap = (storesResult.data ?? []).map((store) => ({
    url: absoluteMarketplaceUrl(`/store/${encodeURIComponent(store.slug || store.id)}`),
    lastModified: new Date(store.updated_at),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticEntries, ...productEntries, ...storeEntries];
}
