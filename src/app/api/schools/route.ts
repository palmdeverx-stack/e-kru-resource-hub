import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { paths } from 'src/routes/paths';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { generatePassword } from 'src/lib/generate-password';
import { encryptCredential } from 'src/lib/credential-cipher';
import { sendSchoolInviteEmail } from 'src/lib/school-invite-email';
import { seedDefaultDepartments } from 'src/lib/default-departments';
import { linkStaffToSupabaseAuth } from 'src/lib/staff-supabase-auth';

// ----------------------------------------------------------------------

async function countFor(table: string, schoolId: string, extraFilter?: Record<string, string>) {
  let query = supabaseAdmin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId);

  if (extraFilter) {
    for (const [key, value] of Object.entries(extraFilter)) {
      query = query.eq(key, value);
    }
  }

  const { count } = await query;
  return count ?? 0;
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['master_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { data: schools, error } = await supabaseAdmin
    .from('schools')
    .select(
      'id, name, name_en, code, logo_url, is_active, created_at, subscription:school_subscriptions(plan_name, status, ends_at)'
    )
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const withCounts = await Promise.all(
    schools.map(async (school) => {
      const subscription = Array.isArray(school.subscription)
        ? (school.subscription[0] ?? null)
        : school.subscription;
      return {
        ...school,
        subscription,
        teacherCount: await countFor('app_users', school.id, { role: 'teacher' }),
        studentCount: await countFor('app_users', school.id, { role: 'student' }),
        classroomCount: await countFor('classrooms', school.id),
        subjectCount: await countFor('subjects', school.id),
      };
    })
  );

  return NextResponse.json({ schools: withCounts });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['master_admin']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { name, nameEn, code, email } = await request.json();

  if (!name || !code || !email) {
    return NextResponse.json(
      { message: 'กรุณากรอกชื่อ รหัสโรงเรียน และอีเมล' },
      { status: 400 }
    );
  }

  const normalizedCode = String(code).trim();
  if (!/^\d{8}$/.test(normalizedCode)) {
    return NextResponse.json(
      { message: 'รหัสโรงเรียนต้องเป็นตัวเลข 8 หลัก' },
      { status: 400 }
    );
  }

  const normalizedEmail = String(email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json({ message: 'อีเมลไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('schools')
    .select('id')
    .ilike('code', normalizedCode)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ message: 'รหัสโรงเรียนนี้ถูกใช้แล้ว' }, { status: 409 });
  }

  const trimmedName = String(name).trim();

  const { data: school, error } = await supabaseAdmin
    .from('schools')
    .insert({
      name: trimmedName,
      name_en: typeof nameEn === 'string' && nameEn.trim() ? nameEn.trim() : null,
      code: normalizedCode,
      email: normalizedEmail,
      created_by: caller.sub,
    })
    .select('id, name, name_en, code, email, logo_url, is_active, created_at')
    .single();

  if (error || !school) {
    return NextResponse.json(
      { message: error?.message ?? 'Failed to create school' },
      { status: 500 }
    );
  }

  await seedDefaultDepartments(school.id);

  // Auto-provision the school's first admin account and invite them by email
  // — "admin.<code>" can't collide since school codes are unique.
  const adminUsername = `admin.${normalizedCode}`;
  const adminPassword = generatePassword();
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const { data: adminUser, error: adminError } = await supabaseAdmin
    .from('app_users')
    .insert({
      username: adminUsername,
      password_hash: adminPasswordHash,
      password_ciphertext: encryptCredential(adminPassword),
      must_change_password: true,
      email: normalizedEmail,
      first_name: 'ผู้ดูแลโรงเรียน',
      last_name: trimmedName,
      role: 'school_admin',
      school_id: school.id,
      is_active: true,
    })
    .select(
      'id, username, email, first_name, last_name, role, school_id, auth_user_id, auth_login_email, auth_role'
    )
    .single();

  if (adminError || !adminUser) {
    return NextResponse.json(
      {
        school,
        adminCreated: false,
        message: `สร้างโรงเรียนสำเร็จ แต่สร้างบัญชีผู้ดูแลไม่สำเร็จ: ${adminError?.message ?? 'ไม่พบข้อมูลบัญชีที่สร้าง'}`,
      },
      { status: 201 }
    );
  }

  const linkedAdmin = await linkStaffToSupabaseAuth(adminUser, adminPassword);
  if (!linkedAdmin.ok) {
    await supabaseAdmin.from('app_users').delete().eq('id', adminUser.id);
    return NextResponse.json(
      {
        school,
        adminCreated: false,
        message: `สร้างโรงเรียนสำเร็จ แต่สร้าง Supabase Auth ของผู้ดูแลไม่สำเร็จ: ${linkedAdmin.message}`,
      },
      { status: 201 }
    );
  }

  let emailSent = true;
  try {
    await sendSchoolInviteEmail({
      to: normalizedEmail,
      schoolName: trimmedName,
      schoolCode: normalizedCode,
      adminUsername,
      adminPassword,
      signInUrl: new URL(paths.auth.jwt.signIn, request.url).toString(),
    });
  } catch (emailError) {
    console.error('Failed to send school invite email', emailError);
    emailSent = false;
  }

  return NextResponse.json(
    {
      school,
      adminCreated: true,
      emailSent,
      adminUsername,
      // Only sent back to the client when the invite email failed to send,
      // so the caller has a fallback way to hand over the credentials.
      adminPassword: emailSent ? undefined : adminPassword,
    },
    { status: 201 }
  );
}
