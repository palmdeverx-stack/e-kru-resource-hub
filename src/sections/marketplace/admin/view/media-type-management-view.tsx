import { MarketplaceLookupManagementView } from './lookup-management-view';

export function MarketplaceMediaTypeManagementView() {
  return (
    <MarketplaceLookupManagementView
      title="ประเภทสื่อ"
      description="จัดการชนิดสื่อและลักษณะการส่งมอบให้ผู้ซื้อ"
      endpoint="/api/marketplace/media-types"
      behaviorKey="delivery_mode"
      behaviorLabel="รูปแบบการส่งมอบ"
      behaviorOptions={[
        { value: 'digital', label: 'ดาวน์โหลดไฟล์ดิจิทัล' },
        { value: 'physical', label: 'สินค้าจัดส่ง' },
        { value: 'service', label: 'บริการ / คอร์ส' },
      ]}
    />
  );
}
