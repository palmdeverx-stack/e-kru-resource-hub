import { MarketplaceLookupManagementView } from './lookup-management-view';

export function MarketplaceMediaReviewRuleManagementView() {
  return (
    <MarketplaceLookupManagementView
      title="การตรวจสอบสื่อ"
      description="จัดการเกณฑ์ที่ผู้ดูแลใช้ตรวจคุณภาพ ความปลอดภัย และสิทธิ์ของสื่อ"
      endpoint="/api/marketplace/media-review-rules"
      behaviorKey="review_scope"
      behaviorLabel="ด้านที่ตรวจสอบ"
      behaviorOptions={[
        { value: 'content', label: 'เนื้อหาและคุณภาพ' },
        { value: 'file', label: 'ไฟล์และความปลอดภัย' },
        { value: 'rights', label: 'ลิขสิทธิ์และสิทธิ์ใช้งาน' },
      ]}
    />
  );
}
