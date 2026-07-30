import type { Metadata } from 'next';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { LEGAL_DOCUMENT_LABELS } from 'src/sections/marketplace/legal/types';

export const metadata: Metadata = {
  title: 'เอกสารกฎหมายและนโยบาย | E-KRU Marketplace',
};

const documents = [
  ['terms_of_service', paths.legal.termsOfService],
  ['seller_agreement', paths.legal.sellerAgreement],
  ['privacy_policy', paths.legal.privacyPolicy],
  ['copyright_takedown', paths.legal.copyrightTakedown],
  ['refund_policy', paths.legal.refundPolicy],
  ['cookie_policy', paths.legal.cookiePolicy],
  ['digital_product_license', paths.legal.digitalProductLicense],
  ['payment_payout_policy', paths.legal.paymentPayoutPolicy],
  ['product_content_policy', paths.legal.productContentPolicy],
  ['complaint_dispute_policy', paths.legal.complaintDisputePolicy],
  ['child_data_policy', paths.legal.childDataPolicy],
  ['data_processing_agreement', paths.legal.dataProcessingAgreement],
  ['subscription_policy', paths.legal.subscriptionPolicy],
] as const;

export default function Page() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 7 } }}>
      <Typography component="h1" variant="h3">
        เอกสารกฎหมายและนโยบาย
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        เอกสารฉบับปัจจุบันที่ใช้กับผู้ซื้อ ผู้ขาย โรงเรียน และบริการของ E-KRU Marketplace
      </Typography>
      <Stack spacing={1.5}>
        {documents.map(([type, href]) => (
          <RouterLink key={type} href={href} style={{ color: 'inherit', textDecoration: 'none' }}>
            <Card
              sx={{
                p: 2.25,
                transition: 'border-color 160ms ease, box-shadow 160ms ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: 8,
                },
              }}
            >
              <Typography variant="subtitle1">{LEGAL_DOCUMENT_LABELS[type]}</Typography>
            </Card>
          </RouterLink>
        ))}
      </Stack>
    </Container>
  );
}
