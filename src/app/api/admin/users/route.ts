import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { parseGuardianBody } from 'src/lib/student-guardian';
import { decryptCredential } from 'src/lib/credential-cipher';
import { createManagedUser } from 'src/lib/create-managed-user';
import {
  getDepartmentGrantedPermissions,
  getEffectiveDepartmentPermissions,
} from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

export async function GET(request: Request) {
  const caller = requireRole(request, ['master_admin', 'school_admin', 'teacher']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  // View-level (department-granted) decides who can browse the list at all;
  // effective (personally-delegated) decides who sees decrypted passwords.
  const viewPermissions =
    caller.role === 'teacher' && caller.schoolId
      ? await getDepartmentGrantedPermissions(caller.sub, caller.schoolId)
      : [];
  const managePermissions =
    caller.role === 'teacher' && caller.schoolId
      ? await getEffectiveDepartmentPermissions(caller.sub, caller.schoolId)
      : [];

  // Teachers may only look up students (e.g. to enroll them into a classroom) —
  // they can't browse the staff directory, unless their department has been
  // delegated staff management or schedule-management (the latter needs the
  // teacher list to assign subjects to other teachers).
  if (caller.role === 'teacher' && role !== 'student') {
    const canBrowseTeachers =
      role === 'teacher' &&
      (viewPermissions.includes('staff.manage') || viewPermissions.includes('schedule.manage'));
    if (!canBrowseTeachers) {
      return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }
  }

  let query = supabaseAdmin
    .from('app_users')
    .select(
      'id, username, email, first_name, last_name, avatar_url, role, school_id, school:schools!app_users_school_id_fkey(name), created_at, must_change_password, student_status, student_code, national_id, name_prefix, first_name_en, last_name_en, nickname, gender, birth_date, nationality, ethnicity, religion, is_active, password_ciphertext, import_confirmed_at, staff_type, employment_status, employment_start_date, appointment_date, contract_end_date, position_title, academic_rank, is_school_director, line_linked_at, line_display_name'
    )
    .order('created_at', { ascending: false });

  if (caller.role === 'master_admin') {
    query = query.eq('role', role ?? 'school_admin');
  } else {
    query = query.eq('school_id', caller.schoolId);
    if (role) query = query.eq('role', role);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const studentIds = data.filter((user) => user.role === 'student').map((user) => user.id);
  const guardianSummary = new Map<
    string,
    { guardianCount: number; linkedCount: number; notificationsEnabledCount: number }
  >();

  if (studentIds.length) {
    const guardiansQuery = supabaseAdmin
      .from('student_guardians')
      .select('student_id, line_user_id, line_notifications_enabled');
    const { data: guardians, error: guardiansError } = caller.schoolId
      ? await guardiansQuery.eq('school_id', caller.schoolId)
      : await guardiansQuery.in('student_id', studentIds);

    if (guardiansError) {
      return NextResponse.json({ message: guardiansError.message }, { status: 500 });
    }

    for (const guardian of guardians ?? []) {
      const summary = guardianSummary.get(guardian.student_id) ?? {
        guardianCount: 0,
        linkedCount: 0,
        notificationsEnabledCount: 0,
      };
      summary.guardianCount += 1;
      if (guardian.line_user_id) {
        summary.linkedCount += 1;
        if (guardian.line_notifications_enabled) summary.notificationsEnabledCount += 1;
      }
      guardianSummary.set(guardian.student_id, summary);
    }
  }

  const users = data.map(({ password_ciphertext: passwordCiphertext, ...user }) => ({
    ...user,
    ...(user.role === 'student' && {
      guardian_count: guardianSummary.get(user.id)?.guardianCount ?? 0,
      line_guardian_count: guardianSummary.get(user.id)?.linkedCount ?? 0,
      line_notifications_enabled_count:
        guardianSummary.get(user.id)?.notificationsEnabledCount ?? 0,
    }),
    ...((caller.role === 'school_admin' ||
      (user.role === 'teacher' && managePermissions.includes('staff.manage')) ||
      (user.role === 'student' && managePermissions.includes('students.manage'))) && {
      login_password: decryptCredential(passwordCiphertext ?? null),
    }),
  }));

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['master_admin', 'school_admin', 'teacher']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const body = await request.json();
  const guardian =
    body?.role === 'student' && body.guardian ? parseGuardianBody(body.guardian) : null;
  if (guardian && 'error' in guardian) {
    return NextResponse.json({ message: guardian.error }, { status: 400 });
  }
  const result = await createManagedUser(caller, body);

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  if (guardian && !('error' in guardian)) {
    const userId = result.user.id as string;
    const schoolId = result.user.school_id as string | null;
    if (!schoolId) {
      await supabaseAdmin.from('app_users').delete().eq('id', userId);
      return NextResponse.json({ message: 'ไม่พบโรงเรียนของนักเรียน' }, { status: 500 });
    }
    const { error: guardianError } = await supabaseAdmin.from('student_guardians').insert({
      ...guardian.data,
      student_id: userId,
      school_id: schoolId,
    });
    if (guardianError) {
      await supabaseAdmin.from('app_users').delete().eq('id', userId);
      return NextResponse.json(
        { message: `ไม่สามารถบันทึกข้อมูลผู้ปกครอง: ${guardianError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { user: result.user, generatedPassword: result.generatedPassword },
    { status: 201 }
  );
}
