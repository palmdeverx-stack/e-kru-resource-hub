// Catalog of pages/features a department can be granted access to, and then
// delegate to individual members. Add new entries here as more pages gain
// department-level delegation — no schema change needed.

export const DEPARTMENT_PERMISSIONS = [
  {
    key: 'dashboard.view',
    label: 'ภาพรวมโรงเรียน',
    description: 'ดูสถิติ จำนวนนักเรียน บุคลากร ห้องเรียน และกิจกรรมล่าสุดของโรงเรียน',
    manageable: false,
  },
  {
    key: 'school_profile.view',
    label: 'ข้อมูลโรงเรียน',
    description: 'ดูข้อมูลพื้นฐานของโรงเรียน โดยการแก้ไขยังเป็นสิทธิ์ของผู้ดูแลโรงเรียน',
    manageable: false,
  },
  {
    key: 'teaching.assignments',
    label: 'วิชาที่สอน',
    description: 'ดูรายวิชาที่ได้รับมอบหมาย จัดการงาน แบบทดสอบ และคะแนน',
  },
  {
    key: 'teaching.students',
    label: 'นักเรียนของฉัน',
    description: 'ดูนักเรียนในห้องที่รับผิดชอบและข้อมูลการเรียนรายบุคคล',
    manageable: false,
  },
  {
    key: 'teaching.attendance',
    label: 'เช็คชื่อนักเรียน',
    description: 'สแกนและบันทึกการเข้าเรียนของนักเรียนในรายวิชาที่รับผิดชอบ',
  },
  {
    key: 'teaching.timetable',
    label: 'ตารางสอนส่วนตัว',
    description: 'ดูตารางสอนของตนเอง',
    manageable: false,
  },
  {
    key: 'teaching.announcements',
    label: 'ประกาศสำหรับครู',
    description: 'ดูและจัดการประกาศที่เกี่ยวข้องกับครูผู้สอน',
  },
  {
    key: 'schedule.manage',
    label: 'จัดตารางสอน',
    description: 'จัดตารางสอนของครูทุกคนในโรงเรียน ผูกครูเข้ากับวิชา และจัดคาบสอนรายห้อง',
  },
  {
    key: 'schedule.approve',
    label: 'อนุมัติตารางสอน',
    description: 'ดูรายการที่ส่งมา ตรวจสอบ และลงนามอนุมัติตารางสอน',
  },
  {
    key: 'grades.review',
    label: 'ตรวจสอบผลการเรียน',
    description: 'รับผลการเรียนจากครู ตรวจความครบถ้วน เทียบข้อมูล สพฐ. และรับรองผลการเรียน',
  },
  {
    key: 'grades.approve',
    label: 'อนุมัติผลการเรียน',
    description: 'อนุมัติผลการเรียนที่ฝ่ายวิชาการตรวจสอบแล้ว สำหรับผู้บริหารเท่านั้น',
  },
  {
    key: 'documents.access',
    label: 'เอกสาร',
    description: 'สร้างและติดตามเอกสารของตนเอง รวมถึงดูตัวอย่างเอกสารของโรงเรียน',
    manageable: false,
  },
  {
    key: 'academic_years.manage',
    label: 'ปีการศึกษา',
    description: 'สร้าง แก้ไข และเปิด/ปิดใช้งานปีการศึกษาและภาคเรียนของทั้งโรงเรียน',
  },
  {
    key: 'classrooms.manage',
    label: 'ห้องเรียน',
    description: 'สร้างและแก้ไขห้องเรียนทั้งโรงเรียน',
  },
  {
    key: 'subjects.manage',
    label: 'รายวิชา',
    description: 'สร้างและแก้ไขรายวิชาทั้งโรงเรียน',
  },
  {
    key: 'enrollments.manage',
    label: 'ลงทะเบียนนักเรียน',
    description: 'จัดนักเรียนเข้าห้องเรียนทั้งโรงเรียน',
  },
  {
    key: 'announcements.manage',
    label: 'ประกาศ',
    description: 'สร้างและจัดการประกาศของทั้งโรงเรียน',
  },
  {
    key: 'students.manage',
    label: 'นักเรียน',
    description: 'ดูรายชื่อนักเรียนทั้งโรงเรียน โดยการจัดการบัญชีสงวนไว้เฉพาะผู้ดูแลโรงเรียน',
    manageable: false,
  },
  {
    key: 'staff.manage',
    label: 'บุคลากร',
    description: 'ดูรายชื่อครู/บุคลากรทั้งโรงเรียน โดยไม่แสดงรหัสผ่านและไม่อนุญาตให้จัดการบัญชี',
    manageable: false,
  },
] as const;

export type DepartmentPermissionKey = (typeof DEPARTMENT_PERMISSIONS)[number]['key'];

export const DEPARTMENT_PERMISSION_KEYS = DEPARTMENT_PERMISSIONS.map((item) => item.key);
export const DEPARTMENT_DELEGABLE_PERMISSIONS = DEPARTMENT_PERMISSIONS.filter(
  (item) =>
    !item.key.startsWith('teaching.') && !['schedule.approve', 'grades.approve'].includes(item.key)
);

export function isDepartmentPermissionKey(value: string): value is DepartmentPermissionKey {
  return (DEPARTMENT_PERMISSION_KEYS as string[]).includes(value);
}

export function isManageableDepartmentPermission(value: DepartmentPermissionKey): boolean {
  const permission = DEPARTMENT_PERMISSIONS.find((item) => item.key === value);
  return !!permission && (!('manageable' in permission) || permission.manageable !== false);
}

export function isDepartmentDelegablePermission(value: DepartmentPermissionKey): boolean {
  return !value.startsWith('teaching.') && !['schedule.approve', 'grades.approve'].includes(value);
}
