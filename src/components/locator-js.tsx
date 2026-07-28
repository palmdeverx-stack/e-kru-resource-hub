'use client';

import { useEffect } from 'react';

let locatorStarted = false;

export function LocatorJS() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || locatorStarted) {
      return;
    }

    locatorStarted = true;
    import('@locator/runtime').then(({ default: setupLocatorUI }) => setupLocatorUI());
  }, []);

  return null;
}
