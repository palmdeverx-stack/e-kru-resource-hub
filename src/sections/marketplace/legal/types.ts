export const LEGAL_DOCUMENT_TYPES = [
  'terms_of_service',
  'seller_agreement',
  'privacy_policy',
  'copyright_takedown',
  'refund_policy',
  'cookie_policy',
  'digital_product_license',
  'payment_payout_policy',
  'product_content_policy',
  'complaint_dispute_policy',
  'child_data_policy',
  'data_processing_agreement',
  'subscription_policy',
  'product_submission_terms',
] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export type MarketplaceLegalDocument = {
  id: string;
  document_type: LegalDocumentType;
  title: string;
  summary: string | null;
  content_html: string;
  provider_type: 'individual' | 'company';
  provider_name: string | null;
  provider_registration_no?: string | null;
  provider_tax_id: string | null;
  provider_address: string | null;
  contact_email: string | null;
  provider_phone?: string | null;
  version: string;
  status: 'draft' | 'published';
  effective_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export const LEGAL_DOCUMENT_LABELS: Record<LegalDocumentType, string> = {
  terms_of_service: 'Terms of Service',
  seller_agreement: 'Seller Agreement',
  privacy_policy: 'Privacy Policy (PDPA)',
  copyright_takedown: 'Copyright & Takedown Policy',
  refund_policy: 'Refund Policy',
  cookie_policy: 'Cookie Policy',
  digital_product_license: 'Digital Product License',
  payment_payout_policy: 'Payment, Fees & Seller Payout Policy',
  product_content_policy: 'Product & Content Policy',
  complaint_dispute_policy: 'Complaint & Dispute Resolution Policy',
  child_data_policy: 'Child & Student Data Policy',
  data_processing_agreement: 'Data Processing Agreement (DPA)',
  subscription_policy: 'Subscription & Renewal Policy',
  product_submission_terms: 'เงื่อนไขการเผยแพร่สินค้า',
};

export const LEGAL_DOCUMENT_USAGE: Record<LegalDocumentType, string> = {
  terms_of_service: 'สมัครสมาชิก, เข้าสู่ระบบครั้งแรก และ Checkout',
  seller_agreement: 'สมัครเปิดร้านและข้อตกลงผู้ขาย',
  privacy_policy: 'สมัครสมาชิก, ผู้ซื้อ, ผู้ขาย และแบบฟอร์มเก็บข้อมูล',
  copyright_takedown: 'สมัครผู้ขาย, ลงสินค้า และรับเรื่องร้องเรียนลิขสิทธิ์',
  refund_policy: 'Checkout, รายการซื้อ และคำขอคืนเงิน',
  cookie_policy: 'แถบยินยอมคุกกี้, ตั้งค่าคุกกี้ และ Footer',
  digital_product_license: 'หน้าสินค้า, Checkout และคลังสินค้าที่ซื้อแล้ว',
  payment_payout_policy: 'Checkout, รายได้ผู้ขาย, ค่าธรรมเนียม และรอบโอน',
  product_content_policy: 'สร้าง/แก้ไขสินค้า และขั้นตอนอนุมัติสินค้า',
  complaint_dispute_policy: 'แจ้งปัญหา, Chargeback, ข้อพิพาท และอุทธรณ์',
  child_data_policy: 'ข้อมูลนักเรียน ห้องเรียน โรงเรียน และสื่อการสอน',
  data_processing_agreement: 'โรงเรียน/องค์กร และผู้ให้บริการประมวลผลข้อมูล',
  subscription_policy: 'แพ็กเกจ ฟีเจอร์เสริม การต่ออายุ และยกเลิกบริการ',
  product_submission_terms: 'หน้าสร้าง/แก้ไขสินค้า และก่อนส่งสินค้าเผยแพร่',
};
