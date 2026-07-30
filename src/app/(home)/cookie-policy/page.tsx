import type { Metadata } from 'next';

import { MarketplaceLegalDocumentView } from 'src/sections/marketplace/legal/view/legal-document-view';

export const metadata: Metadata = {
  title: 'Cookie Policy | E-KRU Marketplace',
  alternates: { canonical: '/cookie-policy' },
};

export default function Page() {
  return <MarketplaceLegalDocumentView documentType="cookie_policy" />;
}
