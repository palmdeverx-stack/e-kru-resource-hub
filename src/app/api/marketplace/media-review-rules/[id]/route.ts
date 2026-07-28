import {
  updateLookup,
  deleteLookup,
  mediaReviewRuleConfig,
} from 'src/sections/marketplace/admin/server/lookup-master';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  return updateLookup(request, (await params).id, mediaReviewRuleConfig);
}

export async function DELETE(request: Request, { params }: Context) {
  return deleteLookup(request, (await params).id, mediaReviewRuleConfig);
}
