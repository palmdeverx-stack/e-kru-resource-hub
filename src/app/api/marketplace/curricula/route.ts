import {
  listLookup,
  createLookup,
  curriculumConfig,
} from 'src/sections/marketplace/admin/server/lookup-master';

export const GET = (request: Request) => listLookup(request, curriculumConfig);
export const POST = (request: Request) => createLookup(request, curriculumConfig);
