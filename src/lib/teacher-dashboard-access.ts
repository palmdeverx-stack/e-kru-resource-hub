import 'server-only';

import type { AppTokenPayload } from './auth-token';

import { supabaseAdmin } from './supabase-admin';

// ----------------------------------------------------------------------

/**
 * Who may view another teacher's teaching overview: the school admin, or
 * the head of the department that teacher belongs to (each teacher belongs
 * to at most one department, so a single membership row lookup suffices).
 */
export async function canViewTeacherDashboard(
  caller: AppTokenPayload,
  targetTeacherId: string
): Promise<boolean> {
  if (!caller.schoolId) return false;

  const { data: target } = await supabaseAdmin
    .from('app_users')
    .select('id, role, school_id')
    .eq('id', targetTeacherId)
    .maybeSingle();

  if (!target || target.role !== 'teacher' || target.school_id !== caller.schoolId) return false;

  if (caller.role === 'school_admin') return true;
  if (caller.role !== 'teacher') return false;

  const { data: callerMembership } = await supabaseAdmin
    .from('department_members')
    .select('department_id, role_in_department')
    .eq('teacher_id', caller.sub)
    .maybeSingle();

  if (callerMembership?.role_in_department !== 'head') return false;

  const { data: targetMembership } = await supabaseAdmin
    .from('department_members')
    .select('department_id')
    .eq('teacher_id', targetTeacherId)
    .maybeSingle();

  return targetMembership?.department_id === callerMembership.department_id;
}
