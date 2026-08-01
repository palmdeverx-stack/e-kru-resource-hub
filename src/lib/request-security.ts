import 'server-only';

import { NextResponse } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function normalizedOrigin(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Cookie-authenticated mutations must originate from this exact origin.
 * Webhooks are intentionally excluded and continue to use provider signatures.
 */
export function sameOriginMutation(request: Request) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  const requestOrigin = new URL(request.url).origin;
  const origin = normalizedOrigin(request.headers.get('origin'));
  const fetchSite = request.headers.get('sec-fetch-site');

  return origin === requestOrigin && (!fetchSite || fetchSite === 'same-origin');
}

export function rejectCrossSiteMutation(request: Request) {
  if (sameOriginMutation(request)) return null;
  return NextResponse.json({ message: 'คำขอจากเว็บไซต์อื่นไม่ได้รับอนุญาต' }, { status: 403 });
}
