import 'server-only';

import type { AppTokenPayload } from 'src/lib/auth-token';

import { supabaseAdmin } from 'src/lib/supabase-admin';

export async function getEligibleLicenseSchools(caller: AppTokenPayload) {
  const targets = new Map<string, { id: string; name: string }>();

  if (caller.role === 'school_admin' && caller.schoolId) {
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('id,name')
      .eq('id', caller.schoolId)
      .eq('is_active', true)
      .maybeSingle();
    if (school) targets.set(school.id, school);
  }

  const { data: memberships } = await supabaseAdmin
    .from('marketplace_school_members')
    .select('school:schools(id,name,is_active)')
    .eq('marketplace_user_id', caller.sub)
    .eq('membership_role', 'school_admin');

  for (const row of memberships ?? []) {
    const school = (Array.isArray(row.school) ? row.school[0] : row.school) as
      | { id: string; name: string; is_active: boolean }
      | undefined;
    if (school?.is_active) targets.set(school.id, { id: school.id, name: school.name });
  }

  return [...targets.values()];
}
