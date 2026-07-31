import 'src/global.css';

import type { Metadata, Viewport } from 'next';

import { Analytics } from '@vercel/analytics/next';

import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

import { CONFIG } from 'src/global-config';
import { detectLanguage } from 'src/locales/server';
import { ReactQueryProvider } from 'src/lib/react-query';
import { I18nProvider } from 'src/locales/i18n-provider';
import { UiTranslationBridge, LocalizationProvider } from 'src/locales';
import { themeConfig, ThemeProvider, primary as primaryColor } from 'src/theme';

import { Snackbar } from 'src/components/snackbar';
import { LocatorJS } from 'src/components/locator-js';
import { ProgressBar } from 'src/components/progress-bar';
import { MotionLazy } from 'src/components/animate/motion-lazy';
import { detectSettings } from 'src/components/settings/server';
import { defaultSettings, SettingsProvider, LazySettingsDrawer } from 'src/components/settings';

import { MarketplaceCartProvider } from 'src/sections/marketplace/cart/cart-context';
import { getPublicPlatformSettings } from 'src/sections/marketplace/admin/server/platform-settings';
import { MarketplaceCookieConsentBanner } from 'src/sections/marketplace/legal/cookie-consent-banner';
import { MarketplacePopupAnnouncement } from 'src/sections/marketplace/announcements/popup-announcement';
import {
  getMarketplaceSiteUrl,
  MARKETPLACE_OG_IMAGE_URL,
} from 'src/sections/marketplace/seo/site-url';

import { AuthProvider } from 'src/auth/context/jwt';

// ----------------------------------------------------------------------

const SITE_NAME = 'E-KRU Marketplace';
const SITE_DESCRIPTION =
  'ตลาดสื่อการสอนออนไลน์สำหรับค้นหา ซื้อ และแบ่งปันแผนการสอน ใบงาน แบบทดสอบ และสื่อคุณภาพจากครูทั่วประเทศ';

export async function generateViewport(): Promise<Viewport> {
  const settings = await getPublicPlatformSettings();
  return {
    width: 'device-width',
    initialScale: 1,
    themeColor: settings?.primary_color || primaryColor.main,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicPlatformSettings();
  const siteName = settings?.platform_name_th || settings?.platform_name_en || SITE_NAME;
  const brandName = settings?.brand_name || 'E-KRU';
  const siteUrl = settings?.production_url || settings?.website_url || getMarketplaceSiteUrl();
  const ogImage = settings?.og_image_url || MARKETPLACE_OG_IMAGE_URL;
  return {
    metadataBase: new URL(siteUrl),
    applicationName: siteName,
    title: siteName,
    description: SITE_DESCRIPTION,
    keywords: [
      'สื่อการสอน',
      'แผนการสอน',
      'ใบงาน',
      'แบบทดสอบ',
      'สื่อครู',
      'Marketplace การศึกษา',
      brandName,
    ],
    authors: [{ name: brandName }],
    creator: brandName,
    publisher: brandName,
    category: 'education',
    manifest: '/favicon/site.webmanifest',
    icons: [
      { rel: 'icon', url: settings?.favicon_url || `${CONFIG.assetsDir}/favicon.ico` },
      { rel: 'apple-touch-icon', url: '/favicon/apple-touch-icon.png' },
    ],
    openGraph: {
      type: 'website',
      locale: 'th_TH',
      siteName,
      title: siteName,
      description: SITE_DESCRIPTION,
      url: '/',
      images: [{ url: ogImage, alt: siteName }],
    },
    twitter: {
      card: 'summary_large_image',
      title: siteName,
      description: SITE_DESCRIPTION,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  };
}

// ----------------------------------------------------------------------

type RootLayoutProps = {
  children: React.ReactNode;
};

async function getAppConfig() {
  if (CONFIG.isStaticExport) {
    return {
      lang: 'en',
      i18nLang: undefined,
      cookieSettings: undefined,
      dir: defaultSettings.direction,
    };
  } else {
    const [lang, settings] = await Promise.all([detectLanguage(), detectSettings()]);

    return {
      lang,
      i18nLang: lang,
      cookieSettings: settings,
      dir: settings.direction,
    };
  }
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const appConfig = await getAppConfig();

  return (
    <html lang={appConfig.lang} dir={appConfig.dir} suppressHydrationWarning>
      <body>
        <InitColorSchemeScript
          modeStorageKey={themeConfig.modeStorageKey}
          attribute={themeConfig.cssVariables.colorSchemeSelector}
          defaultMode={themeConfig.defaultMode}
        />

        <I18nProvider lang={appConfig.i18nLang}>
          <ReactQueryProvider>
            <AuthProvider>
              <MarketplaceCartProvider>
                <SettingsProvider
                  defaultSettings={defaultSettings}
                  cookieSettings={appConfig.cookieSettings}
                >
                  <LocalizationProvider>
                    <AppRouterCacheProvider options={{ key: 'css' }}>
                      <ThemeProvider
                        modeStorageKey={themeConfig.modeStorageKey}
                        defaultMode={themeConfig.defaultMode}
                      >
                        <MotionLazy>
                          <UiTranslationBridge />
                          <LocatorJS />
                          <Snackbar />
                          <ProgressBar />
                          <MarketplacePopupAnnouncement />
                          <MarketplaceCookieConsentBanner />
                          <LazySettingsDrawer defaultSettings={defaultSettings} />
                          {children}
                          <Analytics />
                        </MotionLazy>
                      </ThemeProvider>
                    </AppRouterCacheProvider>
                  </LocalizationProvider>
                </SettingsProvider>
              </MarketplaceCartProvider>
            </AuthProvider>
          </ReactQueryProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
