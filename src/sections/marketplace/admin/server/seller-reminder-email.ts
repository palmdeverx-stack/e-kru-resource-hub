import 'server-only';

const EMAIL_ORIGIN = 'https://e-kru-marketplace.com';

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
  preview?: boolean;
}) {
  const step = Math.min(5, Math.max(1, Math.floor(input.step) || 1));
  const actionUrl = new URL(`/dashboard/seller/profile/edit?step=${step}`, EMAIL_ORIGIN).href;
  const logoUrl = input.preview
    ? '/logo/logo-email.png?v=marketplace-20261113'
    : new URL('/logo/logo-email.png', EMAIL_ORIGIN).href;
  const subject = 'แก้ไขปัญหาเรียบร้อยแล้ว — กลับมาดำเนินการเปิดร้านบน E-KRU ได้อีกครั้ง';
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
  @font-face{font-family:'LINE Seed Sans TH';font-style:normal;font-weight:400;src:url('https://e-kru-marketplace.com/fonts/LINESeedSansTH-Regular.woff2') format('woff2')}
  @font-face{font-family:'LINE Seed Sans TH';font-style:normal;font-weight:700;src:url('https://e-kru-marketplace.com/fonts/LINESeedSansTH-Bold.woff2') format('woff2')}
  </style></head><body style="margin:0;background:#f4f6f8;font-family:'LINE Seed Sans TH',Tahoma,Arial,sans-serif;color:#1c252e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f8"><tr><td align="center" style="padding:16px 12px;vertical-align:top">
  <div style="font-family:'LINE Seed Sans TH',Tahoma,Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:20px;text-align:center">
    <a href="${escapeHtml(new URL('/', EMAIL_ORIGIN).href)}" style="display:inline-block;text-decoration:none"><img src="${escapeHtml(logoUrl)}" alt="E-KRU Marketplace" width="128" height="119" style="display:block;width:128px;max-width:100%;height:auto;border:0"></a>
    <h1 style="font-size:22px;line-height:1.45;margin:14px 0 10px">ระบบพร้อมให้คุณกลับมาเปิดร้านแล้ว</h1>
    <p style="font-size:14px;line-height:1.75;margin:10px 0">สวัสดีคุณ ${escapeHtml(input.recipientName || 'ผู้ขาย')}</p>
    <p style="font-size:14px;line-height:1.75;margin:10px 0">ทีมงานขออภัยในความไม่สะดวกที่เกิดขึ้นกับร้าน <strong>${escapeHtml(input.shopName)}</strong></p>
    <p style="font-size:14px;line-height:1.75;margin:10px 0">ทีมงาน E-KRU Marketplace ได้แก้ไขปัญหาดังกล่าวเรียบร้อยแล้ว คุณสามารถตรวจสอบข้อมูลเดิม กรอกส่วนที่เหลือ และส่งคำขอเปิดร้านให้ผู้ดูแลตรวจสอบได้อีกครั้ง</p>
    <div style="padding:12px;margin:14px 0;background:#edf5ff;border-radius:10px;font-size:14px;line-height:1.6">ขั้นตอนที่บันทึกล่าสุด: <strong>${step}/5 — ${STEPS[step - 1]}</strong></div>
    <p style="margin:20px 0 14px"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#1565f5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">ดำเนินการเปิดร้านต่อ</a></p>
    <p style="font-size:11px;line-height:1.6;color:#637381;margin:10px 0;overflow-wrap:anywhere;word-break:break-word">หากเปิดปุ่มไม่ได้ ใช้ลิงก์นี้:<br><a href="${escapeHtml(actionUrl)}">${escapeHtml(actionUrl)}</a></p>
    <p style="font-size:14px;line-height:1.75;margin:10px 0">ขอบคุณที่ร่วมเป็นส่วนหนึ่งของ E-KRU Marketplace<br>ทีมงาน E-KRU</p>
    <hr style="border:0;border-top:1px solid #e5e8eb;margin:16px 0 12px">
    <p style="font-size:11px;line-height:1.6;color:#919eab;margin:0">อีเมลแจ้งเตือนการเปิดร้านจาก E-KRU Marketplace<br>หากดำเนินการแล้ว สามารถละเว้นอีเมลนี้ได้</p>
  </div></td></tr></table></body></html>`;
  return { subject, html, actionUrl };
}
