'use client';

import type { Breakpoint } from '@mui/material/styles';
import type { NavSectionProps, NavItemDataProps } from 'src/components/nav-section';

import Paper from '@mui/material/Paper';
import Portal from '@mui/material/Portal';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';

import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';
import { isNavDataActive } from 'src/components/nav-section';

import { useTranslate } from 'src/locales';

// ----------------------------------------------------------------------

type Props = {
  data: NavSectionProps['data'];
  layoutQuery?: Breakpoint;
};

export function DashboardBottomNav({ data, layoutQuery = 'sm' }: Props) {
  const { t } = useTranslate('navbar');
  const pathname = usePathname();
  const items = data
    .flatMap((group) => group.items)
    .filter(
      (item): item is NavItemDataProps & { path: string } =>
        !!item.path && item.path !== '#' && item.path !== '/teacher'
    )
    .slice(0, 5);
  const currentPath = [...items]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => isNavDataActive(pathname, item))?.path;
  return (
    <Portal>
      <Paper
        component="nav"
        aria-label={t('เมนูหลักสำหรับครู')}
        elevation={12}
        sx={{
          insetInline: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '100vw',
          zIndex: (theme) => theme.zIndex.modal,
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
              label={item.title}
              icon={item.icon}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Portal>
  );
}
