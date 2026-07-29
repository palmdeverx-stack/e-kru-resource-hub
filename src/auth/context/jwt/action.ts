'use client';

// ----------------------------------------------------------------------

export type SignInParams = {
  username: string;
  password: string;
};

export type PinChallenge = {
  requiresPin: true;
  pinChallengeToken: string;
  role: 'master_admin' | 'school_admin';
};

export type SignUpParams = {
  username: string;
  password: string;
  email?: string;
  firstName: string;
  lastName: string;
};

export type SignUpResult = {
  requiresVerification: true;
  email: string;
  expiresInMinutes: number;
};

export type AppUser = {
  id: string;
  username: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: 'master_admin' | 'school_admin' | 'teacher' | 'student' | 'marketplace_user';
  school_id: string | null;
  created_at: string;
  must_change_password: boolean;
  accepted_legal_at: string | null;
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  let json: Record<string, any>;

  try {
    json = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(
      response.ok
        ? 'เซิร์ฟเวอร์ตอบกลับในรูปแบบที่ไม่ถูกต้อง'
        : 'ระบบเข้าสู่ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง'
    );
  }

  if (!response.ok) {
    throw new Error(json.message ?? 'Request failed');
  }

  return json;
}

/** **************************************
 * Sign in
 *************************************** */
export const signInWithPassword = async ({
  username,
  password,
}: SignInParams): Promise<AppUser | PinChallenge> => {
  const result = await postJson('/api/auth/sign-in', { username, password });

  if (result.requiresPin) {
    return result as PinChallenge;
  }

  return result.user;
};

export const signInWithGoogle = async (returnTo?: string | null): Promise<void> => {
  const { getSupabaseBrowserClient } = await import('src/lib/supabase-browser');
  const callbackUrl = new URL('/auth/google/callback', window.location.origin);
  if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) {
    callbackUrl.searchParams.set('returnTo', returnTo);
  }

  const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
};

export const verifySignInPin = async ({
  pinChallengeToken,
  pin,
}: {
  pinChallengeToken: string;
  pin: string;
}): Promise<AppUser> => {
  const { user } = await postJson('/api/auth/verify-pin', { pinChallengeToken, pin });

  return user;
};

/** **************************************
 * Sign up
 *************************************** */
export const signUp = async ({
  username,
  password,
  email,
  firstName,
  lastName,
}: SignUpParams): Promise<SignUpResult> => (await postJson('/api/auth/sign-up', {
    username,
    password,
    email,
    firstName,
    lastName,
  })) as SignUpResult;

export const verifyEmailCode = async (params: {
  email: string;
  code: string;
}): Promise<AppUser> => {
  const { user } = await postJson('/api/auth/verify-email', params);
  return user;
};

export const resendVerificationCode = async (email: string): Promise<{ message: string }> =>
  (await postJson('/api/auth/resend-verification', { email })) as { message: string };

/** **************************************
 * Change password (forced on first login for auto-generated accounts)
 *************************************** */
export const changePassword = async (newPassword: string): Promise<AppUser> => {
  const response = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message ?? 'Failed to change password');
  }

  return json.user;
};

/** **************************************
 * Accept terms of service / privacy policy (forced on first use for every role)
 *************************************** */
export const acceptLegal = async (): Promise<AppUser> => {
  const response = await fetch('/api/auth/accept-legal', { method: 'POST' });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message ?? 'Failed to record acceptance');
  }

  return json.user;
};

/** **************************************
 * Sign out
 *************************************** */
export const signOut = async (): Promise<void> => {
  const response = await fetch('/api/auth/sign-out', {
    method: 'POST',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('ไม่สามารถออกจากระบบได้');
  }

  try {
    const { getSupabaseBrowserClient } = await import('src/lib/supabase-browser');
    await getSupabaseBrowserClient().auth.signOut({ scope: 'local' });
  } catch {
    // The application cookie is already cleared. A missing/expired optional
    // Supabase browser session must not prevent a normal sign-out.
  }
};
