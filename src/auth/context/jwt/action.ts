'use client';

import { CONFIG } from 'src/global-config';
import { apiFetch as fetch } from 'src/lib/api-fetch';

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
  role:
    | 'master_admin'
    | 'marketplace_admin'
    | 'school_admin'
    | 'teacher'
    | 'student'
    | 'marketplace_user';
  school_id: string | null;
  access_scope?: 'full' | 'marketplace_only';
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

  const user = result.user as AppUser;
  if (user.role === 'marketplace_user' && user.email) {
    const { getSupabaseBrowserClient } = await import('src/lib/supabase-browser');
    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (error) {
      await fetch('/api/auth/sign-out', { method: 'POST', cache: 'no-store' });
      throw new Error('สร้าง session สำหรับยืนยันคำเชิญไม่สำเร็จ กรุณาลองเข้าสู่ระบบใหม่');
    }
  }

  return user;
};

export const signInWithGoogle = async (idToken: string): Promise<AppUser | PinChallenge> => {
  if (!idToken) throw new Error('ไม่พบ Google ID Token');

  const { getSupabaseBrowserClient } = await import('src/lib/supabase-browser');
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error || !data.session?.access_token) {
    throw new Error(error?.message ?? 'สร้าง Google session ไม่สำเร็จ');
  }

  const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  const result = await response.json();
  if (!response.ok) {
    await supabase.auth.signOut();
    throw new Error(result.message ?? 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
  }

  return result.requiresPin ? (result as PinChallenge) : (result.user as AppUser);
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
}: SignUpParams): Promise<SignUpResult> =>
  (await postJson('/api/auth/sign-up', {
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
export const signOut = async (options?: { redirectToHome?: boolean }): Promise<void> => {
  const response = await fetch('/api/auth/sign-out', {
    method: 'POST',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('ไม่สามารถออกจากระบบได้');
  }

  if (options?.redirectToHome && typeof window !== 'undefined') {
    // The server has confirmed cookie removal. Revoke the optional OAuth session
    // without downloading/locking the SDK or delaying full-page navigation.
    try {
      if (CONFIG.supabase.url) {
        const projectRef = new URL(CONFIG.supabase.url).hostname.split('.')[0];
        const key = `sb-${projectRef}-auth-token`;
        const stored = window.localStorage.getItem(key);
        let accessToken: unknown;
        try {
          accessToken = stored ? JSON.parse(stored)?.access_token : undefined;
        } catch {
          // Invalid persisted state still needs to be removed.
        }
        if (typeof accessToken === 'string' && accessToken && CONFIG.supabase.key) {
          void fetch(`${CONFIG.supabase.url.replace(/\/$/, '')}/auth/v1/logout?scope=local`, {
            method: 'POST',
            headers: { apikey: CONFIG.supabase.key, Authorization: `Bearer ${accessToken}` },
            keepalive: true,
          }).catch(() => undefined);
        }
        window.localStorage.removeItem(key);
        window.localStorage.removeItem(`${key}-code-verifier`);
        window.localStorage.removeItem(`${key}-user`);
      }
    } catch {
      // Restricted browser storage must not delay logout after cookie removal.
    }
    window.location.replace('/');
    return;
  }

  // Password/PIN accounts often have no Supabase browser session. Avoid
  // downloading and initializing the SDK solely to clear an absent session.
  if (typeof window === 'undefined' || !CONFIG.supabase.url) return;
  try {
    const projectRef = new URL(CONFIG.supabase.url).hostname.split('.')[0];
    if (!window.localStorage.getItem(`sb-${projectRef}-auth-token`)) return;
  } catch {
    // If storage cannot be inspected, let the SDK perform its normal cleanup.
  }

  let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const cleanup = (async () => {
      const { getSupabaseBrowserClient } = await import('src/lib/supabase-browser');
      await getSupabaseBrowserClient().auth.signOut({ scope: 'local' });
    })();
    // The app cookie has already been removed. Optional OAuth cleanup must not
    // hold logout/navigation indefinitely when the SDK or its network call hangs.
    await Promise.race([
      cleanup,
      new Promise<void>((resolve) => {
        cleanupTimer = setTimeout(resolve, 1500);
      }),
    ]);
  } catch {
    // An expired optional Supabase session must not prevent application logout.
  } finally {
    if (cleanupTimer) clearTimeout(cleanupTimer);
    try {
      const projectRef = new URL(CONFIG.supabase.url).hostname.split('.')[0];
      const key = `sb-${projectRef}-auth-token`;
      window.localStorage.removeItem(key);
      window.localStorage.removeItem(`${key}-code-verifier`);
      window.localStorage.removeItem(`${key}-user`);
    } catch {
      // Browsers may restrict storage; the server cookie remains cleared.
    }
  }
};
