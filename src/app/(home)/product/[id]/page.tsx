import type { Metadata } from 'next';

import { MarketplaceProductDetailView } from 'src/sections/marketplace/catalog/view/product-detail-view';

export const metadata: Metadata = {
  title: 'รายละเอียดสินค้า | E-KRU Marketplace',
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MarketplaceProductDetailView productId={id} />;
}
