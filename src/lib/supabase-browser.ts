'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { CONFIG } from 'src/global-config';

let client: SupabaseClient | undefined;

export function getSupabaseBrowserClient() {
  if (!CONFIG.supabase.url || !CONFIG.supabase.key) {
    throw new Error('ยังไม่ได้ตั้งค่า Supabase สำหรับเข้าสู่ระบบด้วย Google');
  }

  client ??= createClient(CONFIG.supabase.url, CONFIG.supabase.key, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return client;
}
