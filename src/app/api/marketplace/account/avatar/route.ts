import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

const GOOGLE_AVATAR_HOSTS = ['googleusercontent.com', 'ggpht.com'];

function isAllowedGoogleAvatar(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      GOOGLE_AVATAR_HOSTS.some(
        (hostname) => url.hostname === hostname || url.hostname.endsWith(`.${hostname}`)
      )
    );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const caller = requireAuthenticated(request);
  if (!caller) return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const { data: user, error } = await supabaseAdmin
    .from(caller.role === 'marketplace_user' ? 'marketplace_users' : 'app_users')
    .select('avatar_url')
    .eq('id', caller.sub)
    .maybeSingle();
  const avatarUrl = String(user?.avatar_url ?? '').trim();
  if (error || !isAllowedGoogleAvatar(avatarUrl)) {
    return NextResponse.json({ message: 'ไม่พบรูปโปรไฟล์ Google' }, { status: 404 });
  }

  try {
    const response = await fetch(avatarUrl, {
      cache: 'no-store',
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg' },
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.startsWith('image/')) {
      return NextResponse.json({ message: 'โหลดรูปโปรไฟล์ Google ไม่สำเร็จ' }, { status: 502 });
    }

    return new Response(await response.arrayBuffer(), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ message: 'โหลดรูปโปรไฟล์ Google ไม่สำเร็จ' }, { status: 502 });
  }
}
