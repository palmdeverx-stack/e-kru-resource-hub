'use client';

import type { SettingsDrawerProps } from './types';

import { useRef } from 'react';
import dynamic from 'next/dynamic';

import { useSettingsContext } from './context';

// ----------------------------------------------------------------------

const SettingsDrawer = dynamic(() => import('./drawer').then((module) => module.SettingsDrawer), {
  ssr: false,
});

export function LazySettingsDrawer(props: SettingsDrawerProps) {
  const settings = useSettingsContext();
  const hasOpened = useRef(false);

  if (settings.openDrawer) {
    hasOpened.current = true;
  }

  if (!hasOpened.current) {
    return null;
  }

  return <SettingsDrawer {...props} />;
}
