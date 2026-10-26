import { after, NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { isActionAllowed } from 'src/lib/auth-rate-limit';
import { writeSecurityAudit } from 'src/lib/security-audit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import {
  signAppToken,
  toPublicUser,
  ACCESS_TOKEN_COOKIE,
  requireAuthenticated,
  isActiveTokenAccount,
  accessTokenCookieOptions,
} from 'src/lib/auth-token';

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const fail = (message: string, status: number) => NextResponse.json({ message }, { status });
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) return fail('ยังไม่ได้ตั้งค่า LINE Login', 503);

  try {
    if (
      !(await isActionAllowed({
        request,
        action: 'line_login',
        maxAttempts: 20,
        windowSeconds: 60,
      }))
    ) {
      return fail('กรุณารอสักครู่ก่อนลองใหม่', 429);
    }
    const { idToken, action } = await request.json();
    if (
      typeof idToken !== 'string' ||
      idToken.length > 10000 ||
      !['login', 'link'].includes(action)
    ) {
      return fail('ข้อมูลคำขอไม่ถูกต้อง', 400);
    }
    // Use only the identity returned by LINE's verification endpoint, never client profile data.
    const verified = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!verified.ok) return fail('ยืนยันบัญชี LINE ไม่สำเร็จ กรุณาเข้าสู่ LINE ใหม่', 401);
    const identity = await verified.json();
    if (
      identity.iss !== 'https://access.line.me' ||
      identity.aud !== channelId ||
      typeof identity.sub !== 'string' ||
      !identity.sub ||
      typeof identity.exp !== 'number' ||
      identity.exp <= Date.now() / 1000
    )
      return fail('ข้อมูลยืนยัน LINE ไม่ถูกต้อง', 401);

    if (action === 'link') {
      const caller = requireAuthenticated(request);
      if (!caller || !(await isActiveTokenAccount(caller)))
        return fail('กรุณาเข้าสู่ระบบก่อนเชื่อม LINE', 401);
      if (caller.role !== 'marketplace_user')
        return fail('รองรับการเชื่อมบัญชีสมาชิก Marketplace เท่านั้น', 403);
      const { error } = await supabaseAdmin.from('marketplace_line_identities').insert({
        user_id: caller.sub,
        channel_id: channelId,
        line_subject: identity.sub,
      });
      if (error)
        return fail(
          error.code === '23505' ? 'บัญชีนี้หรือ LINE นี้เชื่อมไว้แล้ว' : 'เชื่อม LINE ไม่สำเร็จ',
          error.code === '23505' ? 409 : 500
        );
      after(() =>
        writeSecurityAudit({
          request,
          actorId: caller.sub,
          category: 'authentication',
          action: 'auth.line_link',
          result: 'success',
        })
      );
      return NextResponse.json({ linked: true });
    }

    const { data: link, error: linkError } = await supabaseAdmin
      .from('marketplace_line_identities')
      .select('user_id')
      .eq('channel_id', channelId)
      .eq('line_subject', identity.sub)
      .maybeSingle();
    if (linkError) return fail('ระบบ LINE ยังไม่พร้อมใช้งาน', 503);
    if (!link)
      return NextResponse.json(
        {
          needsLink: true,
          message: 'กรุณาเข้าสู่ระบบหรือสมัครสมาชิก E-KRU ก่อน แล้วกลับมาเชื่อม LINE',
        },
        { status: 409 }
      );
    const { data: user, error } = await supabaseAdmin
      .from('marketplace_users')
      .select('*')
      .eq('id', link.user_id)
      .single();
    if (error || !user) return fail('ไม่พบบัญชีสมาชิก', 401);
    if (user.is_suspended === true || user.is_active !== true)
      return fail('บัญชีนี้ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ', 403);
    const response = NextResponse.json({
      user: toPublicUser({ ...user, role: 'marketplace_user', school_id: null }),
    });
    response.cookies.set(
      ACCESS_TOKEN_COOKIE,
      signAppToken({
        sub: user.id,
        username: user.username,
        role: 'marketplace_user',
        schoolId: null,
        sessionVersion: Number(user.session_version ?? 0),
      }),
      accessTokenCookieOptions
    );
    response.headers.set('Cache-Control', 'no-store');
    after(() =>
      writeSecurityAudit({
        request,
        actorId: user.id,
        category: 'authentication',
        action: 'auth.line_login',
        result: 'success',
      })
    );
    return response;
  } catch {
    return fail('ไม่สามารถเชื่อมต่อ LINE ได้ กรุณาลองใหม่อีกครั้ง', 503);
  }
}
