'use client';

import type { MarketplaceSeller } from '../../shared/types';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import {
  RiEyeLine,
  RiCloseLine,
  RiStore2Line,
  RiArrowLeftLine,
  RiShieldCheckLine,
  RiExternalLinkLine,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { ThaiBankLogo } from '../../shared/bank-logo';
import {
  DocumentPreviewDialog,
  type DocumentPreviewFile,
} from '../../shared/document-preview-dialog';

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
  store_cover: 'ภาพปกร้าน',
  identity_card: 'บัตรประชาชน',
  bank_book: 'หน้าสมุดบัญชี',
  company_certificate: 'หนังสือรับรองบริษัท',
  vat_certificate: 'ภ.พ.20',
};

const agreementFields: Array<{
  key:
    | 'seller_agreement_accepted_at'
    | 'copyright_confirmed_at'
    | 'fee_agreement_accepted_at'
    | 'pdpa_accepted_at';
  label: string;
}> = [
  { key: 'seller_agreement_accepted_at', label: 'ข้อตกลงการเป็นผู้ขาย' },
  { key: 'copyright_confirmed_at', label: 'คำยืนยันสิทธิและลิขสิทธิ์' },
  { key: 'fee_agreement_accepted_at', label: 'ค่าธรรมเนียมและรอบการโอน' },
  { key: 'pdpa_accepted_at', label: 'การประมวลผลข้อมูลส่วนบุคคล (PDPA)' },
];

type Props = {
  sellerId: string;
  backHref?: string;
  backLabel?: string;
};

