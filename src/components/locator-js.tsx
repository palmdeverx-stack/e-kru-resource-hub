'use client';

import { useEffect } from 'react';

let locatorStarted = false;

export function LocatorJS() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'development' ||
      process.env.NEXT_PUBLIC_ENABLE_LOCATOR !== 'true' ||
      locatorStarted
    ) {
      return;
    }

    locatorStarted = true;
    import('@locator/runtime').then(({ default: setupLocatorUI }) => setupLocatorUI());
  }, []);

  return null;
}
