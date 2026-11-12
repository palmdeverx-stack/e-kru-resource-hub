# แนวทางทำงานของ Agent — E-KRU Resource Hub

ใช้กับทั้ง repository อ่านไฟล์นี้ก่อนเริ่มงาน และอ่านเอกสารเฉพาะส่วนเมื่อเกี่ยวข้องเท่านั้น
คำสั่งล่าสุดของผู้ใช้และข้อกำหนดของระบบ/เครื่องมือมีลำดับเหนือเอกสารนี้

## 1. ลงมือทำโดยไม่ถามซ้ำ

- ผู้ใช้ส่ง route พร้อมคำว่า “แก้”, “ปรับ”, “เช็ก”, “improve code” ให้เริ่มตรวจและทำงานกับหน้านั้น ไม่ตอบเพียงแผนหรือถามว่าจะให้ทำไหม
- งานแก้บั๊ก: หาสาเหตุ แก้ต้นเหตุ และตรวจเส้นทางใช้งานที่ได้รับผลกระทบ
- งานปรับ UI: คงพฤติกรรมและกติกาธุรกิจเดิม ใช้รูปแบบของหน้าข้างเคียง จัดหัวข้อ ปุ่ม ข้อความ และ validation ให้เข้าใจง่าย
- งาน “เช็ก”: ตรวจแบบอ่านอย่างเดียวก่อน แก้ข้อผิดพลาดเล็กน้อยที่จำเป็นในโค้ดได้ แต่การขอเช็กไม่เท่ากับอนุญาตให้ deploy หรือเปลี่ยนข้อมูลจริง
- งานหลายข้อความให้สะสมเป็นงานเดียวกัน ข้อความใหม่เป็นการปรับรายละเอียด เว้นแต่ผู้ใช้ยกเลิกหรือเปลี่ยนเป้าหมายชัดเจน
- หากรายละเอียดเล็กน้อยไม่ครบ ให้เลือกตามโค้ดและรูปแบบเดิม แจ้งสมมติฐานสั้น ๆ แล้วทำต่อ
- ค้นในโค้ด เอกสาร schema และการตั้งค่าที่เข้าถึงได้ก่อนถามผู้ใช้ อย่าถามสิ่งที่ตรวจเองได้
- ไม่ถามยืนยันซ้ำเมื่อได้รับอนุญาตแล้ว ทำส่วนที่ไม่ติดคำตอบต่อระหว่างรอข้อมูล
- หากติดข้อจำกัด ให้ระบุขั้นตอนที่ติด สาเหตุ และข้อมูลที่ต้องการอย่างเจาะจง พร้อมทำส่วนอื่นให้เสร็จ

ถามเฉพาะเมื่อความหมายต่างกันจนมีผลต่อธุรกิจ/สิทธิ์, ขาดข้อมูลที่จำเป็นจริง,
หรือขั้นตอนนั้นมีผลที่ยังไม่ได้รับอนุญาต เช่น เก็บเงินจริง เปลี่ยน Test เป็น Live,
ลบข้อมูลจริงแบบกู้คืนไม่ได้ เปลี่ยนสิทธิ์ หรือเผยแพร่ production
การแก้ไฟล์ใน workspace และการตรวจที่ย้อนกลับได้ในขอบเขตงานไม่ต้องขออนุญาตเพิ่ม
ถ้าเครื่องมือบังคับให้ผู้ใช้ทำรหัสผ่าน OTP หรือยอมรับเงื่อนไข ให้ส่งต่อเฉพาะขั้นตอนนั้น

## 2. วิธีเริ่มและจบงาน

1. อัปเดตผู้ใช้สั้น ๆ ว่าจะทำอะไร แล้วตรวจ `git status --short` และโค้ดส่วนที่เกี่ยวข้อง
2. ตาม route ใน `src/app` → view ใน `src/sections` → API → server helper → migration เมื่อเกี่ยวข้อง
3. แก้ให้ครบ UI, validation, API, สิทธิ์ และฐานข้อมูลตามผลกระทบ ไม่จำเป็นต้องแตะทุกชั้นในทุกงาน
4. ตรวจด้วยคำสั่งที่เหมาะสม แก้ failure ที่เกิดจากงานนี้ ไม่วนตรวจซ้ำโดยไม่มีเหตุ
5. สรุปภาษาไทย: เปลี่ยนอะไร ผลตรวจจริง และข้อที่ยังติด ใช้ชื่อ route/ไฟล์ให้ตรง

