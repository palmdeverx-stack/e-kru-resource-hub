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
};

export function MarketplaceSellerApprovalDetailView({ sellerId }: Props) {
  const { user } = useAuthContext();
  const [seller, setSeller] = useState<MarketplaceSeller | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดรายละเอียดร้านไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    if (user?.role === 'master_admin') load();
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
      setSuccess(action === 'approve' ? 'อนุมัติเปิดร้านเรียบร้อยแล้ว' : 'บันทึกการไม่อนุมัติแล้ว');
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'ตรวจสอบร้านค้าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'master_admin') {
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
          href={paths.marketplace.sellerApprovals}
          color="inherit"
          startIcon={<RiArrowLeftLine />}
          sx={{ mb: 3 }}
        >
          กลับไปคำขอเปิดร้าน
        </Button>
        <Alert severity="error">{error || 'ไม่พบคำขอเปิดร้าน'}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Button
        component={RouterLink}
        href={paths.marketplace.sellerApprovals}
        color="inherit"
        startIcon={<RiArrowLeftLine />}
        sx={{ mb: 3 }}
      >
        กลับไปคำขอเปิดร้าน
      </Button>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
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
                <DetailGrid
                  items={[
                    ['ธนาคาร', seller.payout_account.bank_name],
                    ['รหัสธนาคาร', seller.payout_account.bank_code],
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
                        href={document.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<RiEyeLine />}
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
                  อนุมัติเปิดร้าน
                </Button>
                <Button
                  color="error"
                  variant="outlined"
                  startIcon={<RiCloseLine />}
                  onClick={() => setRejectOpen(true)}
                >
                  ไม่อนุมัติ
                </Button>
              </Stack>
            </Card>
          )}
        </Stack>
      </Box>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>ไม่อนุมัติร้าน {seller.display_name}</DialogTitle>
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
