import { rejectCrossSiteMutation } from 'src/lib/request-security';

import {
  updateLookup,
  deleteLookup,
  mediaTypeConfig,
} from 'src/sections/marketplace/admin/server/lookup-master';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  return updateLookup(request, (await params).id, mediaTypeConfig);
}

export async function DELETE(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  return deleteLookup(request, (await params).id, mediaTypeConfig);
}
