import { rejectCrossSiteMutation } from 'src/lib/request-security';

import {
  listLandingBanners,
  createLandingBanner,
} from 'src/sections/marketplace/admin/server/landing-banners';

export const GET = (request: Request) => listLandingBanners(request);

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  return createLandingBanner(request);
}
