import type { Metadata } from 'next';

import { detectLanguage, getServerTranslations } from 'src/locales/server';

import { getPublicProductSeo } from 'src/sections/marketplace/seo/server';
import { getPublicPlatformSettings } from 'src/sections/marketplace/admin/server/platform-settings';
import { MarketplaceProductDetailView } from 'src/sections/marketplace/catalog/view/product-detail-view';
import {
  absoluteMarketplaceUrl,
  MARKETPLACE_OG_IMAGE_URL,
} from 'src/sections/marketplace/seo/site-url';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const lang = await detectLanguage();
  const { t } = await getServerTranslations('marketplace');
  const [product, settings] = await Promise.all([
    getPublicProductSeo(id),
    getPublicPlatformSettings(),
  ]);
  const platformName =
    (lang === 'en' ? settings?.platform_name_en : settings?.platform_name_th) ||
    settings?.platform_name_th ||
    settings?.platform_name_en ||
    'E-KRU Marketplace';

  if (!product) {
    return {
      title: t('productDetail.seo.notFound', { platformName }),
      robots: { index: false, follow: false },
    };
  }

  const path = `/product/${encodeURIComponent(product.id)}`;
  const productTitle = lang === 'en' && product.titleEn?.trim() ? product.titleEn : product.title;
  const productDescription = lang === 'en' ? product.descriptionEn : product.description;
  const shareImage = product.image || settings?.og_image_url || MARKETPLACE_OG_IMAGE_URL;
  const images = [{ url: shareImage, alt: productTitle }];

  return {
    title: `${productTitle} | ${platformName}`,
    description: productDescription,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      locale: lang === 'en' ? 'en_US' : 'th_TH',
      title: productTitle,
      description: productDescription,
      url: path,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: productTitle,
      description: productDescription,
      images: [shareImage],
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const lang = await detectLanguage();
  const product = await getPublicProductSeo(id);
  const productUrl = absoluteMarketplaceUrl(`/product/${encodeURIComponent(id)}`);
  const structuredData = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: lang === 'en' && product.titleEn?.trim() ? product.titleEn : product.title,
        description: lang === 'en' ? product.descriptionEn : product.description,
        sku: product.id,
        image: product.image ? [product.image] : undefined,
        brand: {
          '@type': 'Brand',
          name: lang === 'en' ? product.sellerNameEn : product.sellerName,
        },
        aggregateRating: product.reviewCount
          ? {
              '@type': 'AggregateRating',
              ratingValue: Number(product.averageRating.toFixed(2)),
              reviewCount: product.reviewCount,
            }
          : undefined,
        offers: {
          '@type': 'Offer',
          url: productUrl,
          priceCurrency: product.currency,
          price: product.price.toFixed(2),
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: {
            '@type': 'Organization',
            name: lang === 'en' ? product.sellerNameEn : product.sellerName,
          },
        },
      }
    : null;

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
          }}
        />
      )}
      <MarketplaceProductDetailView productId={id} />
    </>
  );
}
