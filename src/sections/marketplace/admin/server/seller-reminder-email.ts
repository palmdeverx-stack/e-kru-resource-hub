import 'server-only';

const STEPS = ['ข้อมูลร้านค้า', 'ข้อมูลผู้ขาย', 'บัญชีรับเงิน', 'เอกสารยืนยัน', 'ข้อตกลง'];

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!
  );
}

export function buildSellerReminderEmail(input: {
  shopName: string;
  recipientName: string;
  step: number;
  origin: string;
}) {
  const step = Math.min(5, Math.max(1, Math.floor(input.step) || 1));
  const actionUrl = new URL(`/dashboard/seller/profile/edit?step=${step}`, input.origin).href;
  const logoUrl = new URL('/logo/logo-email.png', input.origin).href;
  const subject = 'แก้ไขปัญหาเรียบร้อยแล้ว — กลับมาดำเนินการเปิดร้านบน E-KRU ได้อีกครั้ง';
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"></head><body style="margin:0;background:#f4f6f8;font-family:Tahoma,Arial,sans-serif;color:#1c252e">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:16px;padding:32px">
    <a href="${escapeHtml(new URL('/', input.origin).href)}" style="display:inline-block;text-decoration:none"><img src="${escapeHtml(logoUrl)}" alt="E-KRU Marketplace" width="180" height="87" style="display:block;width:180px;max-width:100%;height:auto;border:0"></a>
    <h1 style="font-size:24px;line-height:1.5;margin:24px 0 12px">ระบบพร้อมให้คุณกลับมาเปิดร้านแล้ว</h1>
    <p style="line-height:1.8">สวัสดีคุณ ${escapeHtml(input.recipientName || 'ผู้ขาย')}</p>
    <p style="line-height:1.8">ทีมงาน E-KRU Marketplace ขออภัยในความไม่สะดวกจากปัญหาที่ท่านพบระหว่างดำเนินการเปิดร้าน <strong>${escapeHtml(input.shopName)}</strong></p>
    <p style="line-height:1.8">ขณะนี้ทีมงานได้แก้ไขปัญหาดังกล่าวเรียบร้อยแล้ว ท่านสามารถกลับมาดำเนินการเปิดร้านต่อได้ โดยตรวจสอบข้อมูลที่บันทึกไว้ กรอกส่วนที่เหลือ และส่งคำขอให้ผู้ดูแลตรวจสอบอีกครั้ง</p>
    <div style="padding:16px;background:#edf5ff;border-radius:12px;line-height:1.8">ขั้นตอนที่บันทึกล่าสุด: <strong>${step}/5 — ${STEPS[step - 1]}</strong></div>
    <p style="line-height:1.8;color:#637381">กรอกข้อมูลร้านค้า ข้อมูลผู้ขาย และบัญชีรับเงินให้ครบ พร้อมอ่านและยอมรับข้อตกลง ส่วนโลโก้ รูปปก และเอกสารเพิ่มเติมสามารถเว้นไว้ก่อนได้</p>
    <p style="margin:28px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#1565f5;color:#fff;padding:14px 24px;border-radius:8px;text-decoration:none">กลับมาดำเนินการเปิดร้านต่อ</a></p>
    <p style="font-size:12px;line-height:1.8;color:#637381">หากปุ่มเปิดไม่ได้ ให้คัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:<br><a href="${escapeHtml(actionUrl)}">${escapeHtml(actionUrl)}</a></p>
    <p style="line-height:1.8">ขอบคุณที่ให้โอกาสเราได้ดูแลร้านค้าของท่าน และขออภัยในความไม่สะดวกอีกครั้งครับ<br>ทีมงาน E-KRU Marketplace</p>
    <hr style="border:0;border-top:1px solid #e5e8eb;margin:24px 0">
    <p style="font-size:12px;line-height:1.8;color:#919eab">อีเมลแจ้งเตือนจากผู้ดูแล E-KRU Marketplace สำหรับการดำเนินการเปิดร้านของคุณ หากคุณดำเนินการแล้ว สามารถละเว้นอีเมลนี้ได้</p>
  </div></body></html>`;
  return { subject, html, actionUrl };
}
