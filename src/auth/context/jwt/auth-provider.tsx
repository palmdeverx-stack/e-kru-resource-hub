'use client';

import type { AuthState } from '../../types';

import { useSetState } from 'minimal-shared/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useMemo, useEffect, useCallback } from 'react';

import { setApiCacheScope, apiFetch as fetch } from 'src/lib/api-fetch';

import { AuthContext } from '../auth-context';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const queryClient = useQueryClient();
  const sessionVersion = useRef(0);
  const pendingSession = useRef<Promise<void> | null>(null);
  const { state, setState } = useSetState<AuthState>({ user: null, loading: true });

  const setSessionUser = useCallback(
    (user: AuthState['user']) => {
      // Invalidate an older /me response before committing a login/logout.
      sessionVersion.current += 1;
      pendingSession.current = null;
      setApiCacheScope(user ? `${user.id}:${user.role}:${user.school_id ?? ''}` : 'guest');
      queryClient.clear();
      setState({ user, loading: false });
    },
    [queryClient, setState]
  );

  const checkUserSession = useCallback((): Promise<void> => {
    if (pendingSession.current) return pendingSession.current;
    const version = sessionVersion.current;
    const pending = (async () => {
      try {
        const response = await fetch('/api/auth/me', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const user = response.ok ? (await response.json()).user : null;
        if (version === sessionVersion.current) {
          setApiCacheScope(user ? `${user.id}:${user.role}:${user.school_id ?? ''}` : 'guest');
          setState({ user, loading: false });
        }
      } catch (error) {
        console.error(error);
        if (version === sessionVersion.current) {
          setApiCacheScope('guest');
          setState({ user: null, loading: false });
        }
      }
    })();
    pendingSession.current = pending;
    void pending.finally(() => {
      if (pendingSession.current === pending) pendingSession.current = null;
    });
    return pending;
  }, [setState]);

  useEffect(() => {
    checkUserSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------------------

  const checkAuthenticated = state.user ? 'authenticated' : 'unauthenticated';

  const status = state.loading ? 'loading' : checkAuthenticated;

  const memoizedValue = useMemo(
    () => ({
      user: state.user
        ? {
            ...state.user,
            id: state.user?.id,
            displayName:
              `${state.user?.first_name ?? ''} ${state.user?.last_name ?? ''}`.trim() ||
              state.user?.username,
            role: state.user?.role ?? 'student',
          }
        : null,
      setSessionUser,
      checkUserSession,
      loading: status === 'loading',
      authenticated: status === 'authenticated',
      unauthenticated: status === 'unauthenticated',
    }),
    [checkUserSession, setSessionUser, state.user, status]
  );

  return <AuthContext value={memoizedValue}>{children}</AuthContext>;
}