ระหว่างงานยาวอัปเดตความคืบหน้าเป็นช่วง ๆ อย่าปล่อยให้ผู้ใช้รอเงียบ
ห้ามอ้างว่าผ่าน E2E หรือพร้อม production จาก build/unit test เพียงอย่างเดียว
สถานะเก่าในเอกสารเป็นหลักฐาน ณ วันที่ตรวจ ต้องตรวจใหม่เมื่อสภาพแวดล้อมเปลี่ยน

## 3. เทคโนโลยีและคำสั่ง

- Next.js App Router, React, TypeScript, MUI/Emotion, React Hook Form + Zod
- Supabase: Auth, Postgres และ Storage; Stripe: checkout/webhook; Resend: อีเมล; LINE: login/แจ้งเตือน
- Node 24 ตาม `.nvmrc` และ `package.json`; Yarn Classic 1.22.22 ตาม `packageManager`
- ใช้ `yarn.lock` เป็น lockfile หลัก ไม่สร้าง `package-lock.json` หรือสลับ package manager
- ตรวจ `package.json` ก่อนใช้คำสั่ง อย่าเชื่อคู่มือ template ใน README หากไม่ตรงกับโปรเจกต์ปัจจุบัน

```bash
corepack yarn install --frozen-lockfile
corepack yarn dev              # development: port 8800, webpack
corepack yarn lint
corepack yarn test:security
corepack yarn build
corepack yarn start            # production build: port 8800
corepack yarn audit --groups dependencies
corepack yarn audit
```

หากยังใช้ Node 22 และไม่มี Yarn shim ใช้ชั่วคราวได้:

```bash
npm exec --yes --package=node@24 -- corepack yarn install --frozen-lockfile
```

ไม่ต้อง `sudo corepack enable` เพื่อแก้งานนี้ อย่าลบ lockfile เพื่อให้ install ผ่าน
เมื่อเปลี่ยน dependency ให้ regenerate lockfile อย่างตั้งใจ ตรวจ frozen install,
audit และ compatibility โดยเฉพาะ Tiptap/ProseMirror ที่ต้องใช้เวอร์ชันสอดคล้องกัน

## 4. แผนที่ฟังก์ชันหลัก

| งาน | จุดเริ่มต้น | สิ่งที่ต้องรักษา |
| --- | --- | --- |
| สมัคร/เข้าสู่ระบบ/OTP | `src/app/api/auth`, `src/sections/marketplace/auth`, `src/lib/auth-token.ts` | สถานะบัญชี การยืนยันอีเมล session revocation และ role |
| LINE Login / SSO | `src/lib/marketplace-sso.ts`, `docs/line-login.md`, `docs/ekru-sso.md` | state, callback allowlist, code expiry/replay และสิทธิ์ปลายทาง |
| ค้นหา/รายละเอียดสินค้า/ร้านค้า | `src/sections/marketplace/catalog`, `src/app/api/marketplace/products` | สถานะเผยแพร่ ตัวกรอง pagination และข้อมูลที่เปิดเผยได้ |
| ร้านค้า/โปรไฟล์/ลงสินค้า | `src/sections/marketplace/seller`, `src/app/api/marketplace/seller` | เจ้าของร้าน สถานะอนุมัติ ฟอร์ม และ workflow ส่งตรวจ |
| ตะกร้า/สร้างคำสั่งซื้อ | `src/sections/marketplace/cart`, `src/sections/marketplace/checkout`, `src/app/api/marketplace/orders` | ตรวจราคา/สินค้า/สิทธิ์ที่ server ไม่ใช้ยอดจาก client เป็นข้อยุติ |
| ชำระเงิน/ต่ออายุ/คืนเงิน | `src/app/api/stripe/webhook`, `src/sections/marketplace/checkout/server` | ลายเซ็น ยอดเงิน สกุลเงิน session mapping และ idempotency |
| รายการซื้อ/License/ดาวน์โหลด | `src/sections/marketplace/account`, `src/app/api/marketplace/licenses`, `src/app/api/marketplace/downloads` | ผู้ซื้อจริง สถานะชำระ สิทธิ์ และการคืนเงิน/เพิกถอน |
| รายได้/ค่าธรรมเนียม/ถอนเงิน | `src/sections/marketplace/admin/server/finance.ts`, `src/app/api/marketplace/seller/finance`, `src/sections/marketplace/admin` | ledger การคำนวณเงิน PIN และสิทธิ์ผู้ตรวจ |
| แนะนำเพื่อน | `src/app/r/[code]/route.ts`, `src/sections/marketplace/referrals`, `src/app/api/marketplace/referrals` | attribution เงื่อนไข reward และการประมวลผลซ้ำ |
| Feedback | `src/sections/marketplace/feedback`, `src/app/api/marketplace/feedback` | สิทธิ์ผู้ส่ง/ผู้จัดการ และ loading/empty/error state |
| จัดส่ง | `src/sections/marketplace/shipping`, `docs/MARKETPLACE_SHIPPING.md` | feature switch, kill switch, quote token, webhook และ shipping ledger |
| แจ้งเตือน/อีเมล | `src/lib/notifications.ts`, `src/lib/resend.ts`, server helpers ของแต่ละส่วน | ป้องกันส่งซ้ำ ไม่เปิดเผย token และไม่ให้ช่องทางรองทำ payment rollback |
| ระบบโรงเรียน/ครู/นักเรียน | `src/app/api/teacher`, `src/lib/school-subscription.ts`, `src/lib/department-permission-access.ts` | school isolation, role และ subscription/entitlement ตามฟังก์ชัน |

