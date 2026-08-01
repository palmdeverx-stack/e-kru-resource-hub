'use client';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { fDateTime } from 'src/utils/format-time';

import { Upload } from 'src/components/upload';
import { Form } from 'src/components/hook-form';

import { useAuthContext } from 'src/auth/hooks';

const optionalUrl = z
  .string()
  .trim()
  .refine((value) => !value || /^https?:\/\//i.test(value), { error: 'กรุณาระบุ URL ให้ถูกต้อง' });
const optionalEmail = z
  .string()
  .trim()
  .refine((value) => !value || /^\S+@\S+\.\S+$/.test(value), { error: 'รูปแบบอีเมลไม่ถูกต้อง' });
const optionalHost = z
  .string()
  .trim()
  .max(253)
  .refine(
    (value) =>
      !value ||
      (!value.includes('://') && !/[\s/\\?#@]/.test(value) && /^[A-Za-z0-9._:[\]-]+$/.test(value)),
    { error: 'กรุณาระบุ Hostname หรือ IP โดยไม่ใส่ http:// หรือ https://' }
  );

const PlatformSettingsSchema = z
  .object({
    providerType: z.enum(['individual', 'company']),
    firstName: z.string().trim(),
    lastName: z.string().trim(),
    companyName: z.string().trim(),
    companyRegistrationNo: z
      .string()
      .regex(/^\d{0,13}$/, { error: 'กรุณาระบุตัวเลขไม่เกิน 13 หลัก' }),
    taxId: z.string().regex(/^$|^\d{13}$/, { error: 'เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก' }),
    address: z.string().trim().min(10, { error: 'กรุณากรอกที่อยู่ให้ครบถ้วน' }),
    contactEmail: z.email({ error: 'รูปแบบอีเมลติดต่อไม่ถูกต้อง' }),
    contactPhone: z.string().trim().max(16),
    platformNameTh: z.string().trim().min(2, { error: 'กรุณากรอกชื่อแพลตฟอร์ม' }),
    platformNameEn: z.string().trim(),
    brandName: z.string().trim().min(2, { error: 'กรุณากรอกชื่อแบรนด์' }),
    websiteUrl: optionalUrl,
    supportEmail: optionalEmail,
    supportPhone: z.string().trim(),
    financeEmail: optionalEmail,
    privacyEmail: optionalEmail,
    lineOaId: z.string().trim(),
    businessHours: z.string().trim(),
    complaintUrl: optionalUrl,
    vatRegistered: z.boolean(),
    vatRate: z.number().min(0).max(100),
    officeType: z.enum(['head_office', 'branch']),
    branchNumber: z.string().trim(),
    documentIssuerName: z.string().trim(),
    documentTaxAddress: z.string().trim(),
    authorizedSignatoryName: z.string().trim(),
    signatureUrl: optionalUrl,
    sealUrl: optionalUrl,
    receiptPrefix: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{0,12}$/),
    taxInvoicePrefix: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{0,12}$/),
    logoUrl: optionalUrl,
    transparentLogoUrl: optionalUrl,
    faviconUrl: optionalUrl,
    ogImageUrl: optionalUrl,
    officialProductThumbnailUrl: optionalUrl,
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, { error: 'สีต้องอยู่ในรูปแบบ #1565C0' }),
    footerText: z.string().trim().max(500),
    copyrightText: z.string().trim().max(250),
    timezone: z.string().trim().min(3),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/),
    defaultLanguage: z.enum(['th', 'en']),
    serviceCountry: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/),
    productionUrl: optionalUrl,
    clamavHost: optionalHost,
    clamavPort: z.number().int().min(1).max(65535),
    updatedAt: z.string().nullable(),
  })
  .superRefine((value, context) => {
    if (value.providerType === 'individual') {
      if (value.firstName.length < 2)
        context.addIssue({ code: 'custom', path: ['firstName'], message: 'กรุณากรอกชื่อ' });
      if (value.lastName.length < 2)
        context.addIssue({ code: 'custom', path: ['lastName'], message: 'กรุณากรอกนามสกุล' });
    } else {
      if (value.companyName.length < 2)
        context.addIssue({ code: 'custom', path: ['companyName'], message: 'กรุณากรอกชื่อบริษัท' });
      if (value.companyRegistrationNo.length !== 13)
        context.addIssue({
          code: 'custom',
          path: ['companyRegistrationNo'],
          message: 'เลขทะเบียนนิติบุคคลต้องมี 13 หลัก',
        });
      if (value.taxId.length !== 13)
        context.addIssue({ code: 'custom', path: ['taxId'], message: 'เลขภาษีต้องมี 13 หลัก' });
    }
    if (value.officeType === 'branch' && !value.branchNumber) {
      context.addIssue({ code: 'custom', path: ['branchNumber'], message: 'กรุณาระบุเลขที่สาขา' });
    }
  });

