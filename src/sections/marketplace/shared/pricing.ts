type PriceLike = {
  price: number | string;
  list_price?: number | string | null;
};

export function getMarketplacePricing(product: PriceLike) {
  const salePrice = Math.max(0, Number(product.price) || 0);
  const rawListPrice = Number(product.list_price);
  const listPrice =
    Number.isFinite(rawListPrice) && rawListPrice > salePrice ? rawListPrice : salePrice;
  const discountAmount = Math.max(0, listPrice - salePrice);
  const discountPercent =
    listPrice > 0 && discountAmount > 0 ? Math.round((discountAmount / listPrice) * 100) : 0;

  return {
    salePrice,
    listPrice,
    discountAmount,
    discountPercent,
    hasDiscount: discountAmount > 0,
  };
}