หน้าจออยู่ใน `src/sections` ส่วน `src/app` รับผิดชอบ routing/layout/API
ใช้ path กลางจาก `src/routes/paths.ts` เมื่อมีอยู่แล้ว
ไม่สร้าง business logic ซ้ำใน view ถ้ามี server helper เดิมให้ใช้

## 5. กติกาฟอร์มและสินค้า

- ฟอร์มที่สร้างหรือปรับ validation ให้ใช้ React Hook Form + Zod ตาม component เดิม
- แยก schema บันทึก draft กับ schema ส่งตรวจ draft อาจยังกรอกไม่ครบได้
- Server ตรวจซ้ำเสมอ ทั้งชนิดข้อมูล ขนาด จำนวน สิทธิ์ และเงื่อนไขธุรกิจ
- แสดง label ภาษาไทยและ error ใกล้ช่องที่ผิด มี loading, empty, error และ success state ที่ชัด
- หน้าฟอร์มยาวแบ่งหัวข้อพร้อมเลข แยก “เนื้อหาหน้าขาย”, “ตัวอย่างก่อนซื้อ” และ “ได้รับหลังซื้อ”
- Checklist ความพร้อมแสดงเฉพาะข้อสำคัญที่ต้องทำ ช่องไม่บังคับไม่ควรถูกนับเป็นงานค้าง
- รายการที่ลูกค้าจะได้รับ: สูงสุด 10 รายการ อย่างน้อย 1 รายการตอนส่งตรวจ
- ภาพพรีวิว: สูงสุด 8 ภาพ ภาพละไม่เกิน 3 MiB อย่างน้อย 1 ภาพตอนส่งตรวจ
- ไฟล์จริง: สูงสุด 5 ไฟล์ ไฟล์ละไม่เกิน 10 MiB อย่างน้อย 1 ไฟล์สำหรับสินค้าที่ schema กำหนดให้ส่งไฟล์
- ไฟล์ตัวอย่าง: ไม่บังคับ สูงสุด 1 ไฟล์ ไม่เกิน 10 MiB
- ภาพปกมีเส้นทาง/กติกาแยก ให้ตรวจ endpoint เดิมก่อนแก้ ไม่รวม limit เองโดยเดา
- Subscription สำหรับร้านค้าทางการต้องตรวจที่ server ด้วย ไม่ใช่แค่ซ่อนตัวเลือก
- ชื่อไฟล์ที่แสดง/ดาวน์โหลดใช้ชื่อที่อัปโหลด เก็บ UUID ไว้เป็น storage key ภายใน
- หากผู้ใช้เปลี่ยนกติกา ให้อัปเดต UI, schema, API, storage policy และ DB constraint ที่เกี่ยวข้องให้ตรงกัน

## 6. อัปโหลดและสิทธิ์ดาวน์โหลด

อ่าน `docs/product-direct-upload.md` ก่อนแก้ upload
ใช้ `src/sections/marketplace/shared/product-upload-policy.ts` เป็นจุดอ้างอิง limit ของไฟล์

