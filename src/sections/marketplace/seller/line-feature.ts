export const MARKETPLACE_SELLER_LINE_FEATURE = {
  key: 'marketplace.seller_line_notifications',
  group: 'Marketplace ผู้ขาย',
  label: 'LINE แจ้งเตือนยอดขาย',
  description: 'รับข้อความ LINE เมื่อระบบยืนยันการชำระเงินจากผู้ซื้อ',
} as const;

export const MARKETPLACE_SELLER_LINE_FEATURE_KEY = MARKETPLACE_SELLER_LINE_FEATURE.key;

export const MARKETPLACE_SELLER_LINE_MANAGED_FEATURE = {
  key: 'marketplace.seller_line_managed',
  group: 'Marketplace ผู้ขาย',
  label: 'LINE แจ้งเตือนผ่านระบบ E-KRU',
  description: 'ใช้ LINE OA ของระบบและหักโควต้าเมื่อส่งข้อความสำเร็จ',
} as const;

export const MARKETPLACE_SELLER_LINE_MANAGED_FEATURE_KEY =
  MARKETPLACE_SELLER_LINE_MANAGED_FEATURE.key;
