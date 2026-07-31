'use client';

import './styles.css';

import NProgress from 'nprogress';
import { isEqualPath } from 'minimal-shared/utils';
import { useRef, useState, useEffect } from 'react';

import { usePathname } from 'src/routes/hooks';

import { SplashScreen } from 'src/components/loading-screen';

// ----------------------------------------------------------------------

//  Checks if an anchor element is valid for triggering the progress bar.
function isValidAnchor(element: HTMLAnchorElement): boolean {
  if (!element) return false;

  const href = element.getAttribute('href')?.trim() ?? '';
  const target = element.getAttribute('target');
  const rel = element.getAttribute('rel');

  return (
    href.startsWith('/') &&
    target !== '_blank' &&
    (!rel || !['noopener', 'noreferrer'].some((v) => rel.includes(v)))
  );
}

// ----------------------------------------------------------------------

function useProgressBar() {
  const pathname = usePathname();
  const currentUrlRef = useRef<string>('');
  const previousPathnameRef = useRef(pathname);
  const navigationTimeoutRef = useRef<number | null>(null);
  const navigationStateTimeoutRef = useRef<number | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Initialize currentUrlRef in the browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      currentUrlRef.current = window.location.href;
    }
  }, []);

  useEffect(() => {
    // Next.js can call history methods from React's insertion phase. Defer state
    // updates intercepted there until React has finished committing the tree.
    const scheduleNavigationState = (value: boolean) => {
      if (navigationStateTimeoutRef.current) {
        window.clearTimeout(navigationStateTimeoutRef.current);
      }
      navigationStateTimeoutRef.current = window.setTimeout(() => {
        navigationStateTimeoutRef.current = null;
        setIsNavigating(value);
      }, 0);
    };

    // Starts the progress bar if navigating to a different URL.
    const handleNavigation = (newUrl: string) => {
      try {
        if (newUrl && !isEqualPath(newUrl, currentUrlRef.current, { deep: false })) {
          currentUrlRef.current = newUrl;
          NProgress.start();
          scheduleNavigationState(true);

          if (navigationTimeoutRef.current) {
            window.clearTimeout(navigationTimeoutRef.current);
          }
          navigationTimeoutRef.current = window.setTimeout(() => {
            NProgress.done();
            setIsNavigating(false);
          }, 15000);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Navigation progress error:', error);
        }
        NProgress.done();
        scheduleNavigationState(false);
      }
    };

    // Handles anchor tag clicks via event delegation.
    const handleClickAnchor = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement;
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;

      if (anchor && !anchor.hasAttribute('download') && isValidAnchor(anchor)) {
        handleNavigation(anchor.href);
      }
    };

    // Handles `popstate` events for browser back/forward navigation.
    const handlePopState = () => {
      handleNavigation(window.location.href);
    };

    // Patches a history method to intercept client-side navigations.
    const patchHistoryMethod = (method: 'pushState' | 'replaceState') => {
      const originalMethod = window.history[method];

      window.history[method] = new Proxy(originalMethod, {
        apply: (target, thisArg, args: [data: any, unused: string, url?: string | URL | null]) => {
          const newUrl = args[2];
          if (typeof newUrl === 'string') {
            handleNavigation(new URL(newUrl, window.location.origin).href);
          }
          return target.apply(thisArg, args);
        },
      });

      return originalMethod;
    };

    const originalPushState = patchHistoryMethod('pushState');
    const originalReplaceState = patchHistoryMethod('replaceState');

    document.addEventListener('click', handleClickAnchor);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('click', handleClickAnchor);
      window.removeEventListener('popstate', handlePopState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      if (navigationTimeoutRef.current) {
        window.clearTimeout(navigationTimeoutRef.current);
      }
      if (navigationStateTimeoutRef.current) {
        window.clearTimeout(navigationStateTimeoutRef.current);
      }
    };
  }, []);

  // Completes the progress bar when pathname changes
  useEffect(() => {
    if (previousPathnameRef.current === pathname) return undefined;

    previousPathnameRef.current = pathname;
    const timeout = window.setTimeout(() => {
      NProgress.done();
      setIsNavigating(false);
      if (navigationTimeoutRef.current) {
        window.clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [pathname]);

  return isNavigating;
}

// ----------------------------------------------------------------------

export function ProgressBar() {
  useEffect(() => {
    NProgress.configure({ showSpinner: false });
    return () => {
      NProgress.done();
    };
  }, []);

  const isNavigating = useProgressBar();

  return isNavigating ? <SplashScreen /> : null;
}
