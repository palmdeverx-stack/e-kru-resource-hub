'use client';

import type { Breakpoint } from '@mui/material/styles';
import type { FooterProps } from './footer';
import type { NavMainProps } from './nav/types';
import type { MainSectionProps, HeaderSectionProps, LayoutSectionProps } from '../core';

import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';

import { usePathname } from 'src/routes/hooks';

import { languageOptions, useTranslatedMainNav } from 'src/locales';

import { NavMobile } from './nav/mobile';
import { NavDesktop } from './nav/desktop';
import { Footer, HomeFooter } from './footer';
import { MainSchoolLogo } from './school-brand';
import { MenuButton } from '../components/menu-button';
import { navData as mainNavData } from '../nav-config-main';
import { SignInButton } from '../components/sign-in-button';
import { AccountPopover } from '../components/account-popover';
import { LanguagePopover } from '../components/language-popover';
import { StudentBottomNav } from './nav/mobile/student-bottom-nav';
import { MainSection, LayoutSection, HeaderSection } from '../core';

// ----------------------------------------------------------------------

type LayoutBaseProps = Pick<LayoutSectionProps, 'sx' | 'children' | 'cssVars'>;

export type MainLayoutProps = LayoutBaseProps & {
  layoutQuery?: Breakpoint;
  slotProps?: {
    header?: HeaderSectionProps;
    nav?: {
      data?: NavMainProps['data'];
      mobileBottom?: boolean;
    };
    main?: MainSectionProps;
    footer?: FooterProps;
  };
};

export function MainLayout({
  sx,
  cssVars,
  children,
  slotProps,
  layoutQuery = 'md',
}: MainLayoutProps) {
  const pathname = usePathname();

  const { value: open, onFalse: onClose, onTrue: onOpen } = useBoolean();

  const isHomePage = pathname === '/';

  const rawNavData = slotProps?.nav?.data ?? mainNavData;
  const navData = useTranslatedMainNav(rawNavData);
  const mobileBottom = slotProps?.nav?.mobileBottom ?? false;

  const renderHeader = () => {
    const headerSlots: HeaderSectionProps['slots'] = {
      topArea: (
        <Alert severity="info" sx={{ display: 'none', borderRadius: 0 }}>
          This is an info Alert.
        </Alert>
      ),
      leftArea: (
        <>
          {!mobileBottom && (
            <>
              {/** @slot Nav mobile */}
              <MenuButton
                onClick={onOpen}
                sx={(theme) => ({
                  mr: 1,
                  ml: -1,
                  [theme.breakpoints.up(layoutQuery)]: { display: 'none' },
                })}
              />
              <NavMobile data={navData} open={open} onClose={onClose} />
            </>
          )}

          {/** @slot Logo */}
          <MainSchoolLogo />
        </>
      ),
      rightArea: (
        <>
          {/** @slot Nav desktop */}
          <NavDesktop
            data={navData}
            sx={(theme) => ({
              display: 'none',
              [theme.breakpoints.up(layoutQuery)]: { mr: 2.5, display: 'flex' },
            })}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 } }}>
            <LanguagePopover data={languageOptions} />

            {/** @slot Settings button */}
            {/* <SettingsButton /> */}

            {/** @slot Sign in button */}
            <SignInButton />
            <AccountPopover />
          </Box>
        </>
      ),
    };

    return (
      <HeaderSection
        layoutQuery={layoutQuery}
        {...slotProps?.header}
        slots={{ ...headerSlots, ...slotProps?.header?.slots }}
        slotProps={slotProps?.header?.slotProps}
        sx={[
          (theme) => ({
            '--color': theme.vars.palette.text.primary,
            color: 'text.primary',
            bgcolor: 'common.white',
            borderBottom: `1px solid ${theme.vars.palette.divider}`,
          }),
          ...(Array.isArray(slotProps?.header?.sx) ? slotProps.header.sx : [slotProps?.header?.sx]),
        ]}
      />
    );
  };

  const footerSx = [
    ...(Array.isArray(slotProps?.footer?.sx) ? slotProps.footer.sx : [slotProps?.footer?.sx]),
    mobileBottom && { display: { xs: 'none', md: 'block' } },
  ];

  const renderFooter = () =>
    isHomePage ? <HomeFooter sx={footerSx} /> : <Footer sx={footerSx} layoutQuery={layoutQuery} />;

  const renderMain = () => (
    <MainSection
      {...slotProps?.main}
      sx={[
        ...(Array.isArray(slotProps?.main?.sx) ? slotProps.main.sx : [slotProps?.main?.sx]),
        mobileBottom && {
          '--student-bottom-nav-height': '66px',
          pb: {
            xs: 'calc(var(--student-bottom-nav-height) + max(env(safe-area-inset-bottom), 0px) + 12px)',
            md: 0,
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
       * @Footer
       *************************************** */
      footerSection={renderFooter()}
      /** **************************************
       * @Styles
       *************************************** */
      cssVars={cssVars}
      sx={sx}
    >
      {renderMain()}
      {mobileBottom && <StudentBottomNav data={navData} />}
    </LayoutSection>
  );
}
