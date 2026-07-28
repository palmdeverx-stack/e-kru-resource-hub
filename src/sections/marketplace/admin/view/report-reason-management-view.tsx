import { MarketplaceLookupManagementView } from './lookup-management-view';

export function MarketplaceReportReasonManagementView() {
  return (
    <MarketplaceLookupManagementView
      title="รีวิวและรายงาน"
      description="จัดการเหตุผลที่สมาชิกใช้รายงานสินค้า รีวิว หรือผู้ขาย"
      endpoint="/api/marketplace/report-reasons"
      behaviorKey="reason_scope"
      behaviorLabel="ใช้รายงาน"
      behaviorOptions={[
        { value: 'product', label: 'สินค้าและสื่อ' },
        { value: 'review', label: 'รีวิว' },
        { value: 'seller', label: 'ผู้ขายหรือร้านค้า' },
      ]}
    />
  );
}
