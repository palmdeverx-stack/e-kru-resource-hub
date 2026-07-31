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
      'cookie_policy',
      'digital_product_license',
      'payment_payout_policy',
      'product_content_policy',
      'complaint_dispute_policy',
      'child_data_policy',
      'data_processing_agreement',
      'subscription_policy',
      'product_submission_terms'
    )
  );

insert into public.marketplace_legal_documents (
  document_type,
  title,
  summary,
  content_html,
  status,
  version
)
values (
  'product_submission_terms',
  'เงื่อนไขการเผยแพร่สินค้า',
  'หลักเกณฑ์ด้านสิทธิ ความถูกต้องของข้อมูล และการตรวจสอบร่วมกันก่อนเผยแพร่สินค้า',
  '<ul><li>ผู้ขายมีสิทธิหรือได้รับอนุญาตให้เผยแพร่และจำหน่ายข้อความ รูปภาพ วิดีโอ เสียง ฟอนต์ แบบฝึกหัด และไฟล์ที่ใช้ในสินค้า</li><li>เนื้อหาสินค้าเป็นไปตามหลักเกณฑ์ด้านลิขสิทธิ์ เครื่องหมายการค้า สิทธิส่วนบุคคล และการคุ้มครองข้อมูลเด็ก นักเรียน หรือบุคคลอื่น</li><li>รายละเอียด ราคา เงื่อนไขการใช้งาน และสิ่งที่ผู้ซื้อจะได้รับแสดงไว้อย่างถูกต้องและครบถ้วน</li><li>หากมีข้อสงสัยหรือข้อร้องเรียน แพลตฟอร์มและผู้ขายจะร่วมกันตรวจสอบข้อมูลและดำเนินการตามนโยบายที่เกี่ยวข้อง</li></ul>',
  'draft',
  '1.0'
)
on conflict (document_type) do nothing;
