import { MarketplaceLookupManagementView } from './lookup-management-view';

export function MarketplaceTagManagementView() {
  return (
    <MarketplaceLookupManagementView
      title="แท็ก"
      description="จัดการรายการแท็กสำหรับติดป้ายกำกับสินค้า"
      endpoint="/api/marketplace/tags"
    />
  );
}
