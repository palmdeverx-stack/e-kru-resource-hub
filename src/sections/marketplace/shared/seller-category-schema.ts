import { z } from 'zod';

export const SellerCategorySchema = z.object({
  name: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .pipe(
      z
        .string()
        .min(2, 'ชื่อหมวดหมู่ต้องมีอย่างน้อย 2 ตัวอักษร')
        .max(80, 'ชื่อหมวดหมู่ต้องไม่เกิน 80 ตัวอักษร')
    ),
});

export const SellerLookupSchema = SellerCategorySchema.extend({
  gradeGroup: z.enum(['kindergarten', 'primary', 'secondary', 'other']),
});