- ไฟล์จริงและไฟล์ตัวอย่างส่ง bytes ตรงไป private Supabase Storage ผ่าน signed upload URL
- Next.js รับ metadata และ completion ticket; ไม่ส่งไฟล์ใหญ่ผ่าน Vercel Function และไม่เพิ่ม Vercel Blob
- เส้นทาง completion ตรวจเจ้าของ ticket, expiry, bytes/MIME จริง, quota และ malware ก่อนผูกไฟล์กับสินค้า
- รักษา staged/final path แยกกัน การ retry แบบ idempotent และ cleanup ที่ไม่ลบไฟล์สำเร็จแล้ว
- ห้ามแก้ปัญหา payload โดยเพิ่ม client limit อย่างเดียว หรือนำ bytes/base64 ไปใส่ JSON
- ไฟล์จริงต้องตรวจคำสั่งซื้อและผู้ซื้อก่อนออก signed download URL; ไม่เปิด bucket เป็น public
- ตัวอย่างดูได้ก่อนซื้อผ่านเส้นทางที่ระบบอนุญาต ไม่ได้แปลว่าเปิดไฟล์จริงหรือ storage ทั้ง bucket
- ห้ามตีความ `pending_scan` ว่าสแกนผ่าน ถ้า scanner ไม่พร้อมให้รายงานตามจริง

## 7. API, สิทธิ์ และ cache

- ใช้ helper เดิม: `requireAuthenticated`, `requireRole`, การตรวจบัญชียัง active/session และ ownership ตามเส้นทาง
- Cookie-authenticated mutation ใช้ `rejectCrossSiteMutation(request)`; ใช้ rate limit สำหรับจุดเสี่ยงตามรูปแบบเดิม
- Webhook ภายนอกตรวจลายเซ็น/secret ของ provider ไม่ใช้ browser Origin แทนการยืนยัน webhook
- `src/lib/supabase-admin.ts` เป็น server-only และข้าม RLS จึงต้องตรวจสิทธิ์เองก่อน query/mutate
- ไม่เชื่อ buyer ID, seller ID, school ID, role, ราคา หรือ entitlement ที่ client ส่งมาโดยไม่ตรวจ
- จำกัดคอลัมน์และจำนวนแถว เลี่ยง N+1 ใช้ batch/aggregation และ query ที่เหมาะกับการโหลดครั้งแรก
- Browser network calls ใช้ `src/lib/api-fetch.ts` และ TanStack Query ตาม `docs/client-api-cache.md`
- แยก query key ตามผู้ใช้และตัวกรอง ล้าง cache เมื่อ login/logout/เปลี่ยน identity
- ข้อมูลการชำระ สิทธิ์ และการเงินต้องใช้ freshness ตามระบบเดิม ห้ามเพิ่ม stale cache เพื่อกลบปัญหาความเร็ว
- ใช้ component, theme, hooks และ MUI patterns ที่มี ไม่ย้าย design system โดยไม่เกี่ยวกับงาน

## 8. เงินและบริการภายนอก

- ยืนยันการชำระจากหลักฐาน server/provider ที่ตรวจแล้ว ไม่ให้ redirect success ของ client เปิดสิทธิ์เอง
- ใช้ `finalize-payment.ts` และ `grant-feature-entitlements.ts` สำหรับ workflow เดิม อย่าทำ ledger/license แยกซ้ำ
- Webhook ซ้ำหรือ retry ต้องไม่สร้างรายได้ reward หรือ license ซ้ำ ทดสอบ failure หลังชำระสำเร็จด้วย
- รักษา refund/dispute/revocation และ subscription period ให้สอดคล้องกับสิทธิ์
- การเปลี่ยน Stripe Test/Live เป็นงานแยกที่ต้องมีคำสั่งชัด ตรวจ mode ของ key/webhook และ environment ให้ตรง
- การอ่าน config หรือเตรียมโค้ดทำได้เอง แต่ห้ามเรียกเก็บเงินจริง ส่งข้อความถึงบุคคลอื่น หรือเปิดบริการใหม่โดยอนุมานจากงานแก้โค้ด
- ไม่ log secret, token, OTP, connection string, ข้อมูลบัตร หรือ signed URL ที่ยังใช้งานได้

## 9. ฐานข้อมูลและความปลอดภัยของ workspace

