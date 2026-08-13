'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { useTranslate } from 'src/locales';

import {
  RiLineFill,
  RiMailLine,
  RiTimeLine,
  RiPhoneLine,
  RiArrowRightLine,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

type ContactSettings = {
  email: string;
  supportPhone: string | null;
  businessHours: string | null;
  line: {
    basicId: string;
    displayName: string;
    url: string;
  } | null;
};

const FALLBACK_EMAIL = 'ekru.team@gmail.com';
const prepareKeys = ['order', 'account', 'detail', 'security'] as const;

export function MarketplaceContactView() {
  const { t } = useTranslate('marketplace');
  const [contact, setContact] = useState<ContactSettings>({
    email: FALLBACK_EMAIL,
    supportPhone: null,
    businessHours: null,
    line: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/marketplace/contact', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load contact settings');
        return response.json() as Promise<ContactSettings>;
      })
      .then(setContact)
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  const emailHref = `mailto:${contact.email}?subject=${encodeURIComponent(
    'สอบถาม E-KRU Marketplace'
  )}`;

  return (
    <Box component="main">
      <Box
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          background:
            'radial-gradient(circle at 14% 24%, rgba(21,101,245,0.15), transparent 30%), radial-gradient(circle at 90% 70%, rgba(36,194,142,0.13), transparent 28%), linear-gradient(135deg, #F4F8FF 0%, #FFFFFF 58%, #F2FBF8 100%)',
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 7, md: 11 } }}>
          <Typography
            variant="overline"
            sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: 1.5 }}
          >
            {t('contactPage.eyebrow')}
          </Typography>
          <Typography component="h1" variant="h2" sx={{ mt: 1.5, maxWidth: 760 }}>
            {t('contactPage.title')}
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ mt: 2, maxWidth: 760, fontWeight: 400, lineHeight: 1.8 }}
          >
            {t('contactPage.description')}
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
        <Grid container spacing={2.5}>
          {contact.line && (
            <Grid size={{ xs: 12, md: contact.supportPhone ? 4 : 6 }}>
              <ContactCard
                icon={<RiLineFill size={25} />}
                iconColor="#06C755"
                title={t('contactPage.line.title')}
                value={contact.line.basicId}
                description={t('contactPage.line.description')}
                action={t('contactPage.line.action')}
                href={contact.line.url}
              />
            </Grid>
          )}
          <Grid size={{ xs: 12, md: contact.line && contact.supportPhone ? 4 : 6 }}>
            <ContactCard
              icon={<RiMailLine size={24} />}
              iconColor="#1565F5"
              title={t('contactPage.email.title')}
              value={contact.email}
              description={t('contactPage.email.description')}
              action={t('contactPage.email.action')}
              href={emailHref}
            />
          </Grid>
          {contact.supportPhone && (
            <Grid size={{ xs: 12, md: contact.line ? 4 : 6 }}>
              <ContactCard
                icon={<RiPhoneLine size={24} />}
                iconColor="#7A5AF8"
                title={t('contactPage.phone.title')}
                value={contact.supportPhone}
                description={t('contactPage.phone.description')}
                action={t('contactPage.phone.action')}
                href={`tel:${contact.supportPhone}`}
              />
            </Grid>
          )}
        </Grid>

        <Card
          variant="outlined"
          sx={{ mt: 2.5, p: { xs: 2.5, md: 3 }, borderRadius: 3, borderColor: '#DCE5F1' }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              variant="rounded"
              sx={{ color: 'primary.main', bgcolor: 'primary.lighter' }}
            >
              <RiTimeLine size={22} />
            </Avatar>
            <Box>
              <Typography variant="subtitle1">{t('contactPage.hours.title')}</Typography>
              <Typography color="text.secondary">
                {contact.businessHours || t('contactPage.hours.fallback')}
              </Typography>
            </Box>
          </Stack>
        </Card>

        <Grid container spacing={{ xs: 4, md: 7 }} sx={{ mt: { xs: 6, md: 9 } }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography component="h2" variant="h3">
              {t('contactPage.prepareTitle')}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.8 }}>
              {t('contactPage.prepareDescription')}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card
              variant="outlined"
              sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, borderColor: '#DCE5F1' }}
            >
              <Stack spacing={2.25}>
                {prepareKeys.map((key) => (
                  <Stack key={key} direction="row" spacing={1.5} alignItems="flex-start">
                    <Box sx={{ mt: 0.25, flexShrink: 0, color: 'success.main' }}>
                      <RiCheckboxCircleLine size={21} />
                    </Box>
                    <Typography color="text.secondary" sx={{ lineHeight: 1.75 }}>
                      {t(`contactPage.prepare.${key}`)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Card>
          </Grid>
        </Grid>

        <Alert severity="info" sx={{ mt: 4 }}>
          {t('contactPage.responseNote')}
        </Alert>
      </Container>
    </Box>
  );
}

function ContactCard({
  icon,
  iconColor,
  title,
  value,
  description,
  action,
  href,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  value: string;
  description: string;
  action: string;
  href: string;
}) {
  const external = href.startsWith('http');

  return (
    <Card
      variant="outlined"
      sx={{ height: 1, p: 3, borderRadius: 3, borderColor: '#DCE5F1' }}
    >
      <Avatar variant="rounded" sx={{ color: iconColor, bgcolor: `${iconColor}14` }}>
        {icon}
      </Avatar>
      <Typography variant="h5" sx={{ mt: 2.5 }}>
        {title}
      </Typography>
      <Typography variant="subtitle2" color="primary.main" sx={{ mt: 0.75 }}>
        {value}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1.5, minHeight: 52, lineHeight: 1.7 }}>
        {description}
      </Typography>
      <Button
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        endIcon={<RiArrowRightLine />}
        sx={{ mt: 2 }}
      >
        {action}
      </Button>
    </Card>
  );
}
