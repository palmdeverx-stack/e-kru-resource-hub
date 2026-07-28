import type { AppTokenPayload } from './auth-token';

import { requireRole } from './auth-token';
import { supabaseAdmin } from './supabase-admin';
import { loadTeacherAssignment, canAccessTeacherAssignment } from './teacher-assignment-access';

// ----------------------------------------------------------------------

export const GUARDIAN_PUBLIC_FIELDS =
  'id, student_id, full_name, relationship, phone, email, occupation, address, notes, is_primary, line_display_name, line_linked_at, line_notifications_enabled, created_at, updated_at';

export async function authorizeGuardianAccess(
  request: Request,
  teacherAssignmentId: string,
  studentId: string
): Promise<{ caller: AppTokenPayload; schoolId: string } | null> {
  const caller = requireRole(request, ['teacher', 'school_admin']);
  if (!caller) return null;

  const teacherAssignment = await loadTeacherAssignment(teacherAssignmentId);
  if (!canAccessTeacherAssignment(caller, teacherAssignment)) return null;

  const { data: enrollment } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('classroom_id', teacherAssignment!.classroom_id)
    .eq('student_id', studentId)
    .maybeSingle();

  const classroom = teacherAssignment!.classrooms as unknown as { school_id: string };
  return enrollment ? { caller, schoolId: classroom.school_id } : null;
}

export function parseGuardianBody(body: unknown) {
  const value = (body ?? {}) as Record<string, unknown>;
  const fullName = typeof value.fullName === 'string' ? value.fullName.trim() : '';
  const relationship = typeof value.relationship === 'string' ? value.relationship.trim() : '';
  const phone = typeof value.phone === 'string' ? value.phone.trim() : '';
  const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : '';
  const occupation = typeof value.occupation === 'string' ? value.occupation.trim() : '';
  const address = typeof value.address === 'string' ? value.address.trim() : '';
  const notes = typeof value.notes === 'string' ? value.notes.trim() : '';
  const isPrimary = value.isPrimary === true;

  if (!fullName || !relationship || !phone) {
    return { error: 'กรุณากรอกชื่อ ความสัมพันธ์ และเบอร์โทรศัพท์' } as const;
  }
  if (fullName.length > 150 || relationship.length > 80 || phone.length > 30) {
    return { error: 'ข้อมูลผู้ปกครองยาวเกินกำหนด' } as const;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'รูปแบบอีเมลไม่ถูกต้อง' } as const;
  }

  return {
    data: {
      full_name: fullName,
      relationship,
      phone,
      email: email || null,
      occupation: occupation || null,
      address: address || null,
      notes: notes || null,
      is_primary: isPrimary,
    },
  } as const;
}
