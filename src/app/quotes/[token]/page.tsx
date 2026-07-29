import type { Metadata } from 'next';

import { QuoteAcceptanceView } from 'src/sections/marketplace/contract/view/quote-acceptance-view';

export const metadata: Metadata = {
  title: 'ข้อเสนอขาย | E-KRU Marketplace',
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <QuoteAcceptanceView token={token} />;
}
