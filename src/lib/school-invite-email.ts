import 'server-only';

import { sendEmail } from 'src/lib/resend';

// ----------------------------------------------------------------------

export async function sendSchoolInviteEmail(params: {
  to: string;
  schoolName: string;
  schoolCode: string;
  adminUsername: string;
  adminPassword: string;
  signInUrl: string;
}): Promise<void> {
  const { to, schoolName, schoolCode, adminUsername, adminPassword, signInUrl } = params;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="margin-bottom: 4px;">ยินดีต้อนรับสู่ระบบ eKru</h2>
      <p style="color: #555;">โรงเรียน <b>${schoolName}</b> (รหัสโรงเรียน ${schoolCode}) ถูกสร้างเรียบร้อยแล้ว</p>
      <p style="color: #555;">ใช้ข้อมูลด้านล่างนี้เพื่อเข้าสู่ระบบครั้งแรกในฐานะผู้ดูแลโรงเรียน:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 0; color: #888;">ชื่อผู้ใช้งาน</td>
          <td style="padding: 8px 0; font-family: monospace; font-size: 15px;">${adminUsername}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #888;">รหัสผ่านชั่วคราว</td>
          <td style="padding: 8px 0; font-family: monospace; font-size: 15px;">${adminPassword}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #888;">รหัสโรงเรียน (PIN)</td>
          <td style="padding: 8px 0; font-family: monospace; font-size: 15px;">${schoolCode}</td>
        </tr>
      </table>
      <p style="color: #555;">ระบบจะให้เปลี่ยนรหัสผ่านทันทีที่เข้าสู่ระบบครั้งแรก</p>
      <p style="margin: 24px 0;">
        <a href="${signInUrl}" style="background: #1976D2; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
          เข้าสู่ระบบ
        </a>
      </p>
      <p style="color: #999; font-size: 13px;">หากไม่ได้เป็นผู้ดำเนินการนี้ กรุณาติดต่อผู้ดูแลระบบ</p>
    </div>
  `;

  await sendEmail({
    to,
    subject: `เชิญเข้าใช้งานระบบ eKru — โรงเรียน${schoolName}`,
    html,
  });
}
