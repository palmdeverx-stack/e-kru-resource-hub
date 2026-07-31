export const PRODUCT_SUBMISSION_TERMS_DOCUMENT_TYPE = 'product_submission_terms' as const;

export type ProductSubmissionAcceptance = { accepted: boolean };

export const initialProductSubmissionAcceptance: ProductSubmissionAcceptance = { accepted: false };

export const REQUIRED_PRODUCT_LEGAL_DOCUMENT_TYPES = [
  'seller_agreement',
  'copyright_takedown',
  'product_content_policy',
  'digital_product_license',
  'privacy_policy',
  PRODUCT_SUBMISSION_TERMS_DOCUMENT_TYPE,
] as const;
