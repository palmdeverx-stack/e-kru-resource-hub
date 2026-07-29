export const LEGAL_DOCUMENT_TYPES = [
  'terms_of_service',
  'seller_agreement',
  'privacy_policy',
  'copyright_takedown',
  'refund_policy',
] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export type MarketplaceLegalDocument = {
  id: string;
  document_type: LegalDocumentType;
  title: string;
  summary: string | null;
  content_html: string;
  provider_type: 'individual';
  provider_name: string | null;
  provider_tax_id: string | null;
  provider_address: string | null;
  contact_email: string | null;
  version: string;
  status: 'draft' | 'published';
  effective_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export const LEGAL_DOCUMENT_LABELS: Record<LegalDocumentType, string> = {
  terms_of_service: 'Terms of Service',
  seller_agreement: 'Seller Agreement',
  privacy_policy: 'Privacy Policy (PDPA)',
  copyright_takedown: 'Copyright & Takedown Policy',
  refund_policy: 'Refund Policy',
};

