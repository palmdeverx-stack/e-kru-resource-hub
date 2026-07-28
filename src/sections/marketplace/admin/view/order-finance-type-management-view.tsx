import { MarketplaceLookupManagementView } from './lookup-management-view';

export function MarketplaceOrderFinanceTypeManagementView() {
  return (
    <MarketplaceLookupManagementView
      title="คำสั่งซื้อและการเงิน"
      description="จัดการรายการอ้างอิงสำหรับคำสั่งซื้อ การชำระเงิน และการจ่ายเงินผู้ขาย"
      endpoint="/api/marketplace/order-finance-types"
      behaviorKey="finance_scope"
      behaviorLabel="กลุ่มงาน"
      behaviorOptions={[
        { value: 'order', label: 'คำสั่งซื้อ' },
        { value: 'payment', label: 'การชำระเงิน' },
        { value: 'finance', label: 'การเงินและการจ่ายเงิน' },
      ]}
    />
  );
}
