import type { Metadata } from 'next';

import { MarketplaceProductDetailView } from 'src/sections/marketplace/catalog/view/product-detail-view';
import { getPublicProductSeo } from 'src/sections/marketplace/seo/server';
import { absoluteMarketplaceUrl } from 'src/sections/marketplace/seo/site-url';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getPublicProductSeo(id);

  if (!product) {
    return {
      title: 'ไม่พบสินค้า | E-KRU Marketplace',
      robots: { index: false, follow: false },
    };
  }

  const path = `/product/${encodeURIComponent(product.id)}`;
  const images = product.image
    ? [{ url: product.image, alt: product.title }]
    : undefined;

  return {
    title: `${product.title} | E-KRU Marketplace`,
    description: product.description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      locale: 'th_TH',
      title: product.title,
      description: product.description,
      url: path,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.title,
      description: product.description,
      images: product.image ? [product.image] : undefined,
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const product = await getPublicProductSeo(id);
  const productUrl = absoluteMarketplaceUrl(`/product/${encodeURIComponent(id)}`);
  const structuredData = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        description: product.description,
        sku: product.id,
        image: product.image ? [product.image] : undefined,
        brand: {
          '@type': 'Brand',
          name: product.sellerName,
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
            name: product.sellerName,
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
