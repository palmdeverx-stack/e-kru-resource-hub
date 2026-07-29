import {
  listLookup,
  createLookup,
  gradeLevelConfig,
} from 'src/sections/marketplace/admin/server/lookup-master';

export const GET = (request: Request) => listLookup(request, gradeLevelConfig);
export const POST = (request: Request) => createLookup(request, gradeLevelConfig);
