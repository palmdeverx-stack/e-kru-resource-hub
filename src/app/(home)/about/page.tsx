import type { Metadata } from 'next';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { getServerTranslations } from 'src/locales/server';

const valueKeys = ['quality', 'trust', 'fairness'] as const;
const audienceKeys = ['buyers', 'sellers', 'schools'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations('marketplace');
  const title = t('aboutPage.seo.title');
  const description = t('aboutPage.seo.description');

  return {
    title,
    description,
    alternates: { canonical: '/about' },
    openGraph: { title, description, url: '/about', type: 'website' },
  };
}

export default async function Page() {
  const { t } = await getServerTranslations('marketplace');

  return (
    <Box component="main">
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderBottom: '1px solid',
          borderColor: 'divider',
          background:
            'radial-gradient(circle at 12% 18%, rgba(21,101,245,0.16), transparent 31%), radial-gradient(circle at 88% 76%, rgba(36,194,142,0.14), transparent 28%), linear-gradient(135deg, #F5F8FF 0%, #FFFFFF 55%, #F1FBF8 100%)',
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 13 } }}>
          <Stack spacing={2.5} sx={{ maxWidth: 820 }}>
            <Typography
              variant="overline"
              sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: 1.5 }}
            >
              {t('aboutPage.eyebrow')}
            </Typography>
            <Typography component="h1" variant="h2" sx={{ maxWidth: 760 }}>
              {t('aboutPage.title')}
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ maxWidth: 760, fontWeight: 400, lineHeight: 1.8 }}
            >
              {t('aboutPage.description')}
            </Typography>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 11 } }}>
        <Grid container spacing={{ xs: 4, md: 7 }} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="overline" color="primary.main" sx={{ fontWeight: 800 }}>
              {t('aboutPage.missionLabel')}
            </Typography>
            <Typography component="h2" variant="h3" sx={{ mt: 1 }}>
              {t('aboutPage.missionTitle')}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card
              variant="outlined"
              sx={{
                p: { xs: 3, md: 5 },
                borderRadius: 4,
                bgcolor: 'background.neutral',
                borderColor: 'transparent',
              }}
            >
              <Typography variant="h6" color="text.secondary" sx={{ lineHeight: 1.9 }}>
                {t('aboutPage.missionDescription')}
              </Typography>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mt: { xs: 8, md: 12 } }}>
          <Typography component="h2" variant="h3" textAlign="center">
            {t('aboutPage.valuesTitle')}
          </Typography>
          <Grid container spacing={2.5} sx={{ mt: 3 }}>
            {valueKeys.map((key, index) => (
              <Grid key={key} size={{ xs: 12, md: 4 }}>
                <Card
                  variant="outlined"
                  sx={{ height: 1, p: 3.5, borderRadius: 3, borderColor: '#DCE5F1' }}
                >
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      display: 'grid',
                      borderRadius: '50%',
                      placeItems: 'center',
                      color: 'primary.main',
                      bgcolor: 'primary.lighter',
                      typography: 'subtitle1',
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography variant="h5" sx={{ mt: 2.5 }}>
                    {t(`aboutPage.values.${key}.title`)}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1.25, lineHeight: 1.8 }}>
                    {t(`aboutPage.values.${key}.description`)}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Box sx={{ mt: { xs: 8, md: 12 } }}>
          <Typography component="h2" variant="h3">
            {t('aboutPage.audienceTitle')}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 3.5 }}>
            {t('aboutPage.audienceDescription')}
          </Typography>
          <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
            {audienceKeys.map((key, index) => (
              <Box
                key={key}
                sx={{
                  py: 3,
                  gap: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '48px 1fr', md: '64px 280px 1fr' },
                  alignItems: 'start',
                }}
              >
                <Typography variant="h4" color="primary.main">
                  0{index + 1}
                </Typography>
                <Typography variant="h6">{t(`aboutPage.audiences.${key}.title`)}</Typography>
                <Typography
                  color="text.secondary"
                  sx={{ gridColumn: { xs: '2', md: 'auto' }, lineHeight: 1.8 }}
                >
                  {t(`aboutPage.audiences.${key}.description`)}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Card
          sx={{
            mt: { xs: 8, md: 12 },
            p: { xs: 4, md: 7 },
            borderRadius: 4,
            color: 'common.white',
            textAlign: 'center',
            background: 'linear-gradient(135deg, #0B3B91 0%, #1565F5 100%)',
          }}
        >
          <Typography component="h2" variant="h3">
            {t('aboutPage.promiseTitle')}
          </Typography>
          <Typography sx={{ mt: 2, mx: 'auto', maxWidth: 720, opacity: 0.86, lineHeight: 1.8 }}>
            {t('aboutPage.promiseDescription')}
          </Typography>
        </Card>
      </Container>
    </Box>
  );
}
