import { rejectCrossSiteMutation } from 'src/lib/request-security';

import {
  updateLegalDocument,
  deleteLegalDocument,
} from 'src/sections/marketplace/admin/server/legal-documents';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  return updateLegalDocument(request, (await params).id);
}

export async function DELETE(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  return deleteLegalDocument(request, (await params).id);
}