type ProviderForm = z.infer<typeof PlatformSettingsSchema>;

const initialForm: ProviderForm = {
  providerType: 'individual',
  firstName: '',
  lastName: '',
  companyName: '',
  companyRegistrationNo: '',
  taxId: '',
  address: '',
  contactEmail: '',
  contactPhone: '',
  platformNameTh: '',
  platformNameEn: '',
  brandName: '',
  websiteUrl: '',
  supportEmail: '',
  supportPhone: '',
  financeEmail: '',
  privacyEmail: '',
  lineOaId: '',
  businessHours: '',
  complaintUrl: '',
  vatRegistered: false,
  vatRate: 7,
  officeType: 'head_office',
  branchNumber: '',
  documentIssuerName: '',
  documentTaxAddress: '',
  authorizedSignatoryName: '',
  signatureUrl: '',
  sealUrl: '',
  receiptPrefix: 'RC',
  taxInvoicePrefix: 'TAX',
  logoUrl: '',
  transparentLogoUrl: '',
  faviconUrl: '',
  ogImageUrl: '',
  officialProductThumbnailUrl: '',
  primaryColor: '#1565C0',
  footerText: '',
  copyrightText: '',
  timezone: 'Asia/Bangkok',
  currency: 'THB',
  defaultLanguage: 'th',
  serviceCountry: 'TH',
  productionUrl: '',
  clamavHost: '',
  clamavPort: 3310,
  updatedAt: null,
};

async function parseResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'ไม่สามารถดำเนินการได้');
  return result;
}

type AssetType =
  | 'logo'
  | 'transparent-logo'
  | 'favicon'
  | 'og-image'
  | 'official-product-thumbnail'
  | 'signature'
  | 'seal';

