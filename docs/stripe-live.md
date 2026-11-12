# Stripe Live — E-KRU Marketplace

## บัญชีและรูปแบบการรับชำระ

ระบบรับเงินเข้าบัญชี Stripe ของแพลตฟอร์มโดยตรงผ่าน Hosted Checkout ไม่ได้ใช้ Stripe Connect
ค่าบนเครื่องตรวจผ่านเมื่อ 12 พฤศจิกายน 2026:

- บัญชีใหม่ `EKRU`, Account ID `acct_1UapEdELxlGkW0Q8`, ประเทศ TH
- Restricted Live key (`rk_live_`) ตรวจผ่านกับ Stripe API และ Account ID ตรงกัน
- `charges_enabled` และ `payouts_enabled` เป็น true ไม่มี requirement ที่ถึงกำหนดค้าง
- ไม่มีการสร้าง Checkout/PaymentIntent เรียกเก็บเงิน หรือเปลี่ยนบัญชีธนาคารระหว่างตรวจ

## Environment ที่เจ้าของระบบต้องตั้งบน Vercel

เจ้าของระบบเลือกดำเนินการ Vercel environment เอง ยังไม่มีการเปลี่ยนค่าบน Vercelจากงานนี้
ตั้งค่าต่อไปนี้เฉพาะ **Production** โดยใช้ค่าจริงจากไฟล์ environment บนเครื่อง:

```env
STRIPE_MODE=live
STRIPE_ACCOUNT_ID=acct_1UapEdELxlGkW0Q8
STRIPE_SECRET_KEY=rk_live_REPLACE_WITH_YOUR_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_REPLACE_WITH_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_LIVE_ENDPOINT_SECRET
```

- สองค่าลับ `STRIPE_SECRET_KEY` และ `STRIPE_WEBHOOK_SECRET` เก็บแบบ Secret/Sensitive
- Publishable key เปิดเผยใน client bundle ได้ แต่ต้องมาจากบัญชีและโหมดเดียวกัน
- Preview/Development ใช้ Test keys และ Test webhook ของตัวเอง
- ตัวแปร Stripe เดิมบน Vercel ใช้ร่วม Production/Preview จึงต้องแยก scope ก่อนเปลี่ยนค่า
  เช่น เก็บตัวแปรเดิมไว้เฉพาะ Preview แล้วสร้างตัวแปรชื่อเดียวกันสำหรับ Production
- ไม่ใส่ Secret key ในตัวแปร `NEXT_PUBLIC_` ไม่ commit `.env` และไม่ส่ง key ในแชต
- ต้องสร้าง deployment ใหม่หลังเปลี่ยน environment ค่าใน deployment ที่รันอยู่จะไม่เปลี่ยนเอง
- Production ใหม่จะไม่เปิด Stripe ถ้าใช้ Test key หรือ Live key ไม่ระบุ mode/account ให้ครบ

## Live webhook

มี endpoint เดิมอยู่แล้ว ไม่ต้องสร้างซ้ำ:

- URL: `https://e-kru-marketplace.com/api/stripe/webhook`
- Endpoint ID: `we_1UapZiELxlGkW0Q8iQAChksM`
- Snapshot payload/API version: `2026-08-26.dahlia`
- Stripe SDK ปัจจุบันใช้ `2026-06-24.dahlia`; endpoint เป็น release ใหม่ในตระกูล Dahlia เดียวกัน
  ยังต้องตรวจ signed delivery และ workflow จริงหลัง deploy
- Signing secret ต้องคัดลอกจาก endpoint นี้ใน Live mode ไม่ใช้ค่าของ Stripe CLI หรือ Test endpoint

ตรวจ event subscriptions ในบัญชีใหม่แล้ว ครบ 15 events ที่ handler รองรับ ไม่มีรายการขาดหรือเกิน:

