import type { Metadata } from 'next';

import { MarketplaceFeedbackView } from 'src/sections/marketplace/feedback/view/feedback-view';

export const metadata: Metadata = { title: 'Feedback | E-KRU Marketplace' };

export default function Page() {
  return <MarketplaceFeedbackView />;
}
