'use client';

import type { MarketplaceSeller } from '../../shared/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
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
  RiStore2Line,
  RiFileTextLine,
  RiShieldCheckLine,
  RiInformationLine,
  RiExternalLinkLine,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

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
            ยังไม่มีข้อมูลร้านค้า
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            เริ่มกรอกข้อมูลเพื่อส่งคำขอเปิดร้านบน E-KRU Marketplace
          </Typography>
          <Button
            component={RouterLink}
            href={paths.marketplace.sellerSetup}
            variant="contained"
            sx={{ mt: 3 }}
          >
            สมัครเปิดร้าน
          </Button>
        </Card>
      </Container>
    );
  }

  const storeHref = `/dashboard/store/${seller.slug || seller.id}`;
  const completionItems = [
    Boolean(seller.display_name),
    Boolean(seller.bio),
    Boolean(seller.logo_url),
    Boolean(seller.cover_url),
    Boolean(seller.seller_name),
    Boolean(seller.phone),
    Boolean(seller.contact_email),
    Boolean(seller.payout_account),
    Boolean(seller.documents?.length),
    Boolean(
      seller.seller_agreement_accepted_at &&
      seller.copyright_confirmed_at &&
      seller.fee_agreement_accepted_at &&
      seller.pdpa_accepted_at
    ),
  ];
  const completion = Math.round(
    (completionItems.filter(Boolean).length / completionItems.length) * 100
  );

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3, md: 5 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'flex-end' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            ข้อมูลร้านค้า
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            ตรวจสอบและจัดการข้อมูลที่ใช้แสดงหน้าร้านและรับเงิน
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {seller.status === 'active' && (
            <Button
              component={RouterLink}
              href={storeHref}
              color="inherit"
              variant="outlined"
              startIcon={<RiEyeLine />}
            >
              ดูหน้าร้าน
            </Button>
          )}
          <Button
            component={RouterLink}
            href={paths.marketplace.sellerProfileEdit}
            variant="contained"
            startIcon={<RiEditLine />}
          >
            แก้ไขข้อมูล
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
          คำขอไม่ผ่านการอนุมัติ: {seller.rejection_reason || 'กรุณาแก้ไขข้อมูลและส่งใหม่'}
        </Alert>
      )}
      {seller.status === 'pending' && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          ข้อมูลร้านกำลังรอผู้ดูแลระบบตรวจสอบ คุณยังสามารถกลับไปแก้ไขข้อมูลได้
        </Alert>
      )}

      <Card
        variant="outlined"
        sx={{ mb: 3, overflow: 'hidden', position: 'relative', borderRadius: 4 }}
      >
        <Box
          sx={{
            height: { xs: 180, md: 250 },
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
              top: 20,
              right: 20,
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
          sx={{ px: { xs: 2.5, md: 4 }, pb: 3.5 }}
        >
          <Avatar
            src={seller.logo_url ?? undefined}
            alt={seller.display_name}
            variant="rounded"
            sx={{
              width: { xs: 88, md: 112 },
              height: { xs: 88, md: 112 },
              mt: { xs: -5, md: -7 },
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
              <Typography variant="h3">{seller.display_name}</Typography>
              <StatusChip status={seller.status} />
              <Chip size="small" variant="outlined" label={sellerTypeLabel[seller.seller_type]} />
            </Stack>
            {seller.display_name_en && (
              <Typography color="text.secondary" sx={{ mt: 0.25 }}>
                {seller.display_name_en}
              </Typography>
            )}
            <Typography sx={{ mt: 1, maxWidth: 760 }}>
              {seller.bio || 'ยังไม่ได้เพิ่มคำอธิบายร้าน'}
            </Typography>
          </Box>
        </Stack>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3} sx={{ position: { lg: 'sticky' }, top: { lg: 96 } }}>
            <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">ความครบถ้วนของข้อมูล</Typography>
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
                  ? 'ข้อมูลร้านครบถ้วน พร้อมใช้งาน'
                  : 'เพิ่มข้อมูลและเอกสารให้ครบเพื่อสร้างความน่าเชื่อถือ'}
              </Typography>
            </Card>

            <SectionCard
              title="ข้อมูลร้าน"
              description="ข้อมูลที่แสดงบนหน้าร้าน"
              icon={<RiStore2Line />}
            >
              <InfoRow label="ชื่อร้าน" value={seller.display_name} />
              <InfoRow label="ชื่อภาษาอังกฤษ" value={seller.display_name_en} />
              <InfoRow label="URL ร้าน" value={`/store/${seller.slug || seller.id}`} />
              <InfoRow label="ประเภทร้าน" value={sellerTypeLabel[seller.seller_type]} />
            </SectionCard>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={3}>
            <SectionCard
              title="ข้อมูลผู้ขายและการติดต่อ"
              description="ข้อมูลสำหรับการยืนยันตัวตนและติดต่อจากระบบ"
              icon={<RiUser3Line />}
            >
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ProfileField label="ชื่อ-นามสกุล" value={seller.seller_name} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ProfileField label="เบอร์โทรศัพท์" value={seller.phone} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ProfileField label="อีเมล" value={seller.contact_email} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <ProfileField label="เลขบัตร/เลขผู้เสียภาษี" value={seller.national_tax_id} />
                </Grid>
                {seller.seller_type === 'company' && (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <ProfileField label="ชื่อบริษัท" value={seller.company_name} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <ProfileField label="เลขนิติบุคคล" value={seller.company_registration_no} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <ProfileField label="เลขผู้เสียภาษีบริษัท" value={seller.company_tax_id} />
                    </Grid>
                  </>
                )}
              </Grid>
            </SectionCard>

            <SectionCard
              title="บัญชีรับเงิน"
              description="บัญชีที่ระบบใช้โอนรายได้จากการขายสินค้า"
              icon={<RiBankLine />}
              action={
                seller.payout_account?.is_verified ? (
                  <Chip
                    size="small"
                    color="success"
                    variant="soft"
                    icon={<RiCheckboxCircleLine />}
                    label="ยืนยันแล้ว"
                  />
                ) : (
                  <Chip size="small" color="warning" variant="soft" label="รอตรวจสอบ" />
                )
              }
            >
              {seller.payout_account ? (
                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <ProfileField label="ชื่อบัญชี" value={seller.payout_account.account_name} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <ProfileField label="ธนาคาร" value={seller.payout_account.bank_name} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <ProfileField label="เลขบัญชี" value={seller.payout_account.account_number} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <ProfileField label="PromptPay" value={seller.payout_account.promptpay_id} />
                  </Grid>
                </Grid>
              ) : (
                <Alert severity="warning">ยังไม่มีข้อมูลบัญชีรับเงิน กรุณาแก้ไขข้อมูลร้านค้า</Alert>
              )}
            </SectionCard>

            <SectionCard
              title="เอกสารยืนยัน"
              description="เอกสารที่ส่งให้ผู้ดูแลตรวจสอบตอนสมัครเปิดร้าน"
              icon={<RiFileTextLine />}
              action={
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${seller.documents?.length ?? 0} ไฟล์`}
                />
              }
            >
              {seller.documents?.length ? (
                <Grid container spacing={1.5}>
                  {seller.documents.map((document) => (
                    <Grid key={document.id} size={{ xs: 12, sm: 6 }}>
                      <Card variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar
                            variant="rounded"
                            sx={{ color: 'primary.main', bgcolor: 'primary.lighter' }}
                          >
                            <RiFileTextLine />
                          </Avatar>
                          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                            <Typography variant="subtitle2" noWrap>
                              {documentLabel[document.document_type] || document.file_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {(document.file_size / 1024 / 1024).toFixed(2)} MB
                            </Typography>
                          </Box>
                          {document.url && (
                            <Button
                              href={document.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              color="inherit"
                              size="small"
                              aria-label={`เปิด ${document.file_name}`}
                              sx={{ minWidth: 36, px: 1 }}
                            >
                              <RiExternalLinkLine />
                            </Button>
                          )}
                        </Stack>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="info">ยังไม่มีเอกสารยืนยันในระบบ</Alert>
              )}
            </SectionCard>

            <SectionCard
              title="ข้อตกลงและการยินยอม"
              description="สถานะข้อตกลงที่ยืนยันตอนส่งคำขอเปิดร้าน"
              icon={<RiShieldCheckLine />}
            >
              <Grid container spacing={1.5}>
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
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
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
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            variant="rounded"
            sx={{ width: 44, height: 44, color: 'primary.main', bgcolor: 'primary.lighter' }}
          >
            {icon}
          </Avatar>
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
        </Stack>
        {action}
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
        px: 2,
        py: 1.5,
        height: 1,
        borderRadius: 2,
        bgcolor: 'background.neutral',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ mt: 0.25, fontWeight: 600, wordBreak: 'break-word' }}>
        {value || '-'}
      </Typography>
    </Box>
  );
}

function ConsentItem({ label, acceptedAt }: { label: string; acceptedAt?: string | null }) {
  const accepted = Boolean(acceptedAt);
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        sx={{
          p: 1.75,
          height: 1,
          borderRadius: 2,
          border: '1px solid',
          borderColor: accepted ? 'success.light' : 'warning.light',
          bgcolor: accepted ? 'success.lighter' : 'warning.lighter',
        }}
      >
        {accepted ? (
          <RiCheckboxCircleLine size={22} color="#118D57" />
        ) : (
          <RiInformationLine size={22} color="#B76E00" />
        )}
        <Box>
          <Typography variant="subtitle2">{label}</Typography>
          <Typography variant="caption" color="text.secondary">
            {acceptedAt
              ? `ยอมรับเมื่อ ${new Date(acceptedAt).toLocaleDateString('th-TH', {
                  dateStyle: 'medium',
                })}`
              : 'ยังไม่ยอมรับ'}
          </Typography>
        </Box>
      </Stack>
    </Grid>
  );
}

function StatusChip({ status }: { status: MarketplaceSeller['status'] }) {
  const statusMap = {
    active: { label: 'เปิดใช้งาน', color: 'success' as const },
    pending: { label: 'รอตรวจสอบ', color: 'warning' as const },
    rejected: { label: 'ไม่ผ่านการตรวจสอบ', color: 'error' as const },
    suspended: { label: 'ระงับใช้งาน', color: 'error' as const },
    draft: { label: 'ฉบับร่าง', color: 'default' as const },
  };
  const item = statusMap[status];
  return <Chip size="small" color={item.color} variant="soft" label={item.label} />;
}
