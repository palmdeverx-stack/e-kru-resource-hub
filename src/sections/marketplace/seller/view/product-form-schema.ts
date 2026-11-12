import * as z from 'zod';

export function isValidExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function plainText(html: string) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const initialProductForm = {
  productKind: 'resource' as 'resource' | 'license',
  title: '',
  titleEn: '',
  shortDescription: '',
  shortDescriptionEn: '',
  description: '',
  descriptionEn: '',
  category: '',
  subjectLabel: '',
  curriculumId: '',
  gradeLevelIds: [] as string[],
  tagIds: [] as string[],
  mediaTypeId: '',
  saleTypeId: '',
  price: '0',
  listPrice: '',
  grantsFeatureKeys: [] as string[],
  grantsPlanCode: '',
  licenseBillingCycle: 'one_time' as 'one_time' | 'monthly' | 'yearly' | 'contract',
  licenseDurationType: 'days' as 'days' | 'perpetual',
  grantDurationDays: '30',
  licenseTargetSystem: 'marketplace' as 'marketplace' | 'ekru',
  licenseScope: 'individual' as 'individual' | 'school' | 'teacher' | 'platform',
  licenseSeatCount: '1',
  licenseMaxTeachers: '',
  licenseMaxStudents: '',
  licenseMaxSchoolAdmins: '',
  licenseLineQuota: '',
  licenseQuota: '',
  externalLinks: [] as Array<{ label: string; url: string }>,
  purchaseBenefits: [''] as string[],
  purchaseBenefitsHtml: '',
  shippingWeightGrams: '',
  shippingWidthCm: '',
  shippingLengthCm: '',
  shippingHeightCm: '',
};

export const ProductDraftSchema = z
  .object({
    productKind: z.enum(['resource', 'license']),
    title: z.string().trim().min(3, 'กรุณากรอกชื่อสินค้าอย่างน้อย 3 ตัวอักษร'),
    titleEn: z.string(),
    shortDescription: z.string().max(150, 'คำอธิบายสั้นต้องไม่เกิน 150 ตัวอักษร'),
    shortDescriptionEn: z.string().max(150, 'คำอธิบายสั้นภาษาอังกฤษต้องไม่เกิน 150 ตัวอักษร'),
    description: z.string(),
    descriptionEn: z.string(),
    category: z.string(),
    subjectLabel: z.string(),
    curriculumId: z.string(),
    gradeLevelIds: z.array(z.string()),
    tagIds: z.array(z.string()),
    mediaTypeId: z.string(),
    saleTypeId: z.string(),
    price: z
      .string()
      .refine(
        (value) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0,
        'กรุณาระบุราคาเป็นตัวเลขที่ไม่ติดลบ'
      ),
    listPrice: z
      .string()
      .refine(
        (value) => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0),
        'ราคาเต็มต้องเป็นตัวเลขที่ไม่ติดลบ'
      ),
    grantsFeatureKeys: z.array(z.string()),
    grantsPlanCode: z.string(),
    licenseBillingCycle: z.enum(['one_time', 'monthly', 'yearly', 'contract']),
    licenseDurationType: z.enum(['days', 'perpetual']),
    grantDurationDays: z.string(),
    licenseTargetSystem: z.enum(['marketplace', 'ekru']),
    licenseScope: z.enum(['individual', 'school', 'teacher', 'platform']),
    licenseSeatCount: z.string(),
    licenseMaxTeachers: z.string(),
    licenseMaxStudents: z.string(),
    licenseMaxSchoolAdmins: z.string(),
    licenseLineQuota: z.string(),
    licenseQuota: z.string(),
    externalLinks: z
      .array(
        z.object({
          label: z.string().trim().min(1, 'กรุณากรอกชื่อลิงก์').max(80),
          url: z
            .string()
            .trim()
            .max(2048)
            .refine(
              isValidExternalUrl,
              'กรุณากรอก URL แบบ http:// หรือ https:// ที่ไม่มีชื่อผู้ใช้หรือรหัสผ่าน'
            ),
        })
      )
      .max(3),
    purchaseBenefits: z.array(z.string().trim().max(120, 'รายการต้องไม่เกิน 120 ตัวอักษร')).max(10),
    purchaseBenefitsHtml: z.string().max(30000, 'ข้อความส่งมอบต้องไม่เกิน 30,000 ตัวอักษร'),
    shippingWeightGrams: z.string(),
    shippingWidthCm: z.string(),
    shippingLengthCm: z.string(),
    shippingHeightCm: z.string(),
  })
  .refine((values) => values.listPrice === '' || Number(values.listPrice) >= Number(values.price), {
    path: ['listPrice'],
    message: 'ราคาเต็มต้องไม่น้อยกว่าราคาขาย',
  });

export const ProductSubmissionSchema = ProductDraftSchema.safeExtend({
  description: z
    .string()
    .refine((value) => plainText(value).length >= 10, 'กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร'),
  category: z.string().min(1, 'กรุณาเลือกหมวดหมู่สินค้า'),
  mediaTypeId: z.string().min(1, 'กรุณาเลือกประเภทสื่อ'),
  saleTypeId: z.string().min(1, 'กรุณาเลือกประเภทการจำหน่าย'),
  purchaseBenefits: z
    .array(z.string().trim().min(1, 'กรุณากรอกสิ่งที่ลูกค้าจะได้รับ').max(120))
    .min(1, 'กรุณาระบุสิ่งที่ลูกค้าจะได้รับอย่างน้อย 1 รายการ')
    .max(10),
});

export type ProductFormValues = z.infer<typeof ProductDraftSchema>;
