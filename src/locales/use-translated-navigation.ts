'use client';

import type { NavMainProps } from 'src/layouts/main/nav/types';
import type { NavSectionProps, NavItemDataProps } from 'src/components/nav-section';

import { useMemo } from 'react';

import { useTranslate } from './use-locales';

// ----------------------------------------------------------------------

export function useTranslatedNavSections(data: NavSectionProps['data']) {
  const { t, currentLang } = useTranslate('navbar');

  return useMemo(() => {
    const translateItem = (item: NavItemDataProps): NavItemDataProps => ({
      ...item,
      title: t(item.title, { defaultValue: item.title }),
      caption: item.caption ? t(item.caption, { defaultValue: item.caption }) : item.caption,
      children: item.children?.map(translateItem),
    });

    return data.map((section) => ({
      ...section,
      subheader: section.subheader
        ? t(section.subheader, { defaultValue: section.subheader })
        : section.subheader,
      items: section.items.map(translateItem),
    }));
  }, [currentLang.value, data, t]);
}

export function useTranslatedMainNav(data: NavMainProps['data']) {
  const { t, currentLang } = useTranslate('navbar');

  return useMemo(() => {
    const translateItem = (item: NavMainProps['data'][number]): NavMainProps['data'][number] => ({
      ...item,
      title: t(item.title, { defaultValue: item.title }),
      children: item.children?.map((section) => ({
        ...section,
        subheader: t(section.subheader, { defaultValue: section.subheader }),
        items: section.items.map((child) => ({
          ...child,
          title: t(child.title, { defaultValue: child.title }),
        })),
      })),
    });

    return data.map(translateItem);
  }, [currentLang.value, data, t]);
}
