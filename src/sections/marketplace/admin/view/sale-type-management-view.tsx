import { MarketplaceLookupManagementView } from './lookup-management-view';

export function MarketplaceSaleTypeManagementView() {
  return (
    <MarketplaceLookupManagementView
      title="ประเภทการจำหน่าย"
      description="จัดการรูปแบบราคาและการจำหน่ายสินค้า"
      endpoint="/api/marketplace/sale-types"
      behaviorKey="pricing_mode"
      behaviorLabel="รูปแบบราคา"
      behaviorOptions={[
        { value: 'free', label: 'ฟรี (ราคา 0 บาท)' },
        { value: 'paid', label: 'มีค่าใช้จ่าย' },
      ]}
    />
  );
}
