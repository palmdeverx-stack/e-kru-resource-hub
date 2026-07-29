'use client';

import type { Breakpoint } from '@mui/material/styles';
import type { NavItemProps, NavSectionProps } from 'src/components/nav-section';
import type { MainSectionProps, HeaderSectionProps, LayoutSectionProps } from '../core';

import { merge } from 'es-toolkit';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { useTheme } from '@mui/material/styles';
import { iconButtonClasses } from '@mui/material/IconButton';

import { languageOptions, useTranslatedNavSections } from 'src/locales';

import { Logo } from 'src/components/logo';
import { useSettingsContext } from 'src/components/settings';

import { useAuthContext } from 'src/auth/hooks';

import { NavMobile } from './nav-mobile';
import { VerticalDivider } from './content';
import { NavVertical } from './nav-vertical';
import { NavHorizontal } from './nav-horizontal';
import { _account } from '../nav-config-account';
import { MainSchoolLogo } from '../main/school-brand';
import { MenuButton } from '../components/menu-button';
import { DashboardBottomNav } from './dashboard-bottom-nav';
import { AccountDrawer } from '../components/account-drawer';
import { AccountPopover } from '../components/account-popover';
import { LanguagePopover } from '../components/language-popover';
import { NotificationsMenu } from '../components/notifications-menu';
import { navData as dashboardNavData } from '../nav-config-dashboard';
import { dashboardLayoutVars, dashboardNavColorVars } from './css-vars';
import { MainSection, layoutClasses, HeaderSection, LayoutSection } from '../core';

// ----------------------------------------------------------------------

type LayoutBaseProps = Pick<LayoutSectionProps, 'sx' | 'children' | 'cssVars'>;

export type DashboardLayoutProps = LayoutBaseProps & {
  layoutQuery?: Breakpoint;
  tabletHorizontalNav?: boolean;
  tabletQuery?: Breakpoint;
  slotProps?: {
    header?: HeaderSectionProps;
    nav?: {
      data?: NavSectionProps['data'];
      headerIdentity?: React.ReactNode;
      mobileBottom?: boolean;
    };
    main?: MainSectionProps;
  };
};

