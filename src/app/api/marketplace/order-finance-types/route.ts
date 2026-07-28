import {
  listLookup,
  createLookup,
  orderFinanceTypeConfig,
} from 'src/sections/marketplace/admin/server/lookup-master';

export const GET = (request: Request) => listLookup(request, orderFinanceTypeConfig);
export const POST = (request: Request) => createLookup(request, orderFinanceTypeConfig);
