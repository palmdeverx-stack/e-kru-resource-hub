import { MarketplaceLookupManagementView } from './lookup-management-view';

export function MarketplaceGradeLevelManagementView() {
  return (
    <MarketplaceLookupManagementView
      title="ระดับชั้น"
      description="จัดการรายการระดับชั้นสำหรับกำหนดกลุ่มเป้าหมายของสินค้า"
      endpoint="/api/marketplace/grade-levels"
    />
  );
}
