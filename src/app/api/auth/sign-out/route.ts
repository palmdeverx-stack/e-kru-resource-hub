import { NextResponse } from 'next/server';

import { ACCESS_TOKEN_COOKIE } from 'src/lib/auth-token';

// ----------------------------------------------------------------------

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  return response;
}
