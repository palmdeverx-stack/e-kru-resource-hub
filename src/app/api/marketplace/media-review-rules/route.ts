import {
  listLookup,
  createLookup,
  mediaReviewRuleConfig,
} from 'src/sections/marketplace/admin/server/lookup-master';

export const GET = (request: Request) => listLookup(request, mediaReviewRuleConfig);
export const POST = (request: Request) => createLookup(request, mediaReviewRuleConfig);
