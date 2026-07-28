import 'server-only';

import type { AppTokenPayload } from './auth-token';
import type { loadTeacherAssignment } from './teacher-assignment-access';

import { supabaseAdmin } from './supabase-admin';
import { canAccessTeacherAssignment } from './teacher-assignment-access';
import {
  canManageViaPermission,
  hasDepartmentPermission,
} from './department-permission-access';

// ----------------------------------------------------------------------

/**
 * True for school_admin, or a teacher whose staff type / individual override
 * grants manage-level schedule approval.
 */
export async function canApproveSchedule(caller: AppTokenPayload): Promise<boolean> {
  if (caller.role === 'school_admin') return true;
  return canManageViaPermission(caller, 'schedule.approve');
}

/**
 * True if `teacherId` has been delegated schedule-management for the whole
 * school via the 'schedule.manage' department permission.
 */
export function hasTimetableCapability(teacherId: string, schoolId: string): Promise<boolean> {
  return hasDepartmentPermission(teacherId, schoolId, 'schedule.manage');
}

export async function canManageAssignmentSchedule(
  caller: AppTokenPayload,
  teacherAssignment: Awaited<ReturnType<typeof loadTeacherAssignment>>
): Promise<boolean> {
  if (canAccessTeacherAssignment(caller, teacherAssignment)) return true;
  if (caller.role !== 'teacher' || !caller.schoolId || !teacherAssignment) return false;

  const classroomSchoolId = (teacherAssignment.classrooms as unknown as { school_id: string })
    ?.school_id;
  if (classroomSchoolId !== caller.schoolId) return false;

  return hasTimetableCapability(caller.sub, caller.schoolId);
}

export async function canManageClassroomSchedule(
  caller: AppTokenPayload,
  classroomSchoolId: string | null
): Promise<boolean> {
  if (!classroomSchoolId || classroomSchoolId !== caller.schoolId) return false;
  if (caller.role === 'school_admin') return true;
  if (caller.role !== 'teacher') return false;

  return hasTimetableCapability(caller.sub, caller.schoolId);
}

/**
 * Any CRUD on a classroom's schedule (slots or assignments) after it was
 * already approved means the approved version is stale. Drops the status
 * back to 'draft' but deliberately keeps `approved_at`/`approved_by` —
 * that history is what lets the UI show "ยืนยันแล้ว แต่มีการแก้ไข ต้องส่งยืนยันใหม่"
 * instead of a plain, never-submitted draft. No-op if it wasn't approved.
 */
export async function revertScheduleApprovalOnEdit(
  classroomId: string,
  semesterId: string
): Promise<void> {
  await supabaseAdmin
    .from('classroom_schedule_approvals')
    .update({
      status: 'draft',
      submitted_by: null,
      submitted_at: null,
      signature_url: null,
      signature_signed_at: null,
      submitter_signature_url: null,
      submitter_signature_signed_at: null,
    })
    .eq('classroom_id', classroomId)
    .eq('semester_id', semesterId)
    .eq('status', 'approved');
}
