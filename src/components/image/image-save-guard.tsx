'use client';

import { useEffect } from 'react';

// ----------------------------------------------------------------------

const ALLOW_IMAGE_SAVE_SELECTOR = '[data-allow-image-save="true"]';

function getImageTarget(event: MouseEvent | DragEvent) {
  const target = event.target;

  if (!(target instanceof Element)) return null;

  const image = target.closest('img');
  if (!image || image.matches(ALLOW_IMAGE_SAVE_SELECTOR)) return null;

  return image;
}

export function ImageSaveGuard() {
  useEffect(() => {
    const preventImageContextMenu = (event: MouseEvent) => {
      if (getImageTarget(event)) event.preventDefault();
    };

    const preventImageDrag = (event: DragEvent) => {
      if (getImageTarget(event)) event.preventDefault();
    };

    document.addEventListener('contextmenu', preventImageContextMenu, true);
    document.addEventListener('dragstart', preventImageDrag, true);

    return () => {
      document.removeEventListener('contextmenu', preventImageContextMenu, true);
      document.removeEventListener('dragstart', preventImageDrag, true);
    };
  }, []);

  return null;
}
