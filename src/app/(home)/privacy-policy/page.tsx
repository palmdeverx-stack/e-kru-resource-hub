import type { Metadata } from 'next';

import { MarketplaceLegalDocumentView } from 'src/sections/marketplace/legal/view/legal-document-view';

export const metadata: Metadata = {
  title: 'Privacy Policy (PDPA) | E-KRU Marketplace',
  alternates: { canonical: '/privacy-policy' },
};

export default function Page() {
  return <MarketplaceLegalDocumentView documentType="privacy_policy" />;
}
