'use client';

import type { NavMainProps } from '../types';

import Paper from '@mui/material/Paper';
import Portal from '@mui/material/Portal';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';

import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

// ----------------------------------------------------------------------

export function StudentBottomNav({ data }: NavMainProps) {
  const { t } = useTranslate();
  const pathname = usePathname();
  const currentPath = [...data]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) =>
      item.path === '/'
        ? pathname === '/'
        : pathname === item.path || pathname.startsWith(`${item.path}/`)
    )?.path;

  return (
    <Portal>
      <Paper
        component="nav"
        aria-label={t('navigation.studentMenu')}
        elevation={12}
        sx={{
          insetInline: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '100vw',
          zIndex: (theme) => theme.zIndex.modal,
          display: { xs: 'block', md: 'none' },
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
            height: 'var(--student-bottom-nav-height, 66px)',
            bgcolor: 'background.paper',
            '& .MuiBottomNavigationAction-root': {
              px: 0.5,
              minWidth: 0,
              color: 'text.secondary',
            },
            '& .Mui-selected': { color: 'primary.main' },
            '& .MuiBottomNavigationAction-label': {
              mt: 0.25,
              fontSize: '0.68rem',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
            },
            '& .MuiBottomNavigationAction-label.Mui-selected': {
              fontSize: '0.72rem',
              fontWeight: 700,
            },
          }}
        >
          {data.map((item) => (
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
