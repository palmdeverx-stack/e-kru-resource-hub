'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import { MarketplaceBrand } from 'src/components/marketplace-brand';
import {
  RiLineFill,
  RiMailLine,
  RiShieldCheckLine,
  RiCustomerService2Line,
} from 'src/components/remix-icon';

import { OPEN_COOKIE_SETTINGS_EVENT } from '../legal/cookie-consent';

type FooterLink = {
  labelKey: string;
  href: string;
};

type MarketplaceContact = {
  email: string;
  supportPhone: string | null;
  businessHours: string | null;
  platformName: string;
  brandName: string;
  logoUrl: string | null;
  transparentLogoUrl: string | null;
  footerText: string | null;
  copyrightText: string | null;
  line: {
    basicId: string;
    displayName: string;
    url: string;
  } | null;
};

const marketplaceLinks: FooterLink[] = [
  { labelKey: 'home', href: paths.marketplace.root },
  { labelKey: 'products', href: paths.marketplace.products },
  { labelKey: 'stores', href: paths.marketplace.stores },
  { labelKey: 'cart', href: paths.marketplace.cart },
  { labelKey: 'purchases', href: paths.marketplace.purchases },
];

const sellerLinks: FooterLink[] = [
  { labelKey: 'openStore', href: paths.marketplace.sellerSetup },
  { labelKey: 'myStore', href: paths.marketplace.seller },
  { labelKey: 'newProduct', href: paths.marketplace.productNew },
  { labelKey: 'finance', href: paths.marketplace.sellerFinance },
];

const supportLinks: FooterLink[] = [
  { labelKey: 'signIn', href: paths.auth.jwt.signIn },
  { labelKey: 'legal', href: paths.legal.center },
  { labelKey: 'terms', href: paths.legal.termsOfService },
  { labelKey: 'sellerAgreement', href: paths.legal.sellerAgreement },
  { labelKey: 'privacy', href: paths.legal.privacyPolicy },
  { labelKey: 'copyright', href: paths.legal.copyrightTakedown },
  { labelKey: 'refund', href: paths.legal.refundPolicy },
  { labelKey: 'cookie', href: paths.legal.cookiePolicy },
];

