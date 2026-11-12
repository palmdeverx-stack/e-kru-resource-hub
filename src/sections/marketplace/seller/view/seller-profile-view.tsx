'use client';

import type { MarketplaceSeller } from '../../shared/types';
import type { DocumentPreviewFile } from '../../shared/document-preview-dialog';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Container from '@mui/material/Container';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import {
  RiEyeLine,
  RiEditLine,
  RiBankLine,
  RiUser3Line,
  RiEyeOffLine,
  RiStore2Line,
  RiFileTextLine,
  RiShieldStarFill,
  RiShieldCheckLine,
  RiInformationLine,
  RiVerifiedBadgeFill,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { getSeller } from '../../shared/api';
import { ThaiBankLogo } from '../../shared/bank-logo';
import { useDashboardLocale } from '../../shared/use-dashboard-locale';
import {
  isSellerProfileVerified,
  isSystemMarketplaceSeller,
  getSellerProfileCompletion,
} from '../../shared/seller-completion';

const DocumentPreviewDialog = dynamic(() =>
  import('../../shared/document-preview-dialog').then((module) => module.DocumentPreviewDialog)
);

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

const VERIFICATION_DOCUMENT_TYPES = new Set([
  'identity_card',
  'bank_book',
  'company_certificate',
  'vat_certificate',
]);

function maskFinancialIdentifier(value: string) {
  const compactValue = value.replace(/\s+/g, '');
  if (compactValue.length <= 4) return 'xxx';

  const hiddenGroups = Math.max(1, Math.ceil((compactValue.length - 4) / 3));
  return `${Array.from({ length: hiddenGroups }, () => 'xxx').join('-')}-${compactValue.slice(-4)}`;
}

export function MarketplaceSellerProfileView() {
  const { tx, locale } = useDashboardLocale();
  const theme = useTheme();
  const formatDocumentUploadDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? tx('ไม่พบวันที่อัปโหลด')
      : tx('อัปโหลด {{v0}}', {
          v0: date.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'Asia/Bangkok',
          }),
        });
  };
  const { user } = useAuthContext();
  const {
    data,
    isPending: loading,
    error: loadError,
  } = useQuery({
    queryKey: ['seller-profile', user?.id, user?.role],
    enabled: Boolean(user?.id),
    queryFn: ({ signal }) => getSeller({ signal }),
    staleTime: 30_000,
  });
  const seller = data?.seller ?? null;
  const error = loadError?.message ?? '';
  const completion = useMemo(() => (seller ? getSellerProfileCompletion(seller) : 0), [seller]);
  const verificationDocuments = useMemo(
    () =>
      seller?.documents?.filter((document) =>
        VERIFICATION_DOCUMENT_TYPES.has(document.document_type)
      ) ?? [],
    [seller?.documents]
  );
  const [showPayoutDetails, setShowPayoutDetails] = useState(false);
  const [previewFile, setPreviewFile] = useState<DocumentPreviewFile | null>(null);

  if (loading) {
    return (
      <Box sx={{ minHeight: 500, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!seller) {
    if (error) {
      return (
        <Container maxWidth={false} sx={{ py: 3 }}>
          <Alert severity="error">{error}</Alert>
        </Container>
      );
    }
    return (
      <Container maxWidth={false} sx={{ py: 8 }}>
        <Card variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: 4 }}>
          <Avatar
            variant="rounded"
            sx={{
              width: 76,
              height: 76,
              mx: 'auto',
              color: 'primary.main',
              bgcolor: 'primary.lighter',
            }}
          >
            <RiStore2Line size={38} />
          </Avatar>
          <Typography variant="h4" sx={{ mt: 2.5 }}>
            {tx('ยังไม่มีข้อมูลร้านค้า')}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            {tx('เริ่มกรอกข้อมูลเพื่อส่งคำขอเปิดร้านบน E-KRU Marketplace')}
          </Typography>
          <Button
            component={RouterLink}
            href={paths.marketplace.sellerSetup}
            variant="contained"
            sx={{ mt: 3 }}
          >
            {tx('สมัครเปิดร้าน')}
          </Button>
        </Card>
      </Container>
    );
  }

  const storeHref = `/dashboard/store/${seller.slug || seller.id}`;

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3, md: 4 }, pb: { xs: 8, md: 5 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'flex-end' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography component="h1" variant="h3" sx={{ fontSize: { xs: 28, md: 40 } }}>
            {tx('ข้อมูลร้านค้า')}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {tx('ตรวจสอบและจัดการข้อมูลที่ใช้แสดงหน้าร้านและรับเงิน')}
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{ width: { xs: 1, sm: 'auto' }, '& > *': { flex: { xs: 1, sm: 'initial' } } }}
        >
          {seller.status === 'active' && (
            <Button
              component={RouterLink}
              href={storeHref}
              color="inherit"
              variant="outlined"
              startIcon={<RiEyeLine />}
            >
              {tx('ดูหน้าร้าน')}
            </Button>
          )}
          <Button
            component={RouterLink}
            href={paths.marketplace.sellerProfileEdit}
            variant="contained"
            startIcon={<RiEditLine />}
          >
            {tx('แก้ไขข้อมูล')}
          </Button>
        </Stack>
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {seller.status === 'rejected' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {tx('คำขอไม่ผ่านการอนุมัติ:')}{' '}
          {seller.rejection_reason || tx('กรุณาแก้ไขข้อมูลและส่งใหม่')}
        </Alert>
      )}
      {seller.status === 'pending' && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {tx('ข้อมูลร้านกำลังรอผู้ดูแลระบบตรวจสอบ คุณยังสามารถกลับไปแก้ไขข้อมูลได้')}
        </Alert>
      )}

      <Card
        variant="outlined"
        sx={{ mb: 3, overflow: 'hidden', position: 'relative', borderRadius: 4 }}
      >
        <Box
          sx={{
            height: { xs: 150, sm: 190, md: 250 },
            position: 'relative',
            bgcolor: '#0A4D68',
            backgroundImage: seller.cover_url
              ? `linear-gradient(180deg, rgba(3,31,48,0.08), rgba(3,31,48,0.52)), url(${seller.cover_url})`
              : 'linear-gradient(125deg, #0A4D68 0%, #147E96 55%, #45B7B8 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <Chip
            icon={<RiShieldCheckLine />}
            label="E-KRU Marketplace Seller"
            sx={{
              top: { xs: 12, md: 20 },
              right: { xs: 12, md: 20 },
              position: 'absolute',
              color: 'common.white',
              bgcolor: 'rgba(0,0,0,0.28)',
              backdropFilter: 'blur(8px)',
            }}
          />
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2.5}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          sx={{ px: { xs: 2, sm: 2.5, md: 4 }, pb: { xs: 2.5, md: 3.5 } }}
        >
          <Avatar
            src={seller.logo_url ?? undefined}
            alt={seller.display_name}
            variant="circular"
            sx={{
              width: { xs: 88, md: 112 },
              height: { xs: 88, md: 112 },
              mt: { xs: -5, md: -15 },
              bgcolor: 'background.paper',
              color: 'primary.main',
              border: '5px solid',
              borderColor: 'background.paper',
              boxShadow: 3,
            }}
          >
            <RiStore2Line size={42} />
          </Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1, pt: { sm: 2 } }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="h3" sx={{ fontSize: { xs: 26, md: 40 } }}>
                {seller.display_name}
              </Typography>
              {isSellerProfileVerified(completion) && (
                <RiVerifiedBadgeFill
                  size={26}
                  color={theme.palette.primary.main}
                  aria-label={tx('ร้านค้าที่ผ่านการตรวจสอบ')}
                />
              )}
              {isSystemMarketplaceSeller(seller) && (
                <RiShieldStarFill
                  size={26}
                  color={theme.palette.primary.main}
                  aria-label={tx('ร้านค้าระบบ E-KRU')}
                />
              )}
              <StatusChip status={seller.status} />
              <Chip
                size="small"
                variant="outlined"
                label={tx(sellerTypeLabel[seller.seller_type])}
              />
            </Stack>
            {seller.display_name_en && (
              <Typography color="text.secondary" sx={{ mt: 0.25 }}>
                {seller.display_name_en}
              </Typography>
            )}
            <Typography sx={{ mt: 1, maxWidth: 760 }}>
              {seller.bio || tx('ยังไม่ได้เพิ่มคำอธิบายร้าน')}
            </Typography>
          </Box>
        </Stack>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3} sx={{ position: { lg: 'sticky' }, top: { lg: 96 } }}>
            <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6"> {tx('ความครบถ้วนของข้อมูล')} </Typography>
                <Typography variant="h5" color="primary.main">
                  {completion}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={completion}
                sx={{ height: 9, mt: 2, mb: 1.25, borderRadius: 8 }}
              />
              <Typography variant="body2" color="text.secondary">
                {completion === 100
                  ? tx('ข้อมูลร้านครบถ้วน พร้อมใช้งาน')
                  : tx('เพิ่มข้อมูลและเอกสารให้ครบเพื่อสร้างความน่าเชื่อถือ')}
              </Typography>
            </Card>

            <SectionCard
              title={tx('ข้อมูลร้าน')}
              description={tx('ข้อมูลที่แสดงบนหน้าร้าน')}
              icon={<RiStore2Line />}
            >
              <InfoRow label={tx('ชื่อร้าน')} value={seller.display_name} />
              <InfoRow label={tx('ชื่อภาษาอังกฤษ')} value={seller.display_name_en} />
              <InfoRow label={tx('URL ร้าน')} value={`/store/${seller.slug || seller.id}`} />
              <InfoRow label={tx('ประเภทร้าน')} value={tx(sellerTypeLabel[seller.seller_type])} />
            </SectionCard>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={3}>
            <SectionCard
              title={tx('ข้อมูลผู้ขายและการติดต่อ')}
              description={tx('ข้อมูลสำหรับการยืนยันตัวตนและติดต่อจากระบบ')}
              icon={<RiUser3Line />}
            >
              <Grid container columnSpacing={4} rowSpacing={0}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ProfileField label={tx('ชื่อ-นามสกุล')} value={seller.seller_name} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ProfileField label={tx('เบอร์โทรศัพท์')} value={seller.phone} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ProfileField label={tx('อีเมล')} value={seller.contact_email} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ProfileField
                    label={tx('เลขบัตร/เลขผู้เสียภาษี')}
                    value={seller.national_tax_id}
                  />
                </Grid>
              </Grid>

              {seller.seller_type === 'company' && (
                <Box sx={{ mt: 3 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Box sx={{ width: 4, height: 18, borderRadius: 1, bgcolor: 'primary.main' }} />
                    <Typography variant="subtitle2"> {tx('ข้อมูลนิติบุคคล')} </Typography>
                  </Stack>
                  <Grid container columnSpacing={4} rowSpacing={0}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <ProfileField label={tx('ชื่อบริษัท')} value={seller.company_name} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <ProfileField
                        label={tx('เลขนิติบุคคล')}
                        value={seller.company_registration_no}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <ProfileField
                        label={tx('เลขผู้เสียภาษีบริษัท')}
                        value={seller.company_tax_id}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <ProfileField
                        label={tx('ที่อยู่ผู้ออกใบเสร็จ')}
                        value={seller.business_address}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}
            </SectionCard>

            <SectionCard
              title={tx('บัญชีรับเงิน')}
              description={tx('บัญชีที่ระบบใช้โอนรายได้จากการขายสินค้า')}
              icon={<RiBankLine />}
              action={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {seller.payout_account?.is_verified ? (
                    <Chip
                      size="small"
                      color="success"
                      variant="soft"
                      icon={<RiCheckboxCircleLine />}
                      label={tx('ยืนยันแล้ว')}
                    />
                  ) : (
                    <Chip size="small" color="warning" variant="soft" label={tx('รอตรวจสอบ')} />
                  )}
                  {seller.payout_account && (
                    <Tooltip
                      title={showPayoutDetails ? tx('ซ่อนข้อมูลบัญชี') : tx('แสดงข้อมูลบัญชี')}
                    >
                      <IconButton
                        size="small"
                        color="primary"
                        aria-pressed={showPayoutDetails}
                        aria-label={
                          showPayoutDetails ? tx('ซ่อนข้อมูลบัญชี') : tx('แสดงข้อมูลบัญชี')
                        }
                        onClick={() => setShowPayoutDetails((current) => !current)}
                      >
                        {showPayoutDetails ? <RiEyeOffLine /> : <RiEyeLine />}
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              }
            >
              {seller.payout_account ? (
                <Stack spacing={2}>
                  <Box
                    sx={{
                      p: { xs: 2, sm: 2.5 },
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      background:
                        'linear-gradient(135deg, rgba(21,101,245,0.08) 0%, rgba(255,255,255,0) 60%)',
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      spacing={2}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <ThaiBankLogo
                          bankCode={seller.payout_account.bank_code}
                          bankName={seller.payout_account.bank_name}
                          size={56}
                          sx={{ boxShadow: 1 }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" color="text.secondary">
                            {tx('บัญชีหลักสำหรับรับยอดขาย')}
                          </Typography>
                          <Typography variant="h6" noWrap>
                            {seller.payout_account.bank_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {tx('รหัสธนาคาร')} {seller.payout_account.bank_code}
                          </Typography>
                        </Box>
                      </Stack>
                      {seller.payout_account.promptpay_id && (
                        <Chip
                          size="small"
                          variant="soft"
                          color="primary"
                          label={`PromptPay ${
                            showPayoutDetails
                              ? seller.payout_account.promptpay_id
                              : maskFinancialIdentifier(seller.payout_account.promptpay_id)
                          }`}
                          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                        />
                      )}
                    </Stack>

                    <Box
                      sx={{
                        gap: 2,
                        mt: 2.5,
                        pt: 2.5,
                        display: 'grid',
                        borderTop: '1px dashed',
                        borderColor: 'divider',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                      }}
                    >
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {tx('ชื่อบัญชี')}
                        </Typography>
                        <Typography variant="subtitle1">
                          {seller.payout_account.account_name}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {tx('เลขบัญชี')}
                        </Typography>
                        <Typography variant="subtitle1" sx={{ letterSpacing: 0.6 }}>
                          {showPayoutDetails
                            ? seller.payout_account.account_number
                            : maskFinancialIdentifier(seller.payout_account.account_number)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Alert severity="info" variant="outlined">
                    {tx(
                      'โปรดตรวจสอบชื่อบัญชี เลขบัญชี และธนาคารให้ถูกต้อง หากข้อมูลไม่ตรงกันระบบจะเลื่อนยอดไปรอบโอนถัดไป'
                    )}
                  </Alert>
                </Stack>
              ) : (
                <Alert severity="warning">
                  {tx('ยังไม่มีข้อมูลบัญชีรับเงิน กรุณาแก้ไขข้อมูลร้านค้า')}
                </Alert>
              )}
            </SectionCard>

            <SectionCard
              title={tx('เอกสารยืนยัน')}
              description={tx('เอกสารที่ส่งให้ผู้ดูแลตรวจสอบตอนสมัครเปิดร้าน')}
              icon={<RiFileTextLine />}
              action={
                <Chip
                  size="small"
                  variant="outlined"
                  label={tx('{{v0}} ไฟล์', { v0: verificationDocuments.length })}
                />
              }
            >
              {verificationDocuments.length ? (
                <Grid container spacing={2}>
                  {verificationDocuments.map((document) => (
                    <Grid key={document.id} size={{ xs: 12, sm: 6 }}>
                      <Card
                        variant="outlined"
                        sx={{
                          p: 2,
                          height: 1,
                          borderRadius: 2.5,
                          bgcolor: 'background.paper',
                        }}
                      >
                        <Stack spacing={2} height={1}>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar
                              variant="rounded"
                              sx={{
                                width: 42,
                                height: 42,
                                flexShrink: 0,
                                color: 'primary.main',
                                bgcolor: 'primary.lighter',
                              }}
                            >
                              <RiFileTextLine size={22} />
                            </Avatar>
                            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                              <Typography variant="subtitle2" noWrap>
                                {documentLabel[document.document_type]
                                  ? tx(documentLabel[document.document_type])
                                  : document.file_name}
                              </Typography>
                              <Typography
                                noWrap
                                variant="caption"
                                color="text.secondary"
                                title={formatDocumentUploadDate(document.uploaded_at)}
                                sx={{ display: 'block' }}
                              >
                                {formatDocumentUploadDate(document.uploaded_at)}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              variant="soft"
                              label={`${(document.file_size / 1024 / 1024).toFixed(2)} MB`}
                              sx={{ flexShrink: 0 }}
                            />
                          </Stack>
                          <Button
                            fullWidth
                            size="small"
                            color="inherit"
                            variant="outlined"
                            disabled={!document.url}
                            startIcon={<RiEyeLine />}
                            onClick={() => {
                              if (!document.url) return;
                              setPreviewFile({
                                url: document.url,
                                title: documentLabel[document.document_type]
                                  ? tx(documentLabel[document.document_type])
                                  : document.file_name,
                                fileName: document.file_name,
                                mimeType: document.mime_type,
                              });
                            }}
                          >
                            {tx('ดูตัวอย่าง')}
                          </Button>
                        </Stack>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="info"> {tx('ยังไม่มีเอกสารยืนยันในระบบ')} </Alert>
              )}
            </SectionCard>

            <SectionCard
              title={tx('ข้อตกลงและการยินยอม')}
              description={tx('สถานะข้อตกลงที่ยืนยันตอนส่งคำขอเปิดร้าน')}
              icon={<RiShieldCheckLine />}
            >
              <Grid container columnSpacing={4} rowSpacing={0}>
                <ConsentItem
                  label={tx('ข้อตกลงการเป็นผู้ขาย')}
                  acceptedAt={seller.seller_agreement_accepted_at}
                />
                <ConsentItem
                  label={tx('ยืนยันความเป็นเจ้าของลิขสิทธิ์')}
                  acceptedAt={seller.copyright_confirmed_at}
                />
                <ConsentItem
                  label={tx('ยอมรับการหักค่าธรรมเนียม')}
                  acceptedAt={seller.fee_agreement_accepted_at}
                />
                <ConsentItem label={tx('ยอมรับ PDPA')} acceptedAt={seller.pdpa_accepted_at} />
              </Grid>
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
      {previewFile && (
        <DocumentPreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </Container>
  );
}

function SectionCard({
  title,
  description,
  icon,
  action,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          <Avatar
            variant="rounded"
            sx={{ width: 44, height: 44, color: 'primary.main', bgcolor: 'primary.lighter' }}
          >
            {icon}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
        </Stack>
        {action && <Box sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' } }}>{action}</Box>}
      </Stack>
      <Divider sx={{ my: 2.5 }} />
      {children}
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ maxWidth: '60%', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}
      >
        {value || '-'}
      </Typography>
    </Stack>
  );
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box
      sx={{
        py: 1.75,
        minHeight: 68,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle2" sx={{ mt: 0.25, wordBreak: 'break-word' }}>
        {value || '-'}
      </Typography>
    </Box>
  );
}

function ConsentItem({ label, acceptedAt }: { label: string; acceptedAt?: string | null }) {
  const { tx, locale } = useDashboardLocale();
  const accepted = Boolean(acceptedAt);
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        sx={{
          py: 1.75,
          minHeight: 72,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {accepted ? (
          <RiCheckboxCircleLine size={22} color="#118D57" />
        ) : (
          <RiInformationLine size={22} color="#B76E00" />
        )}
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle2">{label}</Typography>
          <Typography variant="caption" color="text.secondary">
            {acceptedAt
              ? tx('ยอมรับเมื่อ {{v0}}', {
                  v0: new Date(acceptedAt).toLocaleDateString(locale, {
                    dateStyle: 'medium',
                    timeZone: 'Asia/Bangkok',
                  }),
                })
              : tx('ยังไม่ยอมรับ')}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="soft"
          color={accepted ? 'success' : 'warning'}
          label={accepted ? tx('ยอมรับแล้ว') : tx('ยังไม่ยอมรับ')}
        />
      </Stack>
    </Grid>
  );
}

function StatusChip({ status }: { status: MarketplaceSeller['status'] }) {
  const { tx } = useDashboardLocale();
  const statusMap = {
    active: { label: tx('เปิดใช้งาน'), color: 'success' as const },
    pending: { label: tx('รอตรวจสอบ'), color: 'warning' as const },
    rejected: { label: tx('ไม่ผ่านการตรวจสอบ'), color: 'error' as const },
    suspended: { label: tx('ระงับใช้งาน'), color: 'error' as const },
    draft: { label: tx('ฉบับร่าง'), color: 'default' as const },
  };
  const item = statusMap[status];
  return <Chip size="small" color={item.color} variant="soft" label={item.label} />;
}
