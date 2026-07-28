'use client';

import type { MarketplaceSeller } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { RouterLink } from 'src/routes/components';

import { RiEditLine, RiStore2Line } from 'src/components/remix-icon';

import { getSeller } from '../../shared/api';

const sellerTypeLabel = {
  individual: 'บุคคลทั่วไป',
  teacher: 'ครู',
  school: 'โรงเรียน',
  company: 'บริษัท',
  publisher: 'สำนักพิมพ์',
  university: 'มหาวิทยาลัย',
};

const documentLabel: Record<string, string> = {
  store_logo: 'โลโก้ร้าน',
  store_cover: 'ภาพหน้าปกร้าน',
  identity_card: 'บัตรประชาชน',
  bank_book: 'หน้าสมุดบัญชี',
  company_certificate: 'หนังสือรับรองบริษัท',
  vat_certificate: 'ภ.พ.20',
};

export function MarketplaceSellerProfileView() {
  const [seller, setSeller] = useState<MarketplaceSeller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSeller()
      .then((result) => setSeller(result.seller))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลร้านไม่สำเร็จ')
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ minHeight: 500, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!seller) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Card sx={{ p: 5, textAlign: 'center' }}>
          <RiStore2Line size={48} />
          <Typography variant="h4" sx={{ mt: 2 }}>
            ยังไม่มีข้อมูลร้านค้า
          </Typography>
          <Button
            component={RouterLink}
            href="/dashboard/seller/setup"
            variant="contained"
            sx={{ mt: 3 }}
          >
            สมัครเปิดร้าน
          </Button>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
        sx={{ mb: 4 }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            ข้อมูลร้านค้า
          </Typography>
          <Typography color="text.secondary">
            รายละเอียดทั้งหมดที่กรอกไว้ตอนสมัครเปิดร้าน
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          href="/dashboard/seller/setup?step=1"
          variant="contained"
          startIcon={<RiEditLine />}
        >
          แก้ไขข้อมูล
        </Button>
      </Stack>

      {!!error && <Alert severity="error">{error}</Alert>}
      {seller.status === 'rejected' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          คำขอไม่ผ่านการอนุมัติ: {seller.rejection_reason || 'กรุณาแก้ไขข้อมูลและส่งใหม่'}
        </Alert>
      )}

      <Card sx={{ overflow: 'hidden', mb: 3 }}>
        <Box
          sx={{
            height: 180,
            bgcolor: 'primary.lighter',
            backgroundImage: seller.cover_url ? `url(${seller.cover_url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <Stack direction="row" spacing={2.5} alignItems="center" sx={{ px: 3, pb: 3 }}>
          <Box
            component="img"
            src={seller.logo_url || '/logo/logo-single.svg'}
            alt={seller.display_name}
            sx={{
              width: 96,
              height: 96,
              mt: -5,
              objectFit: 'cover',
              bgcolor: 'white',
              borderRadius: 3,
              border: '4px solid white',
              boxShadow: 3,
            }}
          />
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="h4">{seller.display_name}</Typography>
              <StatusChip status={seller.status} />
            </Stack>
            <Typography color="text.secondary">
              {seller.display_name_en || 'ไม่ได้ระบุชื่อภาษาอังกฤษ'}
            </Typography>
          </Box>
        </Stack>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <DetailCard title="1. ข้อมูลร้านค้า">
            <InfoRow label="ชื่อร้าน" value={seller.display_name} />
            <InfoRow label="ชื่อภาษาอังกฤษ" value={seller.display_name_en} />
            <InfoRow label="URL ร้าน" value={`/store/${seller.slug || '-'}`} />
            <InfoRow label="คำอธิบายร้าน" value={seller.bio} />
          </DetailCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <DetailCard title="2. ข้อมูลผู้ขาย">
            <InfoRow label="ประเภทผู้ขาย" value={sellerTypeLabel[seller.seller_type]} />
            <InfoRow label="ชื่อ-นามสกุล" value={seller.seller_name} />
            <InfoRow label="เบอร์โทร" value={seller.phone} />
            <InfoRow label="Email" value={seller.contact_email} />
            <InfoRow label="เลขบัตร/เลขผู้เสียภาษี" value={seller.national_tax_id} />
            {seller.seller_type === 'company' && (
              <>
                <InfoRow label="ชื่อบริษัท" value={seller.company_name} />
                <InfoRow label="เลขนิติบุคคล" value={seller.company_registration_no} />
                <InfoRow label="เลขผู้เสียภาษีบริษัท" value={seller.company_tax_id} />
              </>
            )}
          </DetailCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <DetailCard title="3. ข้อมูลรับเงิน">
            <InfoRow label="ชื่อบัญชี" value={seller.payout_account?.account_name} />
            <InfoRow label="ธนาคาร" value={seller.payout_account?.bank_name} />
            <InfoRow label="รหัสธนาคาร" value={seller.payout_account?.bank_code} />
            <InfoRow label="เลขบัญชี" value={seller.payout_account?.account_number} />
            <InfoRow label="PromptPay" value={seller.payout_account?.promptpay_id} />
          </DetailCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <DetailCard title="4. เอกสารยืนยัน">
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {seller.documents?.length ? (
                seller.documents.map((document) =>
                  document.url ? (
                    <Button
                      key={document.id}
                      href={document.url}
                      target="_blank"
                      variant="outlined"
                      size="small"
                    >
                      {documentLabel[document.document_type] || document.file_name}
                    </Button>
                  ) : (
                    <Chip
                      key={document.id}
                      label={documentLabel[document.document_type] || document.file_name}
                    />
                  )
                )
              ) : (
                <Typography color="text.secondary">ยังไม่มีเอกสาร</Typography>
              )}
            </Stack>
          </DetailCard>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <DetailCard title="5. ข้อตกลง">
            <Grid container spacing={2}>
              <ConsentItem
                label="ข้อตกลงการเป็นผู้ขาย"
                acceptedAt={seller.seller_agreement_accepted_at}
              />
              <ConsentItem
                label="ยืนยันความเป็นเจ้าของลิขสิทธิ์"
                acceptedAt={seller.copyright_confirmed_at}
              />
              <ConsentItem
                label="ยอมรับการหักค่าธรรมเนียม"
                acceptedAt={seller.fee_agreement_accepted_at}
              />
              <ConsentItem label="ยอมรับ PDPA" acceptedAt={seller.pdpa_accepted_at} />
            </Grid>
          </DetailCard>
        </Grid>
      </Grid>
    </Container>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card sx={{ p: 3, height: 1 }}>
      <Typography variant="h5">{title}</Typography>
      <Divider sx={{ my: 2 }} />
      <Stack spacing={1.25}>{children}</Stack>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography sx={{ textAlign: 'right', wordBreak: 'break-word' }}>{value || '-'}</Typography>
    </Stack>
  );
}

function ConsentItem({ label, acceptedAt }: { label: string; acceptedAt?: string | null }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Alert severity={acceptedAt ? 'success' : 'warning'}>
        {label}
        <Typography variant="caption" component="div">
          {acceptedAt ? new Date(acceptedAt).toLocaleString('th-TH') : 'ยังไม่ยอมรับ'}
        </Typography>
      </Alert>
    </Grid>
  );
}

function StatusChip({ status }: { status: MarketplaceSeller['status'] }) {
  if (status === 'active') return <Chip color="success" label="Approved" size="small" />;
  if (status === 'pending') return <Chip color="warning" label="Pending Review" size="small" />;
  if (status === 'rejected') return <Chip color="error" label="Rejected" size="small" />;
  if (status === 'suspended') return <Chip color="error" label="Suspended" size="small" />;
  return <Chip label="Draft" size="small" />;
}
