import { rejectCrossSiteMutation } from 'src/lib/request-security';

import {
  deleteLandingBanner,
  updateLandingBanner,
} from 'src/sections/marketplace/admin/server/landing-banners';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  return updateLandingBanner(request, (await params).id);
}

export async function DELETE(request: Request, { params }: Context) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  return deleteLandingBanner(request, (await params).id);
}
