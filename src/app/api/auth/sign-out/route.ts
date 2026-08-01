import { NextResponse } from 'next/server';

import { writeSecurityAudit } from 'src/lib/security-audit';
import { rejectCrossSiteMutation } from 'src/lib/request-security';
import { ACCESS_TOKEN_COOKIE, requireAuthenticated } from 'src/lib/auth-token';

// ----------------------------------------------------------------------

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;
  const caller = requireAuthenticated(request);
  const response = NextResponse.json({ success: true });
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  await writeSecurityAudit({
    request,
    actorId: caller?.sub,
    actorUsername: caller?.username,
    actorRole: caller?.role,
    category: 'authentication',
    action: 'auth.logout',
    targetType: 'user_account',
    targetId: caller?.sub,
    result: 'success',
  });
  return response;
}
