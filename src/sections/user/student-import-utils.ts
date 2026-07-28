import * as XLSX from 'xlsx';

// ----------------------------------------------------------------------

const GENDER_LABEL_TO_VALUE: Record<string, string> = {
  ชาย: 'male',
  หญิง: 'female',
  อื่นๆ: 'other',
  ไม่ระบุ: 'unspecified',
};

const COLUMNS = [
  { key: 'studentCode', header: 'รหัสนักเรียน*', example: '10001' },
  { key: 'namePrefix', header: 'คำนำหน้า', example: 'เด็กชาย' },
  { key: 'firstName', header: 'ชื่อ*', example: 'สมชาย' },
  { key: 'lastName', header: 'นามสกุล*', example: 'ใจดี' },
  { key: 'nickname', header: 'ชื่อเล่น', example: 'ชาย' },
  { key: 'gender', header: 'เพศ (ชาย/หญิง/อื่นๆ/ไม่ระบุ)', example: 'ชาย' },
  { key: 'birthDate', header: 'วันเกิด (YYYY-MM-DD)', example: '2015-06-01' },
  { key: 'nationalId', header: 'เลขประจำตัวประชาชน (13 หลัก)', example: '' },
  { key: 'nationality', header: 'สัญชาติ', example: 'ไทย' },
  { key: 'ethnicity', header: 'เชื้อชาติ', example: 'ไทย' },
  { key: 'religion', header: 'ศาสนา', example: 'พุทธ' },
  { key: 'firstNameEn', header: 'ชื่อภาษาอังกฤษ', example: 'Somchai' },
  { key: 'lastNameEn', header: 'นามสกุลภาษาอังกฤษ', example: 'Jaidee' },
  { key: 'username', header: 'ชื่อผู้ใช้งาน*', example: '10001' },
  { key: 'email', header: 'อีเมล', example: '' },
  { key: 'password', header: 'รหัสผ่าน (เว้นว่างให้ระบบสุ่มให้)', example: '' },
] as const;

export type StudentImportRow = {
  row: number;
  studentCode?: string;
  namePrefix?: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  gender?: string;
  birthDate?: string;
  nationalId?: string;
  nationality?: string;
  ethnicity?: string;
  religion?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  username?: string;
  email?: string;
  password?: string;
  errors: string[];
};

export function downloadStudentImportTemplate(): void {
  const headers = COLUMNS.map((column) => column.header);
  const example = COLUMNS.map((column) => column.example);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, example]);
  worksheet['!cols'] = COLUMNS.map(() => ({ wch: 22 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'นักเรียน');
  XLSX.writeFile(workbook, 'แบบฟอร์มนำเข้านักเรียน.xlsx');
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export async function parseStudentImportFile(file: File): Promise<StudentImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const headerToKey = new Map(COLUMNS.map((column) => [column.header, column.key]));

  return raw.map((record, index) => {
    const data: Record<string, string> = {};
    for (const [header, value] of Object.entries(record)) {
      const key = headerToKey.get(header as (typeof COLUMNS)[number]['header']);
      if (key) data[key] = cellToString(value);
    }

    const errors: string[] = [];
    if (!data.studentCode) errors.push('ไม่มีรหัสนักเรียน');
    if (!data.firstName) errors.push('ไม่มีชื่อ');
    if (!data.lastName) errors.push('ไม่มีนามสกุล');
    if (!data.username) errors.push('ไม่มีชื่อผู้ใช้งาน');

    if (data.nationalId && !/^\d{13}$/.test(data.nationalId)) {
      errors.push('เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก');
    }

    let gender = data.gender;
    if (gender) {
      const mapped = GENDER_LABEL_TO_VALUE[gender] ?? gender;
      if (!['male', 'female', 'other', 'unspecified'].includes(mapped)) {
        errors.push('เพศต้องเป็น ชาย/หญิง/อื่นๆ/ไม่ระบุ');
      }
      gender = mapped;
    }

    if (data.birthDate && Number.isNaN(Date.parse(data.birthDate))) {
      errors.push('วันเกิดไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)');
    }
    if (data.password && data.password.length < 6) {
      errors.push('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    }

    return {
      row: index + 2, // header is row 1
      ...data,
      gender,
      errors,
    };
  });
}
