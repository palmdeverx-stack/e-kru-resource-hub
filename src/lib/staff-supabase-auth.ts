import 'server-only';

import type { AppRole } from 'src/lib/auth-token';

import { createClient } from '@supabase/supabase-js';

import { CONFIG } from 'src/global-config';
import { supabaseAdmin } from 'src/lib/supabase-admin';

// ----------------------------------------------------------------------

export type StaffAuthRole = 'super_admin' | 'school_admin' | 'academic_admin' | 'teacher';

export type StaffAuthUser = {
  id: string;
  username: string;
  email: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role: AppRole;
  school_id: string | null;
  auth_user_id?: string | null;
  auth_login_email?: string | null;
  auth_role?: StaffAuthRole | null;
  is_active?: boolean;
};

type LinkResult =
  | { ok: true; authUserId: string; authLoginEmail: string }
  | { ok: false; message: string };

export function isStaffAuthRole(role: AppRole): boolean {
  return (
    role === 'master_admin' ||
    role === 'marketplace_admin' ||
    role === 'school_admin' ||
    role === 'teacher'
  );
}

export function defaultStaffAuthRole(role: AppRole): StaffAuthRole {
  if (role === 'master_admin' || role === 'marketplace_admin') return 'super_admin';
  if (role === 'school_admin') return 'school_admin';
  return 'teacher';
}

function metadataFor(user: StaffAuthUser) {
  const authRole = user.auth_role ?? defaultStaffAuthRole(user.role);

  return {
    app_metadata: {
      role: authRole,
      app_user_id: user.id,
      school_id: user.school_id,
    },
    user_metadata: {
      username: user.username,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      contact_email: user.email,
    },
  };
}

function isEmail(value: string | null | undefined): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function internalAuthEmail(userId: string): string {
  const configuredDomain = process.env.SUPABASE_INTERNAL_AUTH_EMAIL_DOMAIN?.trim().toLowerCase();
  const domain =
    configuredDomain && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(configuredDomain)
      ? configuredDomain
      : 'users.ekru.app';

  return `${userId}@${domain}`;
}

function isAuthRoleCompatibilityError(message: string | undefined): boolean {
  if (!message) return false;

  const normalized = message.toLowerCase();
  return (
    normalized.includes('auth_role') ||
    (normalized.includes('check constraint') && normalized.includes('app_users'))
  );
}

async function createAuthIdentity(
  user: StaffAuthUser,
  password: string,
  email: string,
  omitProfileUsername = false
) {
  const metadata = metadataFor(user);

  return supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    ...(user.is_active === false && { ban_duration: '876000h' }),
    ...metadata,
    ...(omitProfileUsername && {
      // The shared Supabase project has an auth.users trigger that copies this
      // value into profiles.username, where legacy usernames may already exist.
      // Restore the real Auth metadata after the insert trigger has completed.
      user_metadata: { ...metadata.user_metadata, username: null },
    }),
  });
}

/**
 * Creates and links a shared Supabase Auth identity. If a contact email is
 * already registered, a stable internal email is used while the public
 * contact email remains in user_metadata.
 */
