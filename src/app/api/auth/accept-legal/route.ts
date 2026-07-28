import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { toPublicUser, verifyAppToken, getRequestToken } from 'src/lib/auth-token';

// ----------------------------------------------------------------------

export async function POST(request: Request) {
  const token = getRequestToken(request);
  const payload = token ? verifyAppToken(token) : null;

  if (!payload) {
    return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const { data: user, error } = await supabaseAdmin
    .from('app_users')
    .update({ accepted_legal_at: new Date().toISOString() })
    .eq('id', payload.sub)
    .select('*')
    .single();

  if (error || !user) {
    return NextResponse.json(
      { message: error?.message ?? 'Failed to record acceptance' },
      { status: 500 }
    );
  }

  return NextResponse.json({ user: toPublicUser(user) });
}
