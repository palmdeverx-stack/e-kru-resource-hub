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

import { notifyMarketplaceMemberRegistered } from 'src/sections/marketplace/admin/server/line-notifications';

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
    const { idToken, accessToken, action, firstName, lastName, acceptedTerms } =
      await request.json();
    const validToken = (value: unknown): value is string =>
      typeof value === 'string' && value.length > 0 && value.length <= 10000;
    if (
      !['login', 'link', 'register'].includes(action) ||
      (!validToken(idToken) && !validToken(accessToken))
    ) {
      return fail('ข้อมูลคำขอไม่ถูกต้อง', 400);
    }
    let subject: string;
    if (idToken != null) {
      if (!validToken(idToken)) return fail('ข้อมูลคำขอไม่ถูกต้อง', 400);
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
      ) {
        return fail('ข้อมูลยืนยัน LINE ไม่ถูกต้อง', 401);
      }
      subject = identity.sub;
    } else {
      // LIFF / MINI Apps can provide an access token without an OpenID token.
      // Verify its issuing channel and expiry before requesting identity from LINE.
      const verified = await fetch(
        `https://api.line.me/oauth2/v2.1/verify?${new URLSearchParams({ access_token: accessToken })}`,
        {
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        }
      );
      if (!verified.ok) return fail('ยืนยันบัญชี LINE ไม่สำเร็จ กรุณาเข้าสู่ LINE ใหม่', 401);
      const token = await verified.json();
      if (
        token.client_id !== channelId ||
        typeof token.expires_in !== 'number' ||
        token.expires_in <= 0
      ) {
        return fail('ข้อมูลยืนยัน LINE ไม่ถูกต้อง', 401);
      }
      const profileResponse = await fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (!profileResponse.ok)
        return fail(
          'อ่านข้อมูล LINE ไม่สำเร็จ กรุณาอนุญาตสิทธิ์ profile แล้วเข้าสู่ LINE ใหม่',
          401
        );
      const profile = await profileResponse.json();
      if (typeof profile.userId !== 'string' || !profile.userId)
        return fail('ไม่พบข้อมูลบัญชี LINE', 401);
      subject = profile.userId;
    }

    if (action === 'link') {
      const caller = requireAuthenticated(request);
      if (!caller || !(await isActiveTokenAccount(caller)))
        return fail('กรุณาเข้าสู่ระบบก่อนเชื่อม LINE', 401);
      if (caller.role !== 'marketplace_user')
        return fail('รองรับการเชื่อมบัญชีสมาชิก Marketplace เท่านั้น', 403);
      const { error } = await supabaseAdmin.from('marketplace_line_identities').insert({
        user_id: caller.sub,
        channel_id: channelId,
        line_subject: subject,
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
      .eq('line_subject', subject)
      .maybeSingle();
    if (linkError) return fail('ระบบ LINE ยังไม่พร้อมใช้งาน', 503);
    let userId = link?.user_id;
    if (!userId && action === 'register') {
      if (requireAuthenticated(request))
        return fail('กรุณาใช้การเชื่อม LINE กับบัญชีที่เข้าสู่ระบบอยู่', 409);
      if (
        acceptedTerms !== true ||
        typeof firstName !== 'string' ||
        typeof lastName !== 'string' ||
        !firstName.trim() ||
        !lastName.trim() ||
        firstName.trim().length > 100 ||
        lastName.trim().length > 100
      ) {
        return fail('กรุณากรอกชื่อ นามสกุล และยอมรับเงื่อนไขการใช้งาน', 400);
      }
      if (
        !(await isActionAllowed({
          request,
          action: 'line_register',
          subject,
          maxAttempts: 5,
          windowSeconds: 3600,
        }))
      ) {
        return fail('สมัครสมาชิกบ่อยเกินไป กรุณาลองใหม่ภายหลัง', 429);
      }
      const { data: registeredId, error: registrationError } = await supabaseAdmin.rpc(
        'register_marketplace_line_member',
        {
          p_channel_id: channelId,
          p_subject: subject,
          p_first_name: firstName.trim(),
          p_last_name: lastName.trim(),
        }
      );
      if (registrationError || !registeredId)
        return fail('สมัครด้วย LINE ไม่สำเร็จ กรุณาตรวจสอบว่าได้รัน migration ล่าสุดแล้ว', 503);
      userId = registeredId;
      after(() =>
        notifyMarketplaceMemberRegistered({
          userId: registeredId,
          name: `${firstName.trim()} ${lastName.trim()}`,
          method: 'LINE',
          origin: new URL(request.url).origin,
        })
      );

      after(() =>
        writeSecurityAudit({
          request,
          actorId: userId,
          category: 'authentication',
          action: 'auth.line_register',
          result: 'success',
        })
      );
    }
    if (!userId)
      return NextResponse.json(
        {
          needsRegistration: true,
          message: 'LINE นี้ยังไม่มีบัญชี E-KRU สมัครด้วย LINE หรือเชื่อมบัญชีเดิมได้เลย',
        },
        { status: 409 }
      );
    const { data: user, error } = await supabaseAdmin
      .from('marketplace_users')
      .select('*')
      .eq('id', userId)
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