function AssetUploadField({
  label,
  assetType,
  value,
  onChange,
}: {
  label: string;
  assetType: AssetType;
  value: string;
  onChange: (url: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const maxSize = assetType === 'favicon' ? 1024 * 1024 : 5 * 1024 * 1024;

  const upload = async (files: File[]) => {
    const selected = files[0];
    if (!selected) return;
    setFile(selected);
    setUploading(true);
    setUploadError('');
    try {
      const payload = new FormData();
      payload.append('file', selected);
      payload.append('assetType', assetType);
      const result = await parseResponse(
        await fetch('/api/marketplace/admin/provider-settings/assets', {
          method: 'POST',
          body: payload,
        })
      );
      onChange(result.url);
      setFile(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'อัปโหลดไฟล์ไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Upload
        value={file ?? value ?? null}
        accept={{
          'image/jpeg': ['.jpg', '.jpeg'],
          'image/png': ['.png'],
          'image/webp': ['.webp'],
        }}
        maxSize={maxSize}
        loading={uploading}
        disabled={uploading}
        onDrop={upload}
        onDelete={() => {
          setFile(null);
          onChange('');
        }}
        helperText={
          uploadError ||
          `ลากไฟล์มาวาง หรือกดเลือกไฟล์ · JPG, PNG, WEBP ไม่เกิน ${assetType === 'favicon' ? '1' : '5'} MB`
        }
        error={Boolean(uploadError)}
        slotProps={{
          singlePreview: {
            sx: { '& img': { objectFit: 'contain' } },
          },
        }}
        sx={{ height: 150 }}
      />
    </Box>
  );
}

export function MarketplacePlatformSettingsView() {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [clamavTest, setClamavTest] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const methods = useForm<ProviderForm>({
    resolver: zodResolver(PlatformSettingsSchema),
    defaultValues: initialForm,
    mode: 'onBlur',
  });
  const {
    reset,
    watch,
    setValue,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = methods;
  const form = watch();
  const setForm = (updater: ProviderForm | ((current: ProviderForm) => ProviderForm)) => {
    const current = getValues();
    const next = typeof updater === 'function' ? updater(current) : updater;
    (Object.keys(next) as Array<keyof ProviderForm>).forEach((key) => {
      if (next[key] !== current[key]) {
        setValue(key, next[key], { shouldDirty: true, shouldValidate: true });
      }
    });
  };

  useEffect(() => {
    if (user?.role !== 'master_admin' && user?.role !== 'marketplace_admin') return;
    fetch('/api/marketplace/admin/provider-settings', { cache: 'no-store' })
      .then(parseResponse)
      .then((result) => reset(result.settings))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลแพลตฟอร์มไม่สำเร็จ')
      )
      .finally(() => setLoading(false));
  }, [reset, user?.role]);

  const save = async (values: ProviderForm) => {
    setError('');
    setMessage('');
    try {
      await parseResponse(
        await fetch('/api/marketplace/admin/provider-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        })
      );
      const result = await parseResponse(
        await fetch('/api/marketplace/admin/provider-settings', { cache: 'no-store' })
      );
      reset(result.settings);
      setMessage('บันทึกข้อมูลแพลตฟอร์มและปรับเอกสารทุกฉบับแล้ว');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'บันทึกข้อมูลแพลตฟอร์มไม่สำเร็จ');
    }
  };

  const testClamAv = async () => {
    const { clamavHost, clamavPort } = getValues();
    setClamavTest({ status: 'testing', message: '' });
    try {
      const result = await parseResponse(
        await fetch('/api/marketplace/admin/provider-settings/clamav-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host: clamavHost, port: clamavPort }),
        })
      );
      setClamavTest({
        status: 'success',
        message: `เชื่อมต่อ ClamAV สำเร็จ (${result.response})`,
      });
    } catch (testError) {
      setClamavTest({
        status: 'error',
        message: testError instanceof Error ? testError.message : 'ทดสอบ ClamAV ไม่สำเร็จ',
      });
    }
  };

  if (user?.role !== 'master_admin' && user?.role !== 'marketplace_admin') {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">เมนูนี้สำหรับ Super Admin เท่านั้น</Alert>
      </Box>
    );
  }

  const displayName =
    form.providerType === 'company'
      ? form.companyName
      : `${form.firstName} ${form.lastName}`.trim();
  const validationMessage = Object.values(errors)[0]?.message;

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            ข้อมูลแพลตฟอร์ม
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            ข้อมูลเจ้าของและผู้ให้บริการที่ระบบเรียกใช้ร่วมกันจากจุดเดียว
          </Typography>
        </Box>
        <Chip
          variant="soft"
          color={displayName ? 'success' : 'warning'}
          label={displayName ? 'มีข้อมูลแล้ว' : 'ยังกรอกไม่ครบ'}
        />
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {!!message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}
      {!!validationMessage && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {String(validationMessage)}
        </Alert>
      )}

      <Alert severity="error" sx={{ mb: 3 }}>
        เพิ่ม ClamAV ตรวจสอบไฟล์
      </Alert>

      <Form methods={methods} onSubmit={handleSubmit(save)}>
        <Card sx={{ p: { xs: 2.5, md: 4 } }}>
          {loading ? (
            <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={2.5}>
              <Typography variant="h5">ข้อมูลพื้นฐานและแบรนด์</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  required
                  fullWidth
                  label="ชื่อแพลตฟอร์ม (ไทย)"
                  value={form.platformNameTh}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, platformNameTh: event.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  label="ชื่อแพลตฟอร์ม (อังกฤษ)"
                  value={form.platformNameEn}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, platformNameEn: event.target.value }))
                  }
                />
                <TextField
                  required
                  fullWidth
                  label="ชื่อแบรนด์"
                  value={form.brandName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, brandName: event.target.value }))
                  }
                />
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="เว็บไซต์หลัก"
                  placeholder="https://example.com"
                  value={form.websiteUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, websiteUrl: event.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  label="Production URL"
                  placeholder="https://example.com"
                  value={form.productionUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, productionUrl: event.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  label="สีหลัก"
                  placeholder="#1565C0"
                  value={form.primaryColor}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, primaryColor: event.target.value }))
                  }
                />
              </Stack>

              <Divider />
              <Typography variant="h5">เจ้าของและผู้ให้บริการตามกฎหมาย</Typography>
              <TextField
                select
                fullWidth
                label="ประเภทผู้ให้บริการ"
                value={form.providerType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    providerType: event.target.value as ProviderForm['providerType'],
                  }))
                }
              >
                <MenuItem value="individual">บุคคลธรรมดา</MenuItem>
                <MenuItem value="company">นิติบุคคล / บริษัท</MenuItem>
              </TextField>

              {form.providerType === 'individual' ? (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    required
                    fullWidth
                    label="ชื่อ"
                    value={form.firstName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, firstName: event.target.value }))
                    }
                  />
                  <TextField
                    required
                    fullWidth
                    label="นามสกุล"
                    value={form.lastName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, lastName: event.target.value }))
                    }
                  />
                </Stack>
              ) : (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    required
                    fullWidth
                    label="ชื่อนิติบุคคล / บริษัท"
                    value={form.companyName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, companyName: event.target.value }))
                    }
                  />
                  <TextField
                    required
                    fullWidth
                    label="เลขทะเบียนนิติบุคคล"
                    value={form.companyRegistrationNo}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        companyRegistrationNo: event.target.value.replace(/\D/g, ''),
                      }))
                    }
                    slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 13 } }}
                  />
                </Stack>
              )}

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  required={form.providerType === 'company'}
                  label="เลขประจำตัวผู้เสียภาษี"
                  value={form.taxId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      taxId: event.target.value.replace(/\D/g, ''),
                    }))
                  }
                  helperText={
                    form.providerType === 'individual'
                      ? 'ไม่บังคับสำหรับบุคคลธรรมดา'
                      : 'เลข 13 หลักของนิติบุคคล'
                  }
                  slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 13 } }}
                />
                <TextField
                  required
                  fullWidth
                  type="email"
                  label="อีเมลติดต่อ"
                  value={form.contactEmail}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, contactEmail: event.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  label="เบอร์โทรศัพท์"
                  value={form.contactPhone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, contactPhone: event.target.value }))
                  }
                  slotProps={{ htmlInput: { inputMode: 'tel', maxLength: 16 } }}
                />
              </Stack>
              <TextField
                required
                fullWidth
                multiline
                minRows={3}
                label="ที่อยู่สำหรับติดต่อ"
                value={form.address}
                onChange={(event) =>
                  setForm((current) => ({ ...current, address: event.target.value }))
                }
              />

              <Divider />
              <Typography variant="h5">ภาษีและการออกเอกสาร</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                <FormControlLabel
                  sx={{ minWidth: 210 }}
                  control={
                    <Switch
                      checked={form.vatRegistered}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, vatRegistered: event.target.checked }))
                      }
                    />
                  }
                  label="จดทะเบียน VAT"
                />
                <TextField
                  fullWidth
                  type="number"
                  label="อัตรา VAT (%)"
                  disabled={!form.vatRegistered}
                  value={form.vatRate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, vatRate: Number(event.target.value) }))
                  }
                  slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01 } }}
                />
                <TextField
                  select
                  fullWidth
                  label="ประเภทสำนักงาน"
                  value={form.officeType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      officeType: event.target.value as ProviderForm['officeType'],
                    }))
                  }
                >
                  <MenuItem value="head_office">สำนักงานใหญ่</MenuItem>
                  <MenuItem value="branch">สาขา</MenuItem>
                </TextField>
                {form.officeType === 'branch' && (
                  <TextField
                    required
                    fullWidth
                    label="เลขที่สาขา"
                    value={form.branchNumber}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        branchNumber: event.target.value.replace(/\D/g, ''),
                      }))
                    }
                  />
                )}
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="ชื่อผู้ออกเอกสาร"
                  value={form.documentIssuerName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, documentIssuerName: event.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  label="ผู้มีอำนาจลงนาม"
                  value={form.authorizedSignatoryName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      authorizedSignatoryName: event.target.value,
                    }))
                  }
                />
              </Stack>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="ที่อยู่สำหรับออกเอกสารภาษี"
                value={form.documentTaxAddress}
                onChange={(event) =>
                  setForm((current) => ({ ...current, documentTaxAddress: event.target.value }))
                }
              />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="คำนำหน้าเลขใบเสร็จ"
                  value={form.receiptPrefix}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, receiptPrefix: event.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  label="คำนำหน้าเลขใบกำกับภาษี"
                  value={form.taxInvoicePrefix}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, taxInvoicePrefix: event.target.value }))
                  }
                />
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <AssetUploadField
                  label="ลายเซ็นผู้มีอำนาจ"
                  assetType="signature"
                  value={form.signatureUrl}
                  onChange={(url) => setValue('signatureUrl', url, { shouldDirty: true })}
                />
                <AssetUploadField
                  label="ตราประทับ"
                  assetType="seal"
                  value={form.sealUrl}
                  onChange={(url) => setValue('sealUrl', url, { shouldDirty: true })}
                />
              </Stack>

              <Divider />
              <Typography variant="h5">ช่องทางติดต่อ</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  type="email"
                  label="อีเมล Support"
                  value={form.supportEmail}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, supportEmail: event.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  label="เบอร์ Support"
                  value={form.supportPhone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, supportPhone: event.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  label="LINE Official Account"
                  placeholder="@example"
                  value={form.lineOaId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, lineOaId: event.target.value }))
                  }
                />
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  type="email"
                  label="อีเมลฝ่ายการเงิน"
                  value={form.financeEmail}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, financeEmail: event.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  type="email"
                  label="อีเมล PDPA"
                  value={form.privacyEmail}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, privacyEmail: event.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  label="เวลาทำการ"
                  placeholder="จันทร์–ศุกร์ 09:00–17:00 น."
                  value={form.businessHours}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, businessHours: event.target.value }))
                  }
                />
              </Stack>
              <TextField
                fullWidth
                label="URL แจ้งปัญหา/ร้องเรียน"
                value={form.complaintUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, complaintUrl: event.target.value }))
                }
              />

              <Divider />
              <Typography variant="h5">ไฟล์แบรนด์และการแชร์</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <AssetUploadField
                  label="โลโก้หลัก"
                  assetType="logo"
                  value={form.logoUrl}
                  onChange={(url) => setValue('logoUrl', url, { shouldDirty: true })}
                />
                <AssetUploadField
                  label="โลโก้พื้นหลังโปร่งใส"
                  assetType="transparent-logo"
                  value={form.transparentLogoUrl}
                  onChange={(url) => setValue('transparentLogoUrl', url, { shouldDirty: true })}
                />
                <AssetUploadField
                  label="Favicon"
                  assetType="favicon"
                  value={form.faviconUrl}
                  onChange={(url) => setValue('faviconUrl', url, { shouldDirty: true })}
                />
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <AssetUploadField
                  label="รูป OG สำหรับแชร์"
                  assetType="og-image"
                  value={form.ogImageUrl}
                  onChange={(url) => setValue('ogImageUrl', url, { shouldDirty: true })}
                />
                <AssetUploadField
                  label="ภาพ Thumbnail สินค้าร้านค้าทางการ"
                  assetType="official-product-thumbnail"
                  value={form.officialProductThumbnailUrl}
                  onChange={(url) =>
                    setValue('officialProductThumbnailUrl', url, { shouldDirty: true })
                  }
                />
              </Stack>

              <TextField
                fullWidth
                multiline
                minRows={2}
                label="ข้อความ Footer"
                value={form.footerText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, footerText: event.target.value }))
                }
              />
              <TextField
                fullWidth
                label="ข้อความ Copyright"
                value={form.copyrightText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, copyrightText: event.target.value }))
                }
              />

              <Divider />
              <Typography variant="h5">ค่าระบบ</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="เขตเวลา"
                  value={form.timezone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, timezone: event.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  label="สกุลเงิน"
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, currency: event.target.value }))
                  }
                />
                <TextField
                  select
                  fullWidth
                  label="ภาษาหลัก"
                  value={form.defaultLanguage}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      defaultLanguage: event.target.value as ProviderForm['defaultLanguage'],
                    }))
                  }
                >
                  <MenuItem value="th">ไทย</MenuItem>
                  <MenuItem value="en">English</MenuItem>
                </TextField>
                <TextField
                  fullWidth
                  label="ประเทศที่ให้บริการ"
                  value={form.serviceCountry}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, serviceCountry: event.target.value }))
                  }
                />
              </Stack>

              <Divider />
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ sm: 'center' }}
                spacing={1}
              >
                <Box>
                  <Typography variant="h5">ตรวจสอบไฟล์ด้วย ClamAV</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    หากยังไม่ตั้งค่า ไฟล์จะถูกอัปโหลดด้วยสถานะ pending_scan
                    เพื่อให้แอดมินตรวจภายหลัง
                  </Typography>
                </Box>
                <Chip
                  variant="soft"
                  color={form.clamavHost ? 'success' : 'warning'}
                  label={form.clamavHost ? 'ตั้งค่าแล้ว' : 'ยังไม่ได้ตั้งค่า'}
                />
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
                <TextField
                  fullWidth
                  label="CLAMAV_HOST"
                  placeholder="clamav.example.com"
                  value={form.clamavHost}
                  error={Boolean(errors.clamavHost)}
                  helperText={
                    errors.clamavHost?.message ?? 'ใส่เฉพาะ Hostname หรือ IP ไม่ต้องใส่ Protocol'
                  }
                  onChange={(event) => {
                    setForm((current) => ({ ...current, clamavHost: event.target.value }));
                    setClamavTest({ status: 'idle', message: '' });
                  }}
                />
                <TextField
                  label="CLAMAV_PORT"
                  type="number"
                  value={form.clamavPort}
                  error={Boolean(errors.clamavPort)}
                  helperText={errors.clamavPort?.message ?? 'ค่าปกติคือ 3310'}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, clamavPort: Number(event.target.value) }));
                    setClamavTest({ status: 'idle', message: '' });
                  }}
                  slotProps={{ htmlInput: { min: 1, max: 65535 } }}
                  sx={{ width: { xs: 1, md: 220 }, flexShrink: 0 }}
                />
                <Button
                  type="button"
                  variant="outlined"
                  size="large"
                  loading={clamavTest.status === 'testing'}
                  disabled={!form.clamavHost || Boolean(errors.clamavHost || errors.clamavPort)}
                  onClick={testClamAv}
                  sx={{ minWidth: 180, minHeight: 56, flexShrink: 0 }}
                >
                  ทดสอบการเชื่อมต่อ
                </Button>
              </Stack>
              {clamavTest.status === 'success' && (
                <Alert severity="success">{clamavTest.message}</Alert>
              )}
              {clamavTest.status === 'error' && (
                <Alert severity="error">{clamavTest.message}</Alert>
              )}

              {!!form.updatedAt && (
                <Typography variant="caption" color="text.secondary">
                  แก้ไขล่าสุด {fDateTime(form.updatedAt)}
                </Typography>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" size="large" type="submit" loading={isSubmitting}>
                  บันทึกข้อมูลแพลตฟอร์ม
                </Button>
              </Box>
            </Stack>
          )}
        </Card>
      </Form>
    </Container>
  );
}
