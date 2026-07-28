import type { MarketplaceProduct } from "./types";

export const MARKETPLACE_CATEGORIES = [
  'all',
  'แผนการสอน',
  'ใบงาน',
  'สื่อประกอบ',
  'แบบทดสอบ',
  'คอร์สเรียน',
] as const;

export const SAMPLE_PRODUCTS: MarketplaceProduct[] = [
  {
    id: 'sample-1',
    seller_id: 'sample-teacher',
    title: 'ชุดใบงานคณิตศาสตร์ ป.4',
    description:
      'ใบงานคณิตศาสตร์พร้อมเฉลย 30 หน้า ครอบคลุมเศษส่วน ทศนิยม และโจทย์ปัญหา ใช้ได้ทั้งในห้องเรียนและการบ้าน',
    category: 'ใบงาน',
    resource_type: 'digital',
    price: 129,
    currency: 'THB',
    cover_url: null,
    file_url: null,
    status: 'published',
    created_at: new Date().toISOString(),
    seller: { id: 'sample-teacher', display_name: 'ครูมินตรา', seller_type: 'teacher' },
  },
  {
    id: 'sample-2',
    seller_id: 'sample-studio',
    title: 'แผนการสอนวิทยาศาสตร์ Active Learning',
    description:
      'แผนการสอน 10 คาบ พร้อมกิจกรรมทดลอง ใบกิจกรรม สไลด์ประกอบ และเกณฑ์ประเมินตามตัวชี้วัด',
    category: 'แผนการสอน',
    resource_type: 'digital',
    price: 249,
    currency: 'THB',
    cover_url: null,
    file_url: null,
    status: 'published',
    created_at: new Date().toISOString(),
    seller: { id: 'sample-studio', display_name: 'Science Lab', seller_type: 'individual' },
  },
  {
    id: 'sample-3',
    seller_id: 'sample-english',
    title: 'เกมคำศัพท์ภาษาอังกฤษในห้องเรียน',
    description: 'สไลด์เกมพร้อมเล่น 5 รูปแบบ มีคำศัพท์กว่า 200 คำ สำหรับนักเรียนระดับประถมศึกษา',
    category: 'สื่อประกอบ',
    resource_type: 'digital',
    price: 89,
    currency: 'THB',
    cover_url: null,
    file_url: null,
    status: 'published',
    created_at: new Date().toISOString(),
    seller: { id: 'sample-english', display_name: 'Happy English', seller_type: 'teacher' },
  },
];

export function findSampleProduct(id: string) {
  return SAMPLE_PRODUCTS.find((product) => product.id === id) ?? null;
}
