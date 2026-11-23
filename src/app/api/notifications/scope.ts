// These events are copied to administrators for platform operations.
const marketplaceBroadcastTypes = [
  'marketplace_member_registered',
  'marketplace_seller_request',
  'marketplace_product_approval',
  'marketplace_payout_due',
  'marketplace_payment_dispute_admin',
  'marketplace_school_license_created',
  'marketplace_user_license_created',
];

export function filterPersonalNotifications<
  Query extends {
    not: (column: string, operator: string, value: string) => Query;
    like: (column: string, pattern: string) => Query;
  },
>(query: Query, request: Request): Query {
  const personal = query.not('type', 'in', `(${marketplaceBroadcastTypes.join(',')})`);
  return new URL(request.url).searchParams.get('scope') === 'marketplace'
    ? personal.like('type', 'marketplace\\_%')
    : personal;
}
