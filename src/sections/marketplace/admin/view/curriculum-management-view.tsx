import { MarketplaceLookupManagementView } from './lookup-management-view';

export function MarketplaceCurriculumManagementView() {
  return (
    <MarketplaceLookupManagementView
      title="หลักสูตร"
      description="จัดการรายการหลักสูตรที่ใช้อ้างอิงในสินค้า"
      endpoint="/api/marketplace/curricula"
    />
  );
}
