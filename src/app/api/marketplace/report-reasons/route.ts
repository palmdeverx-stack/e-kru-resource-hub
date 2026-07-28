import {
  listLookup,
  createLookup,
  reportReasonConfig,
} from 'src/sections/marketplace/admin/server/lookup-master';

export const GET = (request: Request) => listLookup(request, reportReasonConfig);
export const POST = (request: Request) => createLookup(request, reportReasonConfig);