export function MarketplaceSellerApprovalDetailView({
  sellerId,
  backHref = paths.marketplace.sellerApprovals,
  backLabel = 'กลับไปคำขอเปิดร้าน',
}: Props) {
  const { user } = useAuthContext();
  const [seller, setSeller] = useState<MarketplaceSeller | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [commissionSaving, setCommissionSaving] = useState(false);
  const [defaultCommissionRate, setDefaultCommissionRate] = useState(10);
  const [commissionRate, setCommissionRate] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewFile, setPreviewFile] = useState<DocumentPreviewFile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/marketplace/admin/sellers/${sellerId}`, {
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'โหลดรายละเอียดร้านไม่สำเร็จ');
      setSeller(result.seller);
      setDefaultCommissionRate(Number(result.defaultCommissionRate) || 0);
      setCommissionRate(
        result.seller.commission_rate_override == null
          ? ''
          : String(result.seller.commission_rate_override)
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดรายละเอียดร้านไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    if (user?.role === 'master_admin' || user?.role === 'marketplace_admin') load();
  }, [load, user?.role]);

  const review = async (action: 'approve' | 'reject') => {
    if (!seller) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/marketplace/admin/sellers/${seller.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: action === 'reject' ? reason : undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'ตรวจสอบร้านค้าไม่สำเร็จ');
      setRejectOpen(false);
      setReason('');
      setSuccess(
        action === 'approve'
          ? seller?.is_profile_revision
            ? 'อนุมัติข้อมูลแก้ไขเรียบร้อยแล้ว'
            : 'อนุมัติเปิดร้านเรียบร้อยแล้ว'
          : 'บันทึกการไม่อนุมัติแล้ว'
      );
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'ตรวจสอบร้านค้าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const saveCommissionRate = async () => {
    if (!seller) return;
    const override = commissionRate === '' ? null : Number(commissionRate);
    if (override !== null && (!Number.isFinite(override) || override < 0 || override > 100)) {
      setError('ค่าธรรมเนียมร้านค้าต้องอยู่ระหว่าง 0–100%');
      return;
    }

    setCommissionSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/marketplace/admin/sellers/${seller.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionRateOverride: override }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'บันทึกค่าธรรมเนียมไม่สำเร็จ');
      setSeller((current) =>
        current
          ? { ...current, commission_rate_override: result.seller.commission_rate_override }
          : current
      );
      setCommissionRate(
        result.seller.commission_rate_override == null
          ? ''
          : String(result.seller.commission_rate_override)
      );
      setSuccess(
        override === null
          ? `ร้านนี้กลับมาใช้ค่าธรรมเนียม Default ${defaultCommissionRate}% แล้ว`
          : `กำหนดค่าธรรมเนียมร้านนี้เป็น ${override}% แล้ว`
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'บันทึกค่าธรรมเนียมไม่สำเร็จ');
    } finally {
      setCommissionSaving(false);
    }
  };

  if (user?.role !== 'master_admin' && user?.role !== 'marketplace_admin') {
    return (
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Alert severity="error">หน้านี้สำหรับ Super Admin เท่านั้น</Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: 500, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!seller) {
    return (
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Button
          component={RouterLink}
          href={backHref}
          color="inherit"
          startIcon={<RiArrowLeftLine />}
          sx={{ mb: 3 }}
        >
          {backLabel}
        </Button>
        <Alert severity="error">{error || 'ไม่พบคำขอเปิดร้าน'}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Button
        component={RouterLink}
        href={backHref}
        color="inherit"
        startIcon={<RiArrowLeftLine />}
        sx={{ mb: 3 }}
      >
        {backLabel}
      </Button>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {seller.is_profile_revision && (
        <Alert severity="info" sx={{ mb: 3 }}>
          รายการนี้เป็นข้อมูลแก้ไขของร้านที่เปิดขายอยู่ หน้าร้านยังแสดงข้อมูลเดิมที่อนุมัติแล้ว
          และจะเปลี่ยนเป็นข้อมูลชุดนี้เมื่ออนุมัติ
        </Alert>
      )}
      {!!success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}
      {!!seller.rejection_reason && (
        <Alert severity="error" sx={{ mb: 3 }}>
          เหตุผลที่ไม่อนุมัติ: {seller.rejection_reason}
        </Alert>
      )}

      <Card variant="outlined" sx={{ overflow: 'hidden', mb: 3 }}>
        {seller.cover_url && (
          <Box
            component="img"
            src={seller.cover_url}
            alt={`ภาพปกร้าน ${seller.display_name}`}
            sx={{ width: '100%', height: { xs: 150, md: 220 }, objectFit: 'cover' }}
          />
        )}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2.5}
          alignItems={{ md: 'center' }}
          sx={{ p: { xs: 2.5, md: 3.5 } }}
        >
          <Avatar
            src={seller.logo_url ?? undefined}
            variant="rounded"
            sx={{ width: 88, height: 88 }}
          >
            <RiStore2Line size={40} />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography component="h1" variant="h3">
                {seller.display_name}
              </Typography>
              <SellerStatusChip status={seller.status} />
              <Chip size="small" variant="soft" label={sellerTypeLabel[seller.seller_type]} />
            </Stack>
            {!!seller.display_name_en && (
              <Typography color="text.secondary">{seller.display_name_en}</Typography>
            )}
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {seller.bio || 'ไม่ได้ระบุคำอธิบายร้าน'}
            </Typography>
          </Box>
          {!!seller.slug && (
            <Button
              href={`/store/${seller.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              startIcon={<RiExternalLinkLine />}
            >
              ดูหน้าร้าน
            </Button>
          )}
        </Stack>
      </Card>

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(340px, 0.6fr)' },
        }}
      >
        <Stack spacing={3}>
          <DetailCard title="ข้อมูลผู้ขาย">
            <DetailGrid
              items={[
                ['ประเภทผู้ขาย', sellerTypeLabel[seller.seller_type]],
                ['ชื่อ-นามสกุล', seller.seller_name],
                ['เบอร์โทร', seller.phone],
                ['อีเมล', seller.contact_email],
                ['เลขบัตรประชาชน/ผู้เสียภาษี', seller.national_tax_id],
                ['ชื่อบริษัท', seller.company_name],
                ['เลขนิติบุคคล', seller.company_registration_no],
                ['เลขผู้เสียภาษีบริษัท', seller.company_tax_id],
              ]}
            />
          </DetailCard>

          <DetailCard title="ข้อมูลรับเงิน">
            {seller.payout_account ? (
              <>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                  <ThaiBankLogo
                    bankCode={seller.payout_account.bank_code}
                    bankName={seller.payout_account.bank_name}
                    size={42}
                  />
                  <Box>
                    <Typography variant="subtitle2">{seller.payout_account.bank_name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      รหัสธนาคาร {seller.payout_account.bank_code}
                    </Typography>
                  </Box>
                </Stack>
                <DetailGrid
                  items={[
                    ['เลขบัญชี', seller.payout_account.account_number],
                    ['ชื่อบัญชี', seller.payout_account.account_name],
                    ['PromptPay', seller.payout_account.promptpay_id],
                  ]}
                />
                <Alert severity="warning" sx={{ mt: 2 }}>
                  กรุณาตรวจว่าชื่อบัญชีตรงกับผู้ขายหรือเอกสารนิติบุคคลก่อนอนุมัติ
                </Alert>
              </>
            ) : (
              <Alert severity="error">ยังไม่มีข้อมูลบัญชีรับเงิน</Alert>
            )}
          </DetailCard>

          <DetailCard title="เอกสารยืนยัน">
            <Box
              sx={{
                gap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {seller.documents?.length ? (
                seller.documents.map((document) => (
                  <Box
                    key={document.id}
                    sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                  >
                    <Typography variant="subtitle2">
                      {documentLabel[document.document_type] || document.file_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {document.file_name} · {formatFileSize(document.file_size)}
                    </Typography>
                    {document.url ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RiEyeLine />}
                        onClick={() =>
                          setPreviewFile({
                            url: document.url!,
                            title: documentLabel[document.document_type] || document.file_name,
                            fileName: document.file_name,
                            mimeType: document.mime_type,
                          })
                        }
                        sx={{ mt: 1.5 }}
                      >
                        เปิดดูเอกสาร
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        disabled
                        startIcon={<RiEyeLine />}
                        sx={{ mt: 1.5 }}
                      >
                        เปิดดูเอกสาร
                      </Button>
                    )}
                  </Box>
                ))
              ) : (
                <Alert severity="error">ยังไม่มีเอกสารยืนยัน</Alert>
              )}
            </Box>
          </DetailCard>
        </Stack>

        <Stack spacing={3}>
          <DetailCard title="ค่าธรรมเนียมการขาย">
            <Stack spacing={2}>
              <Alert severity={seller.commission_rate_override == null ? 'info' : 'success'}>
                {seller.commission_rate_override == null
                  ? `ใช้ค่า Default ของ Marketplace ${defaultCommissionRate}%`
                  : `ร้านนี้ใช้ค่าธรรมเนียมเฉพาะ ${Number(
                      seller.commission_rate_override
                    )}% แทนค่า Default ${defaultCommissionRate}%`}
              </Alert>
              <TextField
                fullWidth
                type="number"
                label="ค่าธรรมเนียมเฉพาะร้าน (%)"
                value={commissionRate}
                onChange={(event) => setCommissionRate(event.target.value)}
                slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01 } }}
                helperText="เว้นว่างเพื่อใช้ค่าธรรมเนียม Default จากหน้าตั้งค่าการเงิน"
                error={
                  commissionRate !== '' &&
                  (!Number.isFinite(Number(commissionRate)) ||
                    Number(commissionRate) < 0 ||
                    Number(commissionRate) > 100)
                }
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button variant="contained" loading={commissionSaving} onClick={saveCommissionRate}>
                  บันทึกค่าธรรมเนียมร้าน
                </Button>
                <Button
                  color="inherit"
                  disabled={commissionSaving || commissionRate === ''}
                  onClick={() => setCommissionRate('')}
                >
                  ใช้ค่า Default
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                การเปลี่ยนแปลงมีผลกับคำสั่งซื้อใหม่เท่านั้น
                คำสั่งซื้อเดิมจะใช้เปอร์เซ็นต์ที่บันทึกไว้ตอนสั่งซื้อ
              </Typography>
            </Stack>
          </DetailCard>

          <DetailCard title="ข้อตกลงที่ยอมรับ">
            <Stack divider={<Divider flexItem />}>
              {agreementFields.map((agreement) => {
                const acceptedAt = seller[agreement.key];
                return (
                  <Stack
                    key={agreement.key}
                    direction="row"
                    spacing={1.5}
                    alignItems="flex-start"
                    sx={{ py: 1.5 }}
                  >
                    <RiCheckboxCircleLine
                      size={22}
                      color={
                        acceptedAt ? 'var(--palette-success-main)' : 'var(--palette-error-main)'
                      }
                    />
                    <Box>
                      <Typography variant="subtitle2">{agreement.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {acceptedAt
                          ? `ยอมรับเมื่อ ${new Date(acceptedAt).toLocaleString('th-TH', {
                              timeZone: 'Asia/Bangkok',
                            })}`
                          : 'ยังไม่ยอมรับ'}
                      </Typography>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          </DetailCard>

          <DetailCard title="ข้อมูลการส่งคำขอ">
            <DetailGrid
              items={[
                [
                  'วันที่ส่งคำขอ',
                  seller.submitted_at
                    ? new Date(seller.submitted_at).toLocaleString('th-TH', {
                        timeZone: 'Asia/Bangkok',
                      })
                    : null,
                ],
                [
                  'วันที่ตรวจสอบ',
                  seller.reviewed_at
                    ? new Date(seller.reviewed_at).toLocaleString('th-TH', {
                        timeZone: 'Asia/Bangkok',
                      })
                    : null,
                ],
                ['สถานะ', statusLabel(seller.status)],
              ]}
            />
          </DetailCard>

          {seller.status === 'pending' && (
            <Card variant="outlined" sx={{ p: 3, borderColor: 'primary.light' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <RiShieldCheckLine size={24} />
                <Typography variant="h6">ผลการตรวจสอบ</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2.5 }}>
                ตรวจข้อมูล เอกสาร ชื่อบัญชี และข้อตกลงให้ครบก่อนบันทึกผล
              </Typography>
              <Stack spacing={1.5}>
                <Button
                  variant="contained"
                  loading={saving}
                  startIcon={<RiCheckboxCircleLine />}
                  onClick={() => review('approve')}
                >
                  {seller.is_profile_revision ? 'อนุมัติข้อมูลแก้ไข' : 'อนุมัติเปิดร้าน'}
                </Button>
                <Button
                  color="error"
                  variant="outlined"
                  startIcon={<RiCloseLine />}
                  onClick={() => setRejectOpen(true)}
                >
                  {seller.is_profile_revision ? 'ไม่อนุมัติข้อมูลแก้ไข' : 'ไม่อนุมัติ'}
                </Button>
              </Stack>
            </Card>
          )}
        </Stack>
      </Box>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {seller.is_profile_revision ? 'ไม่อนุมัติข้อมูลแก้ไข' : 'ไม่อนุมัติร้าน'}{' '}
          {seller.display_name}
        </DialogTitle>
        <Divider />
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={4}
            label="เหตุผลที่ไม่อนุมัติ"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            helperText="ผู้ขายจะเห็นเหตุผลนี้และสามารถแก้ไขข้อมูลเพื่อส่งคำขอใหม่"
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setRejectOpen(false)}>
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={saving}
            disabled={reason.trim().length < 3}
            onClick={() => review('reject')}
          >
            ยืนยันไม่อนุมัติ
          </Button>
        </DialogActions>
      </Dialog>
      <DocumentPreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />
    </Container>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
      <Typography variant="h6">{title}</Typography>
      <Divider sx={{ my: 2 }} />
      {children}
    </Card>
  );
}

function DetailGrid({ items }: { items: Array<[string, string | null | undefined]> }) {
  return (
    <Box
      sx={{
        gap: 2,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
      }}
    >
      {items
        .filter(([, value]) => Boolean(value))
        .map(([label, value]) => (
          <Box key={label}>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="body2">{value}</Typography>
          </Box>
        ))}
    </Box>
  );
}

function SellerStatusChip({ status }: { status: MarketplaceSeller['status'] }) {
  if (status === 'active') return <Chip size="small" color="success" label="อนุมัติแล้ว" />;
  if (status === 'rejected') return <Chip size="small" color="error" label="ไม่อนุมัติ" />;
  return <Chip size="small" color="warning" label="รอตรวจสอบ" />;
}

function statusLabel(status: MarketplaceSeller['status']) {
  if (status === 'active') return 'อนุมัติแล้ว';
  if (status === 'rejected') return 'ไม่อนุมัติ';
  if (status === 'suspended') return 'ระงับการใช้งาน';
  if (status === 'draft') return 'แบบร่าง';
  return 'รอตรวจสอบ';
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
