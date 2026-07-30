import type { Metadata } from 'next';

import { MarketplaceProductFormView } from 'src/sections/marketplace/seller/view/product-form-view';

export const metadata: Metadata = {
  title: 'แก้ไขสินค้า | E-KRU Marketplace',
};

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  return <MarketplaceProductFormView productId={(await params).id} />;
}
