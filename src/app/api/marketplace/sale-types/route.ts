import {
  listLookup,
  createLookup,
  saleTypeConfig,
} from 'src/sections/marketplace/admin/server/lookup-master';

export const GET = (request: Request) => listLookup(request, saleTypeConfig);
export const POST = (request: Request) => createLookup(request, saleTypeConfig);