export function MarketplaceFooter() {
  const { t, currentLang } = useTranslate('marketplace');
  const year = new Date().getFullYear();
  const [contact, setContact] = useState<MarketplaceContact | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/marketplace/contact', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(t('errors.contact'));
        return response.json() as Promise<MarketplaceContact>;
      })
      .then(setContact)
      .catch(() => setContact(null));

    return () => controller.abort();
  }, [t]);

  return (
    <Box
      component="footer"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        color: '#1D2939',
        bgcolor: '#F5F8FF',
        borderTop: '1px solid #E4EBF5',
        backgroundImage:
          'radial-gradient(circle at 4% 6%, rgba(71, 130, 255, 0.13), transparent 34%), radial-gradient(circle at 96% 86%, rgba(80, 211, 178, 0.13), transparent 32%), linear-gradient(135deg, #F2F6FF 0%, #FFFFFF 52%, #F0FBF8 100%)',
      }}
    >
      <Container maxWidth="lg" sx={{ pt: { xs: 7, md: 9 }, pb: 3 }}>
        <Grid container spacing={{ xs: 5, md: 6 }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Box sx={{ maxWidth: 440 }}>
              <Stack direction="row" spacing={1.75} alignItems="center">
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    display: 'grid',
                    flexShrink: 0,
                    borderRadius: 2.5,
                    bgcolor: 'common.white',
                    border: '1px solid #E5ECF7',
                    boxShadow: '0 10px 30px rgba(30, 88, 180, 0.08)',
                    placeItems: 'center',
                  }}
                >
                  <MarketplaceBrand compact variant="transparent" disabled width={48} height={48} />
                </Box>
                <Box>
                  <Typography variant="h5">
                    {contact?.platformName ?? 'E-KRU Marketplace'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#3478F6', fontWeight: 700 }}>
                    {t('footer.tagline')}
                  </Typography>
                </Box>
              </Stack>

              <Typography
                variant="body2"
                sx={{ mt: 2.5, maxWidth: 420, color: '#66768A', lineHeight: 1.9 }}
              >
                {currentLang.value === 'th' && contact?.footerText
                  ? contact.footerText
                  : t('footer.description')}
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2.5 }}>
                <FooterBadge label={t('footer.badges.singleAccount')} />
                <FooterBadge label={t('footer.badges.reviewed')} />
              </Stack>

              <Stack spacing={1.25} sx={{ mt: 3 }}>
                {contact?.line && (
                  <ContactLink
                    icon={<RiLineFill size={19} color="#06C755" />}
                    href={contact.line.url}
                    label={t('footer.contactLine')}
                  />
                )}
                <ContactLink
                  icon={<RiMailLine size={18} />}
                  href={`mailto:${contact?.email ?? 'ekru.team@gmail.com'}`}
                  label={contact?.email ?? 'ekru.team@gmail.com'}
                />
                <ContactLink
                  icon={<RiCustomerService2Line size={18} />}
                  href={`mailto:${contact?.email ?? 'ekru.team@gmail.com'}?subject=Marketplace Support`}
                  label={t('footer.support')}
                />
                {!!contact?.supportPhone && (
                  <ContactLink
                    icon={<RiCustomerService2Line size={18} />}
                    href={`tel:${contact.supportPhone}`}
                    label={contact.supportPhone}
                  />
                )}
                {!!contact?.businessHours && (
                  <Typography variant="caption" sx={{ color: '#7B8A9E' }}>
                    {t('footer.businessHours', { hours: contact.businessHours })}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
            <FooterLinkGroup title={t('footer.groups.marketplace')} links={marketplaceLinks} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2.25 }}>
            <FooterLinkGroup title={t('footer.groups.seller')} links={sellerLinks} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2.25 }}>
            <FooterLinkGroup title={t('footer.groups.support')} links={supportLinks} />
          </Grid>
        </Grid>

        <Divider sx={{ mt: { xs: 6, md: 8 }, mb: 3, borderColor: '#DCE5F1' }} />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
        >
          <Stack>
            <Typography variant="caption">
              {contact?.copyrightText ??
                `© ${year} ${contact?.platformName ?? 'E-KRU Marketplace'}. All rights reserved.`}
            </Typography>
            <Typography variant="caption" sx={{ color: '#8492A6' }}>
              Developed by CODE FOR CAT.
            </Typography>
          </Stack>

          <Stack direction="row" spacing={2}>
            <Link
              component="button"
              type="button"
              underline="hover"
              onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
              sx={{
                p: 0,
                border: 0,
                cursor: 'pointer',
                bgcolor: 'transparent',
                typography: 'caption',
                color: '#7B8A9E',
                '&:hover': { color: '#155EEF' },
              }}
            >
              {t('footer.links.cookieSettings')}
            </Link>
            <Link
              component={RouterLink}
              href={paths.legal.privacyPolicy}
              underline="hover"
              sx={{
                typography: 'caption',
                color: '#7B8A9E',
                '&:hover': { color: '#155EEF' },
              }}
            >
              Privacy
            </Link>
            <Link
              component={RouterLink}
              href={paths.legal.termsOfService}
              underline="hover"
              sx={{
                typography: 'caption',
                color: '#7B8A9E',
                '&:hover': { color: '#155EEF' },
              }}
            >
              Terms
            </Link>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function FooterBadge({ label }: { label: string }) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{
        px: 1.25,
        py: 0.75,
        borderRadius: 10,
        color: '#40536A',
        bgcolor: 'rgba(255,255,255,0.72)',
        border: '1px solid #DDE7F3',
        boxShadow: '0 4px 14px rgba(40, 82, 150, 0.05)',
      }}
    >
      <RiShieldCheckLine size={15} color="#18A97B" />
      <Typography variant="caption">{label}</Typography>
    </Stack>
  );
}

function ContactLink({
  icon,
  href,
  label,
}: {
  icon: React.ReactNode;
  href: string;
  label: string;
}) {
  const external = /^https?:\/\//i.test(href);

  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      underline="hover"
      sx={{
        gap: 1,
        width: 'fit-content',
        display: 'flex',
        alignItems: 'center',
        color: '#66768A',
        typography: 'body2',
        '&:hover': { color: '#155EEF' },
      }}
    >
      {icon}
      {label}
    </Link>
  );
}

function FooterLinkGroup({ title, links }: { title: string; links: FooterLink[] }) {
  const { t } = useTranslate('marketplace');
  return (
    <Box component="nav" aria-label={title}>
      <Typography variant="subtitle2" sx={{ color: '#1D2939' }}>
        {title}
      </Typography>
      <Stack spacing={1.5} sx={{ mt: 2 }}>
        {links.map((item) => (
          <Link
            key={`${item.href}-${item.labelKey}`}
            component={RouterLink}
            href={item.href}
            underline="none"
            sx={{
              width: 'fit-content',
              color: '#66768A',
              typography: 'body2',
              transition: 'color 160ms ease, transform 160ms ease',
              '&:hover': { color: '#155EEF', transform: 'translateX(3px)' },
            }}
          >
            {t(`footer.links.${item.labelKey}`)}
          </Link>
        ))}
      </Stack>
    </Box>
  );
}
