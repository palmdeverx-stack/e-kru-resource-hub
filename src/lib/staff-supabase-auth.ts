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
  return role === 'master_admin' || role === 'school_admin' || role === 'teacher';
}

export function defaultStaffAuthRole(role: AppRole): StaffAuthRole {
  if (role === 'master_admin') return 'super_admin';
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
  return `${userId}@users.i-scores.local`;
}

async function createAuthIdentity(
  user: StaffAuthUser,
  password: string,
  email: string
) {
  return supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    ...(user.is_active === false && { ban_duration: '876000h' }),
    ...metadataFor(user),
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

  const preferredEmail = isEmail(user.email) ? user.email.toLowerCase() : internalAuthEmail(user.id);
  let authResult = await createAuthIdentity(user, password, preferredEmail);
  let authLoginEmail = preferredEmail;

  if (authResult.error && preferredEmail !== internalAuthEmail(user.id)) {
    authLoginEmail = internalAuthEmail(user.id);
    authResult = await createAuthIdentity(user, password, authLoginEmail);
  }

  const authUser = authResult.data.user;
  if (authResult.error || !authUser) {
    return {
      ok: false,
      message: authResult.error?.message ?? 'ไม่สามารถสร้างบัญชี Supabase Auth ได้',
    };
  }

  const { data: linkedUser, error: linkError } = await supabaseAdmin
    .from('app_users')
    .update({
      auth_user_id: authUser.id,
      auth_login_email: authLoginEmail,
      auth_role: user.auth_role ?? defaultStaffAuthRole(user.role),
      auth_migrated_at: new Date().toISOString(),
      password_ciphertext: null,
    })
    .eq('id', user.id)
    .is('auth_user_id', null)
    .select('id')
    .maybeSingle();

  if (linkError || !linkedUser) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    return {
      ok: false,
      message: linkError?.message ?? 'บัญชีนี้ถูกเชื่อมกับ Supabase Auth แล้ว',
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
