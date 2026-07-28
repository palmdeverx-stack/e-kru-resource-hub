import 'server-only';

import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

export type LegalDocument = 'privacy-policy' | 'terms-of-service' | 'service-agreement';

const LEGAL_DOCUMENT_FILES: Record<LegalDocument, string> = {
  'privacy-policy': 'PRIVACY_POLICY.md',
  'terms-of-service': 'TERMS_OF_SERVICE.md',
  'service-agreement': 'SERVICE_AGREEMENT.md',
};

export async function getLegalDocument(document: LegalDocument) {
  return readFile(join(process.cwd(), 'docs', 'legal', LEGAL_DOCUMENT_FILES[document]), 'utf8');
}
