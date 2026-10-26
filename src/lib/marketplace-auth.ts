import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { CONFIG } from 'src/global-config';

export async function verifyMarketplacePassword(
  email: string | null,
  password: string
): Promise<boolean> {
  if (!email || !CONFIG.supabase.url || !CONFIG.supabase.key) return false;

  const authClient = createClient(CONFIG.supabase.url, CONFIG.supabase.key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error } = await authClient.auth.signInWithPassword({ email, password });

  return !error;
}
