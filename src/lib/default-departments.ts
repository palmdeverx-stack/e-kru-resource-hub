import 'server-only';

import { supabaseAdmin } from './supabase-admin';

// ----------------------------------------------------------------------

const DEFAULT_DEPARTMENTS = [
  { name: 'ฝ่ายวิชาการ', description: 'การเรียนการสอน' },
  { name: 'ฝ่ายกิจการนักเรียน', description: 'ดูแลนักเรียน' },
  { name: 'ฝ่ายบริหารทั่วไป', description: 'งานธุรการ' },
  { name: 'ฝ่ายงบประมาณ', description: 'การเงิน' },
  { name: 'ฝ่ายสัมพันธ์ชุมชน', description: 'ผู้ปกครอง' },
];

/** Seeds the 5 common Thai school departments for a newly created school. */
export async function seedDefaultDepartments(schoolId: string) {
  await supabaseAdmin
    .from('departments')
    .insert(DEFAULT_DEPARTMENTS.map((department) => ({ ...department, school_id: schoolId })));
}