export function DashboardLayout({
  sx,
  cssVars,
  children,
  slotProps,
  layoutQuery = 'lg',
  tabletQuery = 'sm',
  tabletHorizontalNav = false,
}: DashboardLayoutProps) {
  const theme = useTheme();

  const { user } = useAuthContext();

  const settings = useSettingsContext();

  const navVars = dashboardNavColorVars(theme, settings.state.navColor, settings.state.navLayout);

  const { value: open, onFalse: onClose, onTrue: onOpen } = useBoolean();

  const rawNavData = slotProps?.nav?.data ?? dashboardNavData;
  const navData = useTranslatedNavSections(rawNavData);
  const headerIdentity = slotProps?.nav?.headerIdentity;
  const mobileBottom = slotProps?.nav?.mobileBottom ?? false;

  const isNavMini = settings.state.navLayout === 'mini';
  const isNavHorizontal = settings.state.navLayout === 'horizontal';
  const isNavVertical = isNavMini || settings.state.navLayout === 'vertical';
  const isTabletHorizontal = tabletHorizontalNav && !isNavHorizontal;
  const horizontalNavQuery = tabletHorizontalNav ? tabletQuery : layoutQuery;
  const mobileNavQuery = tabletHorizontalNav ? tabletQuery : layoutQuery;

  const canDisplayItemByRole = (allowedRoles: NavItemProps['allowedRoles']): boolean =>
    !allowedRoles?.includes(user?.role);

  const renderHeader = () => {
    const headerSlotProps: HeaderSectionProps['slotProps'] = {
      container: {
        maxWidth: false,
        sx: {
          ...(isNavVertical && { px: { [layoutQuery]: 5 } }),
          ...(isNavHorizontal && {
            bgcolor: 'var(--layout-nav-bg)',
            height: { [layoutQuery]: 'var(--layout-nav-horizontal-height)' },
            [`& .${iconButtonClasses.root}`]: { color: 'var(--layout-nav-text-secondary-color)' },
          }),
        },
      },
    };

    const headerSlots: HeaderSectionProps['slots'] = {
      topArea: (
        <Alert severity="info" sx={{ display: 'none', borderRadius: 0 }}>
          This is an info Alert.
        </Alert>
      ),
      bottomArea:
        isNavHorizontal || tabletHorizontalNav ? (
          <NavHorizontal
            data={navData}
            layoutQuery={horizontalNavQuery}
            cssVars={navVars.section}
            checkPermissions={canDisplayItemByRole}
            sx={
              isTabletHorizontal
                ? { [theme.breakpoints.up(layoutQuery)]: { display: 'none' } }
                : undefined
            }
          />
        ) : null,
      leftArea: (
        <>
          {/** @slot Nav mobile */}
          {!mobileBottom && (
            <MenuButton
              onClick={onOpen}
              sx={{ mr: 1, ml: -1, [theme.breakpoints.up(mobileNavQuery)]: { display: 'none' } }}
            />
          )}
          {!mobileBottom && (
            <NavMobile
              data={navData}
              open={open}
              onClose={onClose}
              cssVars={navVars.section}
              checkPermissions={canDisplayItemByRole}
            />
          )}

          {mobileBottom && (
            <Box sx={{ display: { xs: 'flex', [mobileNavQuery]: 'none' } }}>
              <MainSchoolLogo />
            </Box>
          )}

          {/** @slot Logo */}
          {(isNavHorizontal || tabletHorizontalNav) && (
            <Box
              sx={{
                display: 'none',
                minWidth: 0,
                alignItems: 'center',
                [theme.breakpoints.up(horizontalNavQuery)]: { display: 'inline-flex' },
                ...(isTabletHorizontal && {
                  [theme.breakpoints.up(layoutQuery)]: { display: 'none' },
                }),
              }}
            >
              {headerIdentity ?? <Logo />}
            </Box>
          )}

          {/** @slot Divider */}
          {(isNavHorizontal || tabletHorizontalNav) && (
            <VerticalDivider
              sx={{
                [theme.breakpoints.up(horizontalNavQuery)]: { display: 'flex' },
                ...(isTabletHorizontal && {
                  [theme.breakpoints.up(layoutQuery)]: { display: 'none' },
                }),
              }}
            />
          )}

          {/** @slot Workspace popover */}
          {/* <WorkspacesPopover
            data={_workspaces}
            sx={{ ...(isNavHorizontal && { color: 'var(--layout-nav-text-primary-color)' }) }}
          /> */}
        </>
      ),
      rightArea: (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, sm: 0.75 } }}>
          {/** @slot Searchbar */}
          {/* <Searchbar data={navData} /> */}

          {/** @slot Notifications popover */}
          <NotificationsMenu />

          {/** @slot Contacts popover */}
          {/* <ContactsPopover data={_contacts} /> */}

          {/** @slot Settings button */}
          {/* <SettingsButton /> */}

          {/** @slot Account drawer */}
          {mobileBottom && (
            <AccountPopover sx={{ display: { xs: 'inline-flex', [mobileNavQuery]: 'none' } }} />
          )}

          <AccountDrawer
            data={_account}
            sx={
              mobileBottom
                ? { display: { xs: 'none', [mobileNavQuery]: 'inline-flex' } }
                : undefined
            }
          />

          {/** @slot Language popover */}
          <LanguagePopover showTranslateIcon data={languageOptions} />
        </Box>
      ),
    };

    return (
      <HeaderSection
        layoutQuery={layoutQuery}
        disableElevation={isNavVertical}
        {...slotProps?.header}
        slots={{ ...headerSlots, ...slotProps?.header?.slots }}
        slotProps={merge(headerSlotProps, slotProps?.header?.slotProps ?? {})}
        sx={[
          { bgcolor: 'common.white' },
          ...(Array.isArray(slotProps?.header?.sx) ? slotProps.header.sx : [slotProps?.header?.sx]),
        ]}
      />
    );
  };

  const renderSidebar = () => (
    <NavVertical
      data={navData}
      isNavMini={isNavMini}
      layoutQuery={layoutQuery}
      cssVars={navVars.section}
      checkPermissions={canDisplayItemByRole}
      slots={
        headerIdentity
          ? {
              topArea: isNavMini ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2.5 }}>
                  <Logo />
                </Box>
              ) : (
                headerIdentity
              ),
            }
          : undefined
      }
      onToggleNav={() =>
        settings.setField(
          'navLayout',
          settings.state.navLayout === 'vertical' ? 'mini' : 'vertical'
        )
      }
    />
  );

  const renderFooter = () => null;

  const renderMain = () => (
    <MainSection
      {...slotProps?.main}
      sx={[
        ...(Array.isArray(slotProps?.main?.sx) ? slotProps.main.sx : [slotProps?.main?.sx]),
        mobileBottom && {
          '--dashboard-bottom-nav-height': '66px',
          pb: {
            xs: 'calc(var(--dashboard-bottom-nav-height) + max(env(safe-area-inset-bottom), 0px) + 12px)',
            [mobileNavQuery]: 0,
          },
        },
      ]}
    >
      {children}
    </MainSection>
  );

  return (
    <LayoutSection
      /** **************************************
       * @Header
       *************************************** */
      headerSection={renderHeader()}
      /** **************************************
       * @Sidebar
       *************************************** */
      sidebarSection={isNavHorizontal ? null : renderSidebar()}
      /** **************************************
       * @Footer
       *************************************** */
      footerSection={renderFooter()}
      /** **************************************
       * @Styles
       *************************************** */
      cssVars={{ ...dashboardLayoutVars(theme), ...navVars.layout, ...cssVars }}
      sx={[
        {
          [`& .${layoutClasses.sidebarContainer}`]: {
            [theme.breakpoints.up(layoutQuery)]: {
              pl: isNavMini ? 'var(--layout-nav-mini-width)' : 'var(--layout-nav-vertical-width)',
              transition: theme.transitions.create(['padding-left'], {
                easing: 'var(--layout-transition-easing)',
                duration: 'var(--layout-transition-duration)',
              }),
            },
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {renderMain()}
      {mobileBottom && <DashboardBottomNav data={navData} layoutQuery={mobileNavQuery} />}
    </LayoutSection>
  );
}
