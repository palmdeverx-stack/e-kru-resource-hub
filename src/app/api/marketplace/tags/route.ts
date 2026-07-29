import { tagConfig, listLookup, createLookup } from 'src/sections/marketplace/admin/server/lookup-master';

export const GET = (request: Request) => listLookup(request, tagConfig);
export const POST = (request: Request) => createLookup(request, tagConfig);
