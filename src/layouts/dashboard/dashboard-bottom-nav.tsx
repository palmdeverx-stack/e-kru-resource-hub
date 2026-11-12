'use client';

import type { Breakpoint } from '@mui/material/styles';
import type { NavSectionProps, NavItemDataProps } from 'src/components/nav-section';

import Paper from '@mui/material/Paper';
import Portal from '@mui/material/Portal';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';

import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import { isNavDataActive } from 'src/components/nav-section';
import { RiSettings3Line, RiShoppingBag3Line } from 'src/components/remix-icon';

// ----------------------------------------------------------------------

type Props = {
  data: NavSectionProps['data'];
  layoutQuery?: Breakpoint;
  onMore?: () => void;
  checkPermissions?: NavSectionProps['checkPermissions'];
};

export function getDashboardMobileNavigation(
  data: NavSectionProps['data'],
  checkPermissions?: NavSectionProps['checkPermissions'],
  withSettings = true
) {
  const allItems = data
    .flatMap((group) => group.items)
    .filter(
      (item): item is NavItemDataProps & { path: string } =>
        !!item.path &&
        item.path !== '#' &&
        item.path !== '/teacher' &&
        item.path !== '/dashboard/cart' &&
        !item.disabled &&
        !(item.allowedRoles && checkPermissions?.(item.allowedRoles))
    );
  const hasSettings = withSettings && allItems.length > 4;
  const items = allItems.slice(0, hasSettings ? 4 : 5);
  const sellerOverview = allItems.find((item) => item.path === '/dashboard/seller');
  if (sellerOverview && !items.includes(sellerOverview)) {
    items[items.length - 1] = sellerOverview;
  }
  const accountIndex = items.findIndex((item) => item.path === '/dashboard');
  const sellerIndex = items.findIndex((item) => item.path === '/dashboard/seller');
  if (accountIndex !== -1 && sellerIndex !== -1) {
    [items[accountIndex], items[sellerIndex]] = [items[sellerIndex], items[accountIndex]];
  }
  const remaining = new Set(allItems.filter((item) => !items.includes(item)));
  const settingsData = data
    .map((group) => ({ ...group, items: group.items.filter((item) => remaining.has(item)) }))
    .filter((group) => group.items.length > 0);
  return { allItems, items, hasSettings, settingsData };
}

export function DashboardBottomNav({ data, layoutQuery = 'sm', onMore, checkPermissions }: Props) {
  const { t } = useTranslate('navbar');
  const pathname = usePathname();
  const { allItems, items, hasSettings } = getDashboardMobileNavigation(
    data,
    checkPermissions,
    Boolean(onMore)
  );
  const activeItem = [...allItems]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => isNavDataActive(pathname, item));
  const currentPath =
    activeItem && items.some((item) => item.path === activeItem.path)
      ? activeItem.path
      : hasSettings && activeItem
        ? '__settings'
        : false;
  return (
    <Portal>
      <Paper
        component="nav"
        aria-label={t('เมนูหลัก')}
        elevation={12}
        sx={{
          insetInline: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '100vw',
          zIndex: (theme) => theme.zIndex.appBar + 1,
          display: { xs: 'block', [layoutQuery]: 'none' },
          position: 'fixed',
          overflow: 'hidden',
          borderTop: '1px solid',
          borderColor: 'divider',
          borderRadius: 0,
          bgcolor: 'background.paper',
          pb: 'max(env(safe-area-inset-bottom), 0px)',
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          willChange: 'transform',
          touchAction: 'manipulation',
        }}
      >
        <BottomNavigation
          showLabels
          value={currentPath ?? false}
          sx={{
            height: 'var(--dashboard-bottom-nav-height, 66px)',
            bgcolor: 'background.paper',
            '& .MuiBottomNavigationAction-root': {
              px: 0.25,
              minWidth: 0,
              color: 'text.secondary',
            },
            '& .Mui-selected': { color: 'primary.main' },
            '& .MuiBottomNavigationAction-label': {
              mt: 0.25,
              maxWidth: '100%',
              overflow: 'hidden',
              fontSize: '0.64rem',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            },
            '& .MuiBottomNavigationAction-label.Mui-selected': {
              fontSize: '0.68rem',
              fontWeight: 700,
            },
          }}
        >
          {items.map((item) => (
            <BottomNavigationAction
              key={item.path}
              component={RouterLink}
              href={item.path}
              value={item.path}
              aria-current={currentPath === item.path ? 'page' : undefined}
              label={item.title}
              icon={item.path === '/dashboard/seller' ? <RiShoppingBag3Line /> : item.icon}
            />
          ))}
          {hasSettings && (
            <BottomNavigationAction
              value="__settings"
              label={t('ตั้งค่า')}
              icon={<RiSettings3Line size={24} />}
              onClick={onMore}
              aria-haspopup="dialog"
            />
          )}
        </BottomNavigation>
      </Paper>
    </Portal>
  );
}
