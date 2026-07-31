const LOCAL_SITE_URL = 'http://localhost:8800';

export const MARKETPLACE_OG_IMAGE_URL =
  'https://res.cloudinary.com/dkdbilwtj/image/upload/v1785509072/marketplace_ahtoum.png';

function withProtocol(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function getMarketplaceSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_MARKETPLACE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SERVER_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    LOCAL_SITE_URL;

  return withProtocol(configuredUrl).replace(/\/+$/, '');
}

export function absoluteMarketplaceUrl(path = '/') {
  return new URL(path, `${getMarketplaceSiteUrl()}/`).toString();
}