export async function linkStaffToSupabaseAuth(
  user: StaffAuthUser,
  password: string
): Promise<LinkResult> {
  if (!isStaffAuthRole(user.role)) {
    return { ok: false, message: 'บัญชีประเภทนี้ไม่ได้ใช้ Supabase Auth' };
  }
  if (user.auth_user_id && user.auth_login_email) {
    return {
      ok: true,
      authUserId: user.auth_user_id,
      authLoginEmail: user.auth_login_email,
    };
  }

  const fallbackEmail = internalAuthEmail(user.id);
  const preferredEmail = isEmail(user.email) ? user.email.toLowerCase() : fallbackEmail;
  let usesInternalEmail = preferredEmail === fallbackEmail;
  let authResult = await createAuthIdentity(user, password, preferredEmail, usesInternalEmail);
  let authLoginEmail = preferredEmail;

  if (authResult.error && preferredEmail !== fallbackEmail) {
    authLoginEmail = fallbackEmail;
    usesInternalEmail = true;
    authResult = await createAuthIdentity(user, password, authLoginEmail, true);
  }

  const authUser = authResult.data.user;
  if (authResult.error || !authUser) {
    return {
      ok: false,
      message: `สร้าง Supabase Auth identity ไม่สำเร็จ: ${
        authResult.error?.message ?? 'ไม่พบข้อมูลผู้ใช้ที่สร้าง'
      }`,
    };
  }

  if (usesInternalEmail) {
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      metadataFor(user)
    );

    if (metadataError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      return {
        ok: false,
        message: `อัปเดต Supabase Auth metadata ไม่สำเร็จ: ${metadataError.message}`,
      };
    }
  }

  const migratedAt = new Date().toISOString();
  const linkPayload = {
    auth_user_id: authUser.id,
    auth_login_email: authLoginEmail,
    auth_migrated_at: migratedAt,
    password_ciphertext: null,
  };
  let linkResult = await supabaseAdmin
    .from('app_users')
    .update({
      ...linkPayload,
      auth_role: user.auth_role ?? defaultStaffAuthRole(user.role),
    })
    .eq('id', user.id)
    .is('auth_user_id', null)
    .select('id, auth_user_id, auth_login_email')
    .maybeSingle();

  // Some older e-Kru databases have an auth_role check constraint that was
  // created before super_admin existed. The role is still carried safely in
  // Supabase app_metadata; omitting this compatibility column lets the shared
  // identity migration complete until that schema is upgraded.
  if (linkResult.error && isAuthRoleCompatibilityError(linkResult.error.message)) {
    linkResult = await supabaseAdmin
      .from('app_users')
      .update(linkPayload)
      .eq('id', user.id)
      .is('auth_user_id', null)
      .select('id, auth_user_id, auth_login_email')
      .maybeSingle();
  }

  if (linkResult.error || !linkResult.data) {
    // Another request may have linked the account while this identity was
    // being created. Prefer the existing link and remove only our orphan.
    const { data: existingLink } = await supabaseAdmin
      .from('app_users')
      .select('auth_user_id, auth_login_email')
      .eq('id', user.id)
      .maybeSingle();

    await supabaseAdmin.auth.admin.deleteUser(authUser.id);

    if (existingLink?.auth_user_id && existingLink.auth_login_email) {
      return {
        ok: true,
        authUserId: existingLink.auth_user_id,
        authLoginEmail: existingLink.auth_login_email,
      };
    }

    return {
      ok: false,
      message: `บันทึก auth_user_id ลง app_users ไม่สำเร็จ: ${
        linkResult.error?.message ?? 'ไม่พบแถวบัญชีสำหรับเชื่อมโยง'
      }`,
    };
  }

  return { ok: true, authUserId: authUser.id, authLoginEmail };
}

export async function verifyStaffSupabasePassword(
  user: StaffAuthUser,
  password: string
): Promise<boolean> {
  if (!user.auth_user_id) return false;

  let authLoginEmail = user.auth_login_email;
  if (!authLoginEmail) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(user.auth_user_id);
    authLoginEmail = data.user?.email ?? null;
  }
  if (!authLoginEmail || !CONFIG.supabase.url || !CONFIG.supabase.key) return false;

  // A request-scoped client avoids sharing an Auth session between concurrent logins.
  const authClient = createClient(CONFIG.supabase.url, CONFIG.supabase.key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error } = await authClient.auth.signInWithPassword({
    email: authLoginEmail,
    password,
  });

  return !error;
}

export async function syncLinkedStaffAuth(
  user: StaffAuthUser,
  changes: {
    password?: string;
    isActive?: boolean;
  } = {}
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!user.auth_user_id) return { ok: true };

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.auth_user_id, {
    ...(changes.password && { password: changes.password }),
    ...(changes.isActive !== undefined && {
      ban_duration: changes.isActive ? 'none' : '876000h',
    }),
    ...metadataFor(user),
  });

  return error ? { ok: false, message: error.message } : { ok: true };
}
