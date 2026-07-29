'use client';

import type { Theme, CSSObject, Breakpoint } from '@mui/material/styles';
import type { AuthCenteredContentProps } from './content';
import type { MainSectionProps, HeaderSectionProps, LayoutSectionProps } from '../core';

import { merge } from 'es-toolkit';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';

import { CONFIG } from 'src/global-config';
import { languageOptions } from 'src/locales';

import { Logo } from 'src/components/logo';

import { AuthCenteredContent } from './content';
import { LanguagePopover } from '../components/language-popover';
import { MainSection, LayoutSection, HeaderSection } from '../core';

// ----------------------------------------------------------------------

type LayoutBaseProps = Pick<LayoutSectionProps, 'sx' | 'children' | 'cssVars'>;

export type AuthCenteredLayoutProps = LayoutBaseProps & {
  layoutQuery?: Breakpoint;
  slotProps?: {
    header?: HeaderSectionProps;
    main?: MainSectionProps;
    content?: AuthCenteredContentProps;
  };
};

export function AuthCenteredLayout({
  sx,
  cssVars,
  children,
  slotProps,
  layoutQuery = 'md',
}: AuthCenteredLayoutProps) {
  const renderHeader = () => {
    const headerSlotProps: HeaderSectionProps['slotProps'] = {
      container: {
        maxWidth: 'xl',
        sx: { px: { xs: 1.5, sm: 3 } },
      },
    };
    const customHeaderSlots = slotProps?.header?.slots;

    const headerSlots: HeaderSectionProps['slots'] = {
      topArea: (
        <Alert severity="info" sx={{ display: 'none', borderRadius: 0 }}>
          This is an info Alert.
        </Alert>
      ),
      leftArea: (
        <>
          {/** @slot Logo */}
          {customHeaderSlots?.leftArea ?? <Logo />}
        </>
      ),
      rightArea: (
        <Box
          sx={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: { xs: 0.25, sm: 0.5 } }}
        >
          <LanguagePopover
            showTranslateIcon
            data={languageOptions}
            sx={{ width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 } }}
          />

          {/** @slot Settings button */}
          {/* <SettingsButton
            aria-label="ตั้งค่าการแสดงผล"
            sx={{ width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 } }}
          /> */}
        </Box>
      ),
    };

    return (
      <HeaderSection
        disableElevation
        layoutQuery={layoutQuery}
        {...slotProps?.header}
        slots={{ ...headerSlots, ...customHeaderSlots, leftArea: headerSlots.leftArea }}
        slotProps={merge(headerSlotProps, slotProps?.header?.slotProps ?? {})}
        sx={[
          { position: { [layoutQuery]: 'fixed' }, color: 'text.primary' },
          ...(Array.isArray(slotProps?.header?.sx) ? slotProps.header.sx : [slotProps?.header?.sx]),
        ]}
      />
    );
  };

  const renderFooter = () => null;

  const renderMain = () => (
    <MainSection
      {...slotProps?.main}
      sx={[
        (theme) => ({
          alignItems: 'center',
          p: theme.spacing(3, 2, 10, 2),
          [theme.breakpoints.up(layoutQuery)]: {
            justifyContent: 'center',
            p: theme.spacing(10, 0, 10, 0),
          },
        }),
        ...(Array.isArray(slotProps?.main?.sx) ? slotProps.main.sx : [slotProps?.main?.sx]),
      ]}
    >
      <AuthCenteredContent {...slotProps?.content}>{children}</AuthCenteredContent>
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
      cssVars={{ '--layout-auth-content-width': '420px', ...cssVars }}
      sx={[
        (theme) => ({
          position: 'relative',
          '&::before': backgroundStyles(theme),
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {renderMain()}
    </LayoutSection>
  );
}

// ----------------------------------------------------------------------

const backgroundStyles = (theme: Theme): CSSObject => ({
  ...theme.mixins.bgGradient({
    images: [`url(${CONFIG.assetsDir}/assets/background/bg-images.png)`],
  }),
  zIndex: 1,
  opacity: 0.24,
  width: '100%',
  height: '100%',
  content: "''",
  position: 'absolute',
  ...theme.applyStyles('dark', {
    opacity: 0.08,
  }),
});
