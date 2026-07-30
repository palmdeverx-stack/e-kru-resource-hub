alter table public.marketplace_legal_documents
  drop constraint if exists marketplace_legal_documents_document_type_check;

alter table public.marketplace_legal_documents
  add constraint marketplace_legal_documents_document_type_check
  check (
    document_type in (
      'terms_of_service',
      'seller_agreement',
      'privacy_policy',
      'copyright_takedown',
      'refund_policy',
      'cookie_policy'
    )
  );

insert into public.marketplace_legal_documents (
  document_type,
  title,
  summary,
  content_html
)
values (
  'cookie_policy',
  'นโยบายคุกกี้ E-KRU Marketplace',
  'อธิบายการใช้คุกกี้และเทคโนโลยีจัดเก็บข้อมูลบนอุปกรณ์ของผู้ใช้',
  '<h2>1. คุกกี้ที่จำเป็น</h2><p>ระบบใช้คุกกี้สำหรับการเข้าสู่ระบบ ความปลอดภัย การตั้งค่าหน้าจอ และการจดจำตัวเลือกคุกกี้</p><h2>2. การจัดเก็บข้อมูลบนอุปกรณ์</h2><p>ระบบอาจจัดเก็บตะกร้าสินค้า การปิดประกาศ และตัวระบุการเข้าชมไว้บนอุปกรณ์เพื่อให้บริการและปรับปรุงประสบการณ์ใช้งาน</p><h2>3. การจัดการตัวเลือก</h2><p>ผู้ใช้สามารถเลือกเฉพาะคุกกี้ที่จำเป็นหรือยอมรับทั้งหมด และกลับมาเปลี่ยนตัวเลือกได้จากส่วนท้ายของเว็บไซต์</p>'
)
on conflict (document_type) do nothing;
