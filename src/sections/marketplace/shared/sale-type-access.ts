export function isSubscriptionSaleType(saleType: { code?: string | null; name?: string | null }) {
  return /subscription/i.test(saleType.code ?? '') || /subscription/i.test(saleType.name ?? '');
}
