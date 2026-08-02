update public.marketplace_seller_badge_settings
set
  label_th = 'นักสร้างสรรค์ดาวรุ่ง',
  label_en = 'Emerging Creator',
  description_th = 'จุดเริ่มต้นของร้านคุณ สร้างผลงานและยอดขายเพื่อปลดล็อกรางวัลระดับถัดไป',
  description_en = 'Your creator journey starts here. Publish and grow your sales to unlock the next badge.',
  icon_key = 'award',
  color = '#D97706',
  updated_at = now()
where badge_key = 'new_creator';
