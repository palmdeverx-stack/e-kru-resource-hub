import type { Metadata } from 'next';

import { MarketplaceProductFormView } from 'src/sections/marketplace/seller/view/product-form-view';

export const metadata: Metadata = { title: 'ลงสินค้าใหม่ | eKru Marketplace' };

export default function Page() {
  return <MarketplaceProductFormView />;
}
