import {
  updateLegalDocument,
  deleteLegalDocument,
} from 'src/sections/marketplace/admin/server/legal-documents';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  return updateLegalDocument(request, (await params).id);
}

export async function DELETE(request: Request, { params }: Context) {
  return deleteLegalDocument(request, (await params).id);
}
