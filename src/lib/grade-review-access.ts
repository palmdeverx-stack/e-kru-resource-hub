import 'server-only';

import { supabaseAdmin } from './supabase-admin';

// ----------------------------------------------------------------------

/**
 * Grade items and scores stay editable until they are sent to academic
 * affairs. A revision request re-opens them; every later state is read-only.
 */
export async function canEditGradebook(teacherAssignmentId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('grade_review_submissions')
    .select('status')
    .eq('teacher_assignment_id', teacherAssignmentId)
    .maybeSingle();

  return !data || data.status === 'draft' || data.status === 'revision';
}
