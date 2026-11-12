import type { NavSectionProps } from 'src/components/nav-section';

import { useEffect } from 'react';
import { mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { usePathname } from 'src/routes/hooks';

import { useTranslate, languageOptions } from 'src/locales';

import { Logo } from 'src/components/logo';
import { Scrollbar } from 'src/components/scrollbar';
import { RiCloseLine } from 'src/components/remix-icon';
import { NavSectionVertical } from 'src/components/nav-section';

import { layoutClasses } from '../core';
import { LanguagePopover } from '../components/language-popover';

// ----------------------------------------------------------------------

type NavMobileProps = NavSectionProps & {
  anchor?: 'left' | 'right' | 'bottom';
  open: boolean;
  onClose: () => void;
  slots?: {
    topArea?: React.ReactNode;
    bottomArea?: React.ReactNode;
  };
};

export function NavMobile({
  sx,
  anchor = 'left',
  data,
  open,
  slots,
  onClose,
  className,
  checkPermissions,
  ...other
}: NavMobileProps) {
  const pathname = usePathname();
  const { t } = useTranslate('navbar');

  useEffect(() => {
    if (open) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          className: mergeClasses([layoutClasses.nav.root, layoutClasses.nav.vertical, className]),
          sx: [
            {
              overflow: anchor === 'bottom' ? 'hidden' : 'unset',
              bgcolor: 'var(--layout-nav-bg)',
              width: anchor === 'bottom' ? '100%' : 'var(--layout-nav-mobile-width)',
              ...(anchor === 'right' && {
                width: '100vw',
                maxWidth: '100vw',
                height: '100dvh',
                borderRadius: 0,
                pt: 'env(safe-area-inset-top)',
                pb: 'env(safe-area-inset-bottom)',
              }),
              ...(anchor === 'bottom' && {
                maxHeight: '80dvh',
                borderRadius: '20px 20px 0 0',
                pb: 'env(safe-area-inset-bottom)',
              }),
            },
            ...(Array.isArray(sx) ? sx : [sx]),
          ],
        },
      }}
    >
      {slots?.topArea ?? (
        <Box
          sx={{
            pl: 3.5,
            pr: 2,
            pt: 2.5,
            pb: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Logo />
          {anchor !== 'left' && (
            <IconButton onClick={onClose} aria-label={t('ปิดเมนู')}>
              <RiCloseLine size={24} />
            </IconButton>
          )}
        </Box>
      )}

      {anchor === 'right' && (
        <Box
          sx={{
            px: 3.5,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle2">{t('เปลี่ยนภาษา')}</Typography>
          <LanguagePopover showTranslateIcon data={languageOptions} />
        </Box>
      )}

      <Scrollbar fillContent>
        <NavSectionVertical
          data={data}
          checkPermissions={checkPermissions}
          sx={{ px: 2, pb: 2, flex: '1 1 auto' }}
          {...other}
        />
      </Scrollbar>

      {slots?.bottomArea}
    </Drawer>
  );
}