```text
checkout.session.completed
checkout.session.expired
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
payment_intent.payment_failed
charge.refunded
invoice.paid
invoice.payment_failed
customer.subscription.updated
customer.subscription.deleted
charge.dispute.created
charge.dispute.updated
charge.dispute.closed
charge.dispute.funds_withdrawn
charge.dispute.funds_reinstated
```

บัญชีเดิมและ webhook เดิมยังไม่ได้ลบหรือแก้ไขในรอบย้ายบัญชีนี้
ไม่ใช้ Signing secret ของบัญชีเดิมกับบัญชีใหม่

## การป้องกันในโค้ด

- `checkout/server/stripe.ts` ตรวจรูปแบบ key, mode และ expected account โดยไม่แสดงค่าลับใน diagnostics
- ก่อนสร้างคำสั่งชำระเงิน/เปิดใช้งาน Stripe ตรวจบัญชีจริงและความพร้อมรับเงิน
  การอ่านบัญชีรวม concurrent requests และ cache ไม่เกิน 60 วินาที; เมื่อเปลี่ยน key จะล้าง cache
- Webhook ตรวจลายเซ็นจาก raw body แล้วปฏิเสธ event ต่างโหมดหรือ Connect event ก่อนแตะข้อมูล
- Customer ของ Subscription เก่าต้องตรวจในบัญชี/โหมดปัจจุบันก่อนนำกลับมาใช้
  ถ้าเป็นของ Test หรือไม่มีในบัญชีนี้ ให้ Checkout สร้าง Customer ใหม่ตาม workflow เดิม
  ความผิดพลาดด้าน network/permission ไม่ถูกตีความเป็น Customer หาย
- Billing portal และการเปลี่ยน Subscription ตรวจบัญชี/โหมดปัจจุบันด้วย
- Email ของผู้ซื้อ Marketplace อ่านจาก `marketplace_users`; ผู้ใช้ระบบโรงเรียนอ่านจาก `app_users`
- หน้า Admin แยก Live/Test และแสดงปัญหาการตั้งค่า การมี key ไม่เท่ากับตรวจ delivery สำเร็จ

## ผลตรวจและขั้นตอนที่เหลือ

- Lint ผ่าน และชุดทดสอบผ่าน 136 ข้อ รวม 10 กรณีใหม่ของ Live configuration
- Production build ผ่าน
- ตรวจบัญชีจริงผ่าน Stripe API แบบอ่านอย่างเดียว
- Restricted key อ่าน balance, payout reporting, balance settings, customers,
  subscriptions และ billing portal configurations ได้ ไม่ได้ทดลองเขียนข้อมูลหรือเรียกเก็บเงิน
- รอบโอนจาก Stripe เป็น weekly/monday ตามที่เจ้าของบัญชีตั้งไว้
- ตรวจรูปแบบ Signing secret ผ่าน แต่ API ไม่คืน secret เดิมให้เปรียบเทียบ
  จึงยังไม่ใช่หลักฐานว่า signed delivery ไปยัง deployment สำเร็จ
- ยังไม่ได้ deploy การเปลี่ยนแปลงนี้

หลังเจ้าของระบบตั้ง Production environment และ deploy แล้ว:

1. ตรวจหน้า Admin ว่าเป็น Live, Account ID ตรง และเปิดรับชำระได้
2. ยืนยัน delivery ใน Stripe Workbench ว่า endpoint ตอบ 2xx และไม่มี signature/mode errors
3. ทดสอบซื้อ/ต่ออายุ/สิทธิ์/คืนเงินตามแผนที่ได้รับอนุญาตโดยเฉพาะ
   การทดลองเก็บเงินจริงต้องระบุสินค้าและวงเงินก่อน ไม่ใช้บัตรทดสอบใน Live
4. ตรวจอีเมลและ malware scanner ตามรายการค้างใน `production-verification.md` แยกจาก Stripe

เอกสารอ้างอิง:
- https://docs.stripe.com/keys
- https://docs.stripe.com/webhooks
