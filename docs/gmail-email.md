# ส่งอีเมลผ่าน Gmail

ระบบรองรับ `EMAIL_PROVIDER=gmail` สำหรับส่งจากบัญชี Gmail โดยตรง และใช้บัญชีเดียวกันรับคำตอบกลับ รองรับทุกจุดที่เรียก `sendEmail` เดิม รวม OTP และอีเมลเตือนร้านค้า

ตั้งค่าในไฟล์ environment ของเครื่อง และ Vercel Production ก่อน redeploy:

```dotenv
EMAIL_PROVIDER=gmail
GMAIL_USER=ekru.team@gmail.com
GMAIL_APP_PASSWORD=
EMAIL_REPLY_TO=ekru.team@gmail.com
```

สร้าง App password ของบัญชีนี้ที่ https://myaccount.google.com/apppasswords หลังเปิดการยืนยันสองขั้นตอน ใช้ App password แทนรหัสผ่านปกติ และห้าม commit หรือส่งรหัสในแชต

ส่งผ่าน `smtp.gmail.com:465` ด้วย TLS และตรวจว่าผู้ให้บริการยอมรับผู้รับก่อนแจ้งสำเร็จ ไม่มีการส่งซ้ำผ่าน Resend เมื่อ Gmail ล้มเหลว เพื่อป้องกันอีเมลซ้ำหรือเปลี่ยนผู้ส่งโดยไม่ตั้งใจ การรับคำขอของ SMTP ยังไม่ยืนยันว่าอีเมลเข้ากล่องหลัก

ทดสอบด้วยปุ่ม “ส่งอีเมลทดสอบ” ที่ `/dashboard/seller-accounts` โดยระบุอีเมลที่เข้าถึงได้ ตรวจทั้งกล่องหลักและสแปม และตรวจว่ากดตอบกลับแล้วไปยังบัญชีที่ตั้งไว้

หากต้องการกลับไปใช้ Resend ให้ตั้ง `EMAIL_PROVIDER=resend` และคง `RESEND_API_KEY`, `RESEND_FROM_EMAIL` ของโดเมนที่ยืนยันแล้ว อีเมล Gmail ใช้เป็น `RESEND_FROM_EMAIL` ไม่ได้

การตั้งรูปบัญชี Google ไม่ได้รับประกันว่ารูปจะปรากฏให้ผู้รับทุกคน ขึ้นกับ Gmail และ cache ของผู้รับ รวมถึงการตั้งค่ารูปโปรไฟล์

อ้างอิง: https://support.google.com/mail/answer/185833 และ https://nodemailer.com/guides/using-gmail
