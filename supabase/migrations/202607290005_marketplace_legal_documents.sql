create table if not exists public.marketplace_legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null unique
    check (
      document_type in (
        'terms_of_service',
        'seller_agreement',
        'privacy_policy',
        'copyright_takedown',
        'refund_policy'
      )
    ),
  title text not null,
  summary text,
  content_html text not null default '<p></p>',
  provider_type text not null default 'individual'
    check (provider_type = 'individual'),
  provider_name text,
  provider_tax_id text,
  provider_address text,
  contact_email text,
  version text not null default '1.0',
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  effective_at timestamptz,
  published_at timestamptz,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_legal_documents_status_idx
  on public.marketplace_legal_documents (status, document_type);

insert into public.marketplace_legal_documents (
  document_type,
  title,
  summary,
  content_html
)
values
  (
    'terms_of_service',
    'ข้อกำหนดการใช้บริการ E-KRU Marketplace',
    'ข้อกำหนดสำหรับผู้ใช้งาน ผู้ซื้อ และผู้เยี่ยมชม Marketplace',
    '<h2>1. ขอบเขตการให้บริการ</h2><p>กรุณาระบุขอบเขต สิทธิ และหน้าที่ของผู้ใช้งาน E-KRU Marketplace</p><h2>2. บัญชีผู้ใช้</h2><p>กรุณาระบุเงื่อนไขการสมัคร การรักษาความปลอดภัย และการระงับบัญชี</p><h2>3. การซื้อสินค้า</h2><p>กรุณาระบุเงื่อนไขการสั่งซื้อ การชำระเงิน และสิทธิการใช้งาน</p>'
  ),
  (
    'seller_agreement',
    'ข้อตกลงการเป็นผู้ขาย E-KRU Marketplace',
    'หน้าที่ มาตรฐาน ค่าธรรมเนียม และรอบจ่ายเงินสำหรับผู้ขาย',
    '<h2>1. คุณสมบัติผู้ขาย</h2><p>กรุณาระบุคุณสมบัติและเอกสารที่ใช้ยืนยันตัวตน</p><h2>2. การลงสินค้า</h2><p>กรุณาระบุมาตรฐานสินค้า สิทธิในทรัพย์สินทางปัญญา และขั้นตอนอนุมัติ</p><h2>3. ค่าธรรมเนียมและการจ่ายเงิน</h2><p>กรุณาระบุค่าคอมมิชชัน ค่าธรรมเนียมช่องทางชำระเงิน และรอบโอนเงิน</p>'
  ),
  (
    'privacy_policy',
    'นโยบายความเป็นส่วนตัว (PDPA)',
    'การเก็บ ใช้ เปิดเผย และคุ้มครองข้อมูลส่วนบุคคล',
    '<h2>1. ผู้ควบคุมข้อมูลส่วนบุคคล</h2><p>กรุณาระบุชื่อบุคคลผู้ให้บริการและช่องทางติดต่อ</p><h2>2. ข้อมูลที่เก็บรวบรวม</h2><p>กรุณาระบุประเภทข้อมูล วัตถุประสงค์ และฐานกฎหมาย</p><h2>3. สิทธิของเจ้าของข้อมูล</h2><p>กรุณาระบุวิธีขอเข้าถึง แก้ไข ลบ คัดค้าน หรือถอนความยินยอม</p>'
  ),
  (
    'copyright_takedown',
    'นโยบายลิขสิทธิ์และการนำเนื้อหาออก',
    'กระบวนการแจ้งละเมิดลิขสิทธิ์ ตรวจสอบ และนำเนื้อหาออก',
    '<h2>1. การเคารพลิขสิทธิ์</h2><p>ผู้ขายต้องมีสิทธิในเนื้อหาและไฟล์ที่นำมาจำหน่าย</p><h2>2. การแจ้งละเมิด</h2><p>กรุณาระบุข้อมูลและหลักฐานที่ผู้ร้องต้องส่ง</p><h2>3. การตรวจสอบและนำออก</h2><p>กรุณาระบุกรอบเวลา การระงับสินค้า และสิทธิชี้แจงของผู้ขาย</p>'
  ),
  (
    'refund_policy',
    'นโยบายการคืนเงิน',
    'เงื่อนไขและขั้นตอนขอคืนเงินสำหรับสินค้าดิจิทัลและ License',
    '<h2>1. สินค้าที่ขอคืนเงินได้</h2><p>กรุณาระบุกรณีไฟล์เสีย สื่อไม่ตรงรายละเอียด หรือไม่สามารถใช้งานได้</p><h2>2. ระยะเวลายื่นคำขอ</h2><p>กรุณาระบุจำนวนวันและหลักฐานที่ต้องใช้</p><h2>3. วิธีคืนเงิน</h2><p>กรุณาระบุระยะเวลาดำเนินการและช่องทางคืนเงิน</p>'
  )
on conflict (document_type) do nothing;

alter table public.marketplace_legal_documents enable row level security;
