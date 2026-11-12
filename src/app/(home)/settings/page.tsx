import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { getServerTranslations } from 'src/locales/server';

import { MarketplaceFooter } from 'src/sections/marketplace/shared/footer';

export default async function Page() {
  const { t } = await getServerTranslations('navbar');

  return (
    <>
      <Container sx={{ py: 3 }}>
        <Typography component="h1" variant="h4">
          {t('ตั้งค่าระบบ')}
        </Typography>
      </Container>
      <MarketplaceFooter />
    </>
  );
}
