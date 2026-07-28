import type { NavItemDataProps } from '../types';

import { isActiveLink } from 'minimal-shared/utils';

// ----------------------------------------------------------------------

type Options = {
  deepMatch?: boolean;
  hasChildren?: boolean;
};

/**
 * Keep a parent menu active on detail routes without making role dashboard
 * roots such as `/admin` active on every page below them.
 */
export function isNavItemActive(
  pathname: string,
  itemPath: string,
  { deepMatch, hasChildren = false }: Options = {}
) {
  const cleanPath = itemPath.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const pathDepth = cleanPath.split('/').filter(Boolean).length;
  const shouldDeepMatch = deepMatch ?? (hasChildren || pathDepth > 1);

  return isActiveLink(pathname, itemPath, shouldDeepMatch);
}

export function isNavDataActive(pathname: string, item: NavItemDataProps): boolean {
  if (
    isNavItemActive(pathname, item.path, {
      deepMatch: item.deepMatch,
      hasChildren: !!item.children,
    })
  ) {
    return true;
  }

  return item.children?.some((child) => isNavDataActive(pathname, child)) ?? false;
}
