'use client';

import { useRef, useState, useEffect } from 'react';

// Start requests ahead of scrolling into a section, and keep it loaded afterwards.
export function useNearViewport() {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    if (!('IntersectionObserver' in window)) {
      setEnabled(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setEnabled(true);
          observer.disconnect();
        }
      },
      { rootMargin: '800px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, enabled };
}
