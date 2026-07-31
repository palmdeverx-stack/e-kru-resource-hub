import type { Metadata } from 'next';
import type { LegalDocumentType } from 'src/sections/marketplace/legal/types';

import { notFound } from 'next/navigation';

import { LEGAL_DOCUMENT_LABELS } from 'src/sections/marketplace/legal/types';
import { MarketplaceLegalDocumentView } from 'src/sections/marketplace/legal/view/legal-document-view';

type Props = { params: Promise<{ slug: string }> };

const DOCUMENTS: Record<string, LegalDocumentType> = {
  'digital-product-license': 'digital_product_license',
  'payment-payout-policy': 'payment_payout_policy',
  'product-content-policy': 'product_content_policy',
  'complaint-dispute-policy': 'complaint_dispute_policy',
  'child-student-data-policy': 'child_data_policy',
  'data-processing-agreement': 'data_processing_agreement',
  'subscription-renewal-policy': 'subscription_policy',
  'product-submission-terms': 'product_submission_terms',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const documentType = DOCUMENTS[slug];
  return {
    title: documentType
      ? `${LEGAL_DOCUMENT_LABELS[documentType]} | E-KRU Marketplace`
      : 'ไม่พบเอกสาร | E-KRU Marketplace',
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const documentType = DOCUMENTS[slug];
  if (!documentType) notFound();
  return <MarketplaceLegalDocumentView documentType={documentType} />;
}
