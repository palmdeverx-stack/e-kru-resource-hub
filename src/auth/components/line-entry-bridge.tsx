'use client';

import { useEffect } from 'react';

import { useAuthContext } from '../hooks';

/** Support MINI Apps whose primary endpoint is still the marketplace root. */
export function LineEntryBridge() {
  const { loading, authenticated } = useAuthContext();

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (loading || authenticated || !liffId || window.location.protocol !== 'https:')
      return undefined;
    if (window.location.pathname !== '/') return undefined;
    const params = new URLSearchParams(window.location.search);
    const isLineEntry =
      /Line\//i.test(navigator.userAgent) ||
      [...params.keys()].some((key) => key.startsWith('liff.')) ||
      (params.has('code') && params.has('state'));
    if (!isLineEntry) return undefined;

    let cancelled = false;
    async function enter() {
      try {
        const { default: liff } = await import('@line/liff');
        // Let LIFF consume its primary redirect parameters before changing the URL.
        await liff.init({ liffId: liffId! });
        if (!cancelled && liff.isLoggedIn() && window.location.pathname === '/') {
          window.location.replace('/auth/line?returnTo=%2F');
        }
      } catch {
        // The normal sign-in button remains available for an explicit retry.
      }
    }
    void enter();
    return () => {
      cancelled = true;
    };
  }, [authenticated, loading]);

  return null;
}
