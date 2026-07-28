'use client';

import { m } from 'framer-motion';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';
import { SimpleLayout } from 'src/layouts/simple';

import { varBounce, MotionContainer } from 'src/components/animate';
import { RiHome5Line, RiSearchEyeLine } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export function NotFoundView() {
  const { user } = useAuthContext();
  const { t } = useTranslate('common');
  const homePath =
    user?.role === 'master_admin'
      ? paths.master.root
      : user?.role === 'school_admin'
        ? paths.admin.root
        : user?.role === 'teacher'
          ? paths.teacher.root
          : user?.role === 'student'
            ? paths.student.root
            : '/';

  return (
    <SimpleLayout
      slotProps={{
        content: { compact: true },
      }}
    >
      <Container
        component={MotionContainer}
        maxWidth="sm"
        sx={{ py: { xs: 5, sm: 8 }, textAlign: 'center' }}
      >
        <m.div variants={varBounce('in')}>
          <Box
            sx={{
              width: { xs: 112, sm: 136 },
              height: { xs: 112, sm: 136 },
              mx: 'auto',
              mb: 3,
              display: 'grid',
              borderRadius: '50%',
              color: 'primary.main',
              placeItems: 'center',
              bgcolor: 'primary.lighter',
              border: '1px solid',
              borderColor: 'primary.light',
            }}
          >
            <RiSearchEyeLine size={64} aria-hidden />
          </Box>
        </m.div>

        <m.div variants={varBounce('in')}>
          <Typography
            component="p"
            sx={{
              mb: 1,
              lineHeight: 1,
              fontWeight: 800,
              color: 'primary.main',
              fontSize: { xs: '3.75rem', sm: '5rem' },
            }}
          >
            404
          </Typography>
          <Typography component="h1" variant="h3">
            {t('errors.notFound.title')}
          </Typography>
        </m.div>

        <m.div variants={varBounce('in')}>
          <Stack sx={{ mt: 3, mb: 4 }}>
            <Typography sx={{ color: 'text.secondary' }}>
              {t('errors.notFound.description')}
            </Typography>
          </Stack>
        </m.div>

        <m.div variants={varBounce('in')}>
          <Button
            component={RouterLink}
            href={homePath}
            size="large"
            variant="contained"
            startIcon={<RiHome5Line />}
            sx={{ minWidth: 220 }}
          >
            {t('errors.notFound.backHome')}
          </Button>
        </m.div>
      </Container>
    </SimpleLayout>
  );
}
