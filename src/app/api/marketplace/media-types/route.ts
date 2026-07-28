import {
  listLookup,
  createLookup,
  mediaTypeConfig,
} from 'src/sections/marketplace/admin/server/lookup-master';

export const GET = (request: Request) => listLookup(request, mediaTypeConfig);
export const POST = (request: Request) => createLookup(request, mediaTypeConfig);
