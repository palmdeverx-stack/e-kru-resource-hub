import type { Breakpoint } from '@mui/material/styles';
import type { NavSectionProps } from 'src/components/nav-section';

import { useQuery } from '@tanstack/react-query';
import { varAlpha, mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { useTranslate } from 'src/locales';

import { Logo } from 'src/components/logo';
import { Scrollbar } from 'src/components/scrollbar';
import { TruncatedTypography } from 'src/components/truncated-typography';
import { NavSectionMini, NavSectionVertical } from 'src/components/nav-section';

import { getSchool } from 'src/sections/school/school-actions';

import { useAuthContext } from 'src/auth/hooks';

import { layoutClasses } from '../core';
import { NavToggleButton } from '../components/nav-toggle-button';

// ----------------------------------------------------------------------

export type NavVerticalProps = React.ComponentProps<'div'> &
  NavSectionProps & {
    isNavMini: boolean;
    layoutQuery?: Breakpoint;
    onToggleNav: () => void;
    slots?: {
      topArea?: React.ReactNode;
      bottomArea?: React.ReactNode;
    };
  };

export function NavVertical({
  sx,
  data,
  slots,
  cssVars,
  className,
  isNavMini,
  onToggleNav,
  checkPermissions,
  layoutQuery = 'md',
  ...other
}: NavVerticalProps) {
  const { user } = useAuthContext();
  const isMasterAdmin = user?.role === 'master_admin';
  const schoolId = typeof user?.school_id === 'string' ? user.school_id : '';
  const { data: school, isLoading } = useQuery({
    queryKey: ['nav-school', schoolId],
    queryFn: () => getSchool(schoolId),
    enabled: !!schoolId && !isMasterAdmin,
  });

  const renderNavVertical = () => (
    <>
      {slots?.topArea ??
        (isMasterAdmin ? (
          <ProductIdentity />
        ) : school ? (
          <Box display="flex" alignItems="center" sx={{ pl: 3.5, pt: 2.5, pb: 1 }}>
            <Avatar
              src={school.logo_url ?? undefined}
              alt={school.name}
              variant="rounded"
              sx={{
                width: 50,
                height: 50,
                flexShrink: 0,
                fontSize: 28,
                color: 'primary.main',
              }}
            >
              {school.name.charAt(0)}
            </Avatar>
            <Stack ml={2} sx={{ width: '70%' }}>
              <TruncatedTypography variant="subtitle1" line={1}>
                {school.name}
              </TruncatedTypography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {school.code}
              </Typography>
            </Stack>
          </Box>
        ) : isLoading ? (
          <SchoolIdentitySkeleton />
        ) : (
          <SchoolIdentityFallback />
        ))}

      <Scrollbar fillContent>
        <NavSectionVertical
          data={data}
          cssVars={cssVars}
          checkPermissions={checkPermissions}
          sx={{ px: 2, pb: 2, flex: '1 1 auto' }}
        />

        {slots?.bottomArea}
      </Scrollbar>
    </>
  );

  const renderNavMini = () => (
    <>
      {slots?.topArea ?? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2.5 }}>
          {!isMasterAdmin && school ? (
            <Avatar
              src={school.logo_url ?? undefined}
              alt={school.name}
              variant="rounded"
              sx={{ width: 40, height: 40, color: 'primary.main' }}
            >
              {school.name.charAt(0)}
            </Avatar>
          ) : (
            <Logo />
          )}
        </Box>
      )}

      <NavSectionMini
        data={data}
        cssVars={cssVars}
        checkPermissions={checkPermissions}
        sx={[
          (theme) => ({
            ...theme.mixins.hideScrollY,
            pb: 2,
            px: 0.5,
            flex: '1 1 auto',
            overflowY: 'auto',
          }),
        ]}
      />

      {slots?.bottomArea}
    </>
  );

  return (
    <NavRoot
      isNavMini={isNavMini}
      layoutQuery={layoutQuery}
      className={mergeClasses([layoutClasses.nav.root, layoutClasses.nav.vertical, className])}
      sx={sx}
      {...other}
    >
      <NavToggleButton
        isNavMini={isNavMini}
        onClick={onToggleNav}
        sx={[
          (theme) => ({
            display: 'none',
            [theme.breakpoints.up(layoutQuery)]: { display: 'inline-flex' },
          }),
        ]}
      />
      {isNavMini ? renderNavMini() : renderNavVertical()}
    </NavRoot>
  );
}

// ----------------------------------------------------------------------

function ProductIdentity() {
  const { t } = useTranslate();

  return (
    <Box display="flex" alignItems="center" sx={{ pl: 3.5, pt: 2.5, pb: 1 }}>
      <Logo />
      <Stack ml={2} sx={{ minWidth: 0 }}>
        <TruncatedTypography variant="subtitle1" line={1}>
          eKru
        </TruncatedTypography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('brand.scoreSystem')}
        </Typography>
      </Stack>
    </Box>
  );
}

function SchoolIdentitySkeleton() {
  return (
    <Box display="flex" alignItems="center" sx={{ pl: 3.5, pt: 2.5, pb: 1 }}>
      <Skeleton variant="rounded" width={50} height={50} />
      <Stack ml={2} spacing={0.75} sx={{ flex: 1, pr: 3 }}>
        <Skeleton width="85%" height={22} />
        <Skeleton width="45%" height={18} />
      </Stack>
    </Box>
  );
}

function SchoolIdentityFallback() {
  const { t } = useTranslate();

  return (
    <Box display="flex" alignItems="center" sx={{ pl: 3.5, pt: 2.5, pb: 1 }}>
      <Avatar variant="rounded" sx={{ width: 50, height: 50, color: 'primary.main' }}>
        ร
      </Avatar>
      <Stack ml={2} sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1">{t('school.information')}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('errors.loadData')}
        </Typography>
      </Stack>
    </Box>
  );
}

// ----------------------------------------------------------------------

const NavRoot = styled('div', {
  shouldForwardProp: (prop: string) => !['isNavMini', 'layoutQuery', 'sx'].includes(prop),
})<Pick<NavVerticalProps, 'isNavMini' | 'layoutQuery'>>(
  ({ isNavMini, layoutQuery = 'md', theme }) => ({
    top: 0,
    left: 0,
    height: '100%',
    display: 'none',
    position: 'fixed',
    flexDirection: 'column',
    zIndex: 'var(--layout-nav-zIndex)',
    backgroundColor: 'var(--layout-nav-bg)',
    width: isNavMini ? 'var(--layout-nav-mini-width)' : 'var(--layout-nav-vertical-width)',
    borderRight: `1px solid var(--layout-nav-border-color, ${varAlpha(theme.vars.palette.grey['500Channel'], 0.12)})`,
    transition: theme.transitions.create(['width'], {
      easing: 'var(--layout-transition-easing)',
      duration: 'var(--layout-transition-duration)',
    }),
    [theme.breakpoints.up(layoutQuery)]: { display: 'flex' },
  })
);
