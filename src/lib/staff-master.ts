import 'server-only';

import { supabaseAdmin } from './supabase-admin';

// ----------------------------------------------------------------------

export type StaffMasterCategory =
  | 'staff_type'
  | 'prefix'
  | 'position'
  | 'academic_rank'
  | 'employment_status';

export async function isActiveStaffMasterValue(
  schoolId: string,
  category: StaffMasterCategory,
  value: string
) {
  const valueColumn =
    category === 'staff_type' || category === 'employment_status' ? 'code' : 'name';
  const { data } = await supabaseAdmin
    .from('staff_master_items')
    .select('id')
    .eq('school_id', schoolId)
    .eq('category', category)
    .eq(valueColumn, value)
    .eq('is_active', true)
    .maybeSingle();

  return !!data;
}
