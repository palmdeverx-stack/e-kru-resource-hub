import {
  listLegalDocuments,
  createLegalDocument,
} from 'src/sections/marketplace/admin/server/legal-documents';

export const GET = (request: Request) => listLegalDocuments(request);
export const POST = (request: Request) => createLegalDocument(request);
