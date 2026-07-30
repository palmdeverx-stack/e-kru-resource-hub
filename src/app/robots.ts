import type { MetadataRoute } from 'next';

import { absoluteMarketplaceUrl } from 'src/sections/marketplace/seo/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/auth/', '/checkout/', '/cart', '/school/setup/'],
      },
    ],
    sitemap: absoluteMarketplaceUrl('/sitemap.xml'),
    host: absoluteMarketplaceUrl('/'),
  };
}