- ใช้ `supabase/migrations` เป็นประวัติ schema; เพิ่ม migration ใหม่สำหรับการเปลี่ยนที่ติดตั้งแล้ว ไม่แก้ประวัติย้อนหลังเงียบ ๆ
- ตรวจ schema/constraint/trigger ในฐานข้อมูลจริงเมื่อได้รับมอบหมายงาน DB อย่าถือว่าไฟล์ SQL แปลว่าติดตั้งแล้ว
- การเปลี่ยน production schema/data ต้องอยู่ในขอบเขตที่ผู้ใช้อนุญาต ตรวจผลกระทบก่อน โดยเฉพาะ drop, truncate และ backfill
- ทดสอบ DB ด้วย fixture แยกและ transaction rollback เมื่อทำได้ ไม่แก้ข้อมูลของผู้ใช้เพื่อทดลอง
- เชื่อม Postgres โดยตรวจ CA และ hostname หาก certificate ผิด ให้ใช้ CA จาก Supabase Database Settings ห้ามปิด TLS verification
- ไม่ commit `.env`, certificate ส่วนตัว, credential หรือ test account secret ตรวจเฉพาะค่าที่จำเป็นและปิดบังข้อมูลในรายงาน
- รักษา user changes ที่ค้างอยู่ ห้าม reset, checkout ทับ, clean หรือ format ทั้ง repo โดยไม่เกี่ยวข้อง
- ไม่ commit, push, deploy หรือเปลี่ยน Live configuration เว้นแต่ผู้ใช้สั่ง การขอแก้โค้ดไม่ใช่คำสั่ง deploy
- ก่อนเริ่ม server ตรวจพอร์ต 8800 ไม่ kill process ที่ไม่รู้ที่มา เคารพคำสั่งหยุด server
- ถ้าต้อง rebuild ขณะ server ใช้ `.next` ให้จัดการ server ที่ตัวเองเปิดอย่างชัดเจน แจ้งช่วงหยุด/เปิด และรายงานสถานะท้ายงาน

## 10. ตรวจงานตามผลกระทบ

| ประเภทงาน | การตรวจขั้นต่ำที่เหมาะสม |
| --- | --- |
| แก้เอกสาร/ข้อความเล็กน้อย | ตรวจเนื้อหา path/link และ `git diff --check`; ไม่ต้อง build ทั้งระบบ |
| UI/ฟอร์ม | lint, TypeScript ผ่าน build เมื่อกระทบ type/โครงสร้าง, schema ที่เกี่ยวข้อง และดูหน้าจริงเมื่อทำได้ |
| API/สิทธิ์ | ทดสอบอนุญาต/ปฏิเสธ ข้อมูลผิด ผู้ใช้คนอื่น และ error path |
| Upload | size boundary, quota, ownership, completion retry, cleanup และชื่อไฟล์ |
| Payment/License | ลายเซ็น ยอดเงิน สกุลเงิน session mapping callback ซ้ำ retry refund และ ownership |
| Migration | ตรวจ catalog และ boundary บน DB เป้าหมายด้วย fixture/rollback พร้อมระบุว่าได้รันจริงหรือยัง |
| Dependency | frozen install, audit, lint, tests และ production build; ตรวจ runtime ของส่วนที่ upgrade เมื่อทำได้ |

ชุดทดสอบอยู่ใน `tests/security`; การทดสอบขอบเขต DB อยู่ใน `tests/database/product-upload-limits.sql`
เพิ่ม test เมื่อช่วยจับ regression สำคัญ ไม่เขียน test ที่แค่ตรวจว่ามีข้อความในโค้ดเพื่ออ้างว่าฟังก์ชันทำงาน
แยกรายงานให้ชัดระหว่าง static check, mocked integration, browser test และ provider/database จริง
ดูหลักฐานการตรวจและรายการที่ยังค้างใน `docs/production-verification.md` โดยไม่ถือเป็นผลตรวจล่าสุดตลอดไป

## รูปแบบตอบท้ายงาน

บอกผลลัพธ์ก่อน ตามด้วยผลตรวจและสิ่งที่ยังติด รวมสถานะ server หรือ deployment เมื่อเกี่ยวข้อง
ไม่ลงท้ายด้วย “ต้องการให้ทำต่อไหม” ถ้ายังมีงานที่ผู้ใช้สั่งและทำต่อได้
หากมีจุดที่ต้องให้ผู้ใช้ทำจริง ให้ถามเฉพาะขั้นตอนนั้น พร้อมเหตุผล และทำส่วนที่เหลือให้พร้อมก่อน
