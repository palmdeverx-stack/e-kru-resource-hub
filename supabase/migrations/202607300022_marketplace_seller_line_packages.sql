alter table public.marketplace_line_settings
  add column if not exists seller_byoa_description text not null
    default 'ใช้ LINE OA ของตัวเอง กรอก Channel token และ User ID เอง',
  add column if not exists seller_managed_price numeric(12, 2) not null default 99
    check (seller_managed_price >= 10),
  add column if not exists seller_managed_description text not null
    default 'ใช้ LINE OA ของระบบ E-KRU ไม่ต้องกรอก Channel token',
  add column if not exists seller_managed_quota integer not null default 100
    check (seller_managed_quota > 0);
