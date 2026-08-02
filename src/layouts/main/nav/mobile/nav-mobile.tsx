import type { NavMainProps } from '../types';

import { useEffect } from 'react';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';

import { usePathname } from 'src/routes/hooks';

import { useTranslate } from 'src/locales';

import { Logo } from 'src/components/logo';
import { Scrollbar } from 'src/components/scrollbar';
import { RiCloseLine } from 'src/components/remix-icon';

import { Nav, NavUl } from '../components';
import { NavList } from './nav-mobile-list';
import { SignInButton } from '../../../components/sign-in-button';

// ----------------------------------------------------------------------

export type NavMobileProps = NavMainProps & {
  open: boolean;
  onClose: () => void;
  slots?: {
    topArea?: React.ReactNode;
    bottomArea?: React.ReactNode;
  };
};

export function NavMobile({ data, open, onClose, slots, sx }: NavMobileProps) {
  const { t } = useTranslate('navbar');
  const pathname = usePathname();

  useEffect(() => {
    if (open) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: [
            {
              display: 'flex',
              flexDirection: 'column',
              width: 'min(var(--layout-nav-mobile-width), 100vw)',
              maxWidth: '100vw',
            },
            ...(Array.isArray(sx) ? sx : [sx]),
          ],
        },
      }}
    >
      {slots?.topArea ?? (
        <Box
          sx={{
            px: { xs: 1.5, sm: 2 },
            pt: 2,
            pb: 1.5,
            display: 'flex',
            gap: 1,
            minHeight: { xs: 72, sm: 76 },
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Logo
            isSingle={false}
            sx={{
              width: { xs: 112, sm: 132 },
              height: { xs: 54, sm: 60 },
              maxWidth: 'calc(100% - 48px)',
            }}
          />
          <IconButton onClick={onClose} aria-label={t('ปิดเมนู')}>
            <RiCloseLine size={24} />
          </IconButton>
        </Box>
      )}

      <Scrollbar fillContent>
        <Nav
          sx={{
            pb: 3,
            display: 'flex',
            flex: '1 1 auto',
            flexDirection: 'column',
          }}
        >
          <NavUl>
            {data.map((list) => (
              <NavList key={list.title} data={list} />
            ))}
          </NavUl>
        </Nav>
      </Scrollbar>

      {slots?.bottomArea ?? (
        <Box
          sx={{
            py: 3,
            px: 2.5,
            gap: 1.5,
            display: 'flex',
          }}
        >
          <SignInButton fullWidth />
        </Box>
      )}
    </Drawer>
  );
}
