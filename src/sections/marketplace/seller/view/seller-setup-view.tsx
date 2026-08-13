'use client';

import type { TextFieldProps } from '@mui/material/TextField';
import type { Control, FieldPath, UseFormReturn } from 'react-hook-form';
import type { MarketplaceSeller } from '../../shared/types';
import type { LegalDocumentType, MarketplaceLegalDocument } from '../../legal/types';

import * as z from 'zod';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch, Controller, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Accordion from '@mui/material/Accordion';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import CircularProgress from '@mui/material/CircularProgress';

import { RouterLink } from 'src/routes/components';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { toast } from 'src/components/snackbar';
import { Field } from 'src/components/hook-form';
import {
  RiEyeLine,
  RiBankLine,
  RiImageLine,
  RiUser3Line,
  RiEyeOffLine,
  RiStore2Line,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiFileShield2Line,
  RiShieldCheckLine,
  RiLockPasswordLine,
  RiUploadCloud2Line,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { getSeller, saveSeller } from '../../shared/api';
import { AgreementReadDialog } from './agreement-read-dialog';
import { ThaiBankAutocomplete } from '../../shared/bank-autocomplete';
import { DocumentPreviewDialog } from '../../shared/document-preview-dialog';

const STEPS = [
  {
    title: 'ข้อมูลร้านค้า',
    description: 'ชื่อร้าน โลโก้ และหน้าปก',
    icon: RiStore2Line,
  },
  {
    title: 'ข้อมูลผู้ขาย',
    description: 'ข้อมูลติดต่อและยืนยันตัวตน',
    icon: RiUser3Line,
  },
  {
    title: 'บัญชีรับเงิน',
    description: 'ธนาคารและ PromptPay',
    icon: RiBankLine,
  },
  {
    title: 'เอกสารยืนยัน',
    description: 'เอกสารสำหรับตรวจสอบร้าน',
    icon: RiFileShield2Line,
  },
  {
    title: 'ข้อตกลง',
    description: 'อ่านและยอมรับเงื่อนไข',
    icon: RiShieldCheckLine,
  },
] as const;
const SELLER_TYPE_VALUES = [
  'individual',
  'teacher',
  'school',
  'company',
  'publisher',
  'university',
] as const;

const SELLER_TYPE_OPTIONS: { value: (typeof SELLER_TYPE_VALUES)[number]; label: string }[] = [
  { value: 'individual', label: 'บุคคลทั่วไป' },
  { value: 'teacher', label: 'ครู' },
  { value: 'school', label: 'โรงเรียน' },
  { value: 'company', label: 'บริษัท' },
  { value: 'publisher', label: 'สำนักพิมพ์' },
  { value: 'university', label: 'มหาวิทยาลัย' },
];

export type AgreementKey =
  | 'sellerAgreement'
  | 'copyrightConfirmed'
  | 'feeAgreement'
  | 'pdpaAccepted';

export type Agreement = {
  key: AgreementKey;
  documentType: LegalDocumentType;
};

const SELLER_AGREEMENT_KEYS = {
  seller_agreement: 'sellerAgreement',
  copyright_takedown: 'copyrightConfirmed',
  payment_payout_policy: 'feeAgreement',
  privacy_policy: 'pdpaAccepted',
} as const satisfies Partial<Record<LegalDocumentType, AgreementKey>>;

const AGREEMENT_CHECKBOX_LABELS: Record<AgreementKey, string> = {
  sellerAgreement: 'ยอมรับข้อตกลงการเป็นผู้ขาย',
  copyrightConfirmed: 'ยืนยันว่าเป็นเจ้าของลิขสิทธิ์หรือมีสิทธินำมาจำหน่าย',
  feeAgreement: 'ยอมรับการหักค่าธรรมเนียมและรอบการโอนเงิน',
  pdpaAccepted: 'รับทราบและยอมรับการประมวลผลข้อมูลส่วนบุคคล (PDPA)',
};

const initialAgreementRead: Record<AgreementKey, boolean> = {
  sellerAgreement: false,
  copyrightConfirmed: false,
  feeAgreement: false,
  pdpaAccepted: false,
};

const SellerSetupSchema = z
  .object({
    displayName: z.string().trim().min(2, { error: 'กรุณากรอกชื่อร้านอย่างน้อย 2 ตัวอักษร' }),
    displayNameEn: z.string().trim(),
    slug: z.string().trim().min(3, { error: 'Slug ต้องมีอย่างน้อย 3 ตัวอักษร' }),
    bio: z.string().trim(),
    sellerType: z.enum(SELLER_TYPE_VALUES, { error: 'กรุณาเลือกประเภทผู้ขาย' }),
    sellerName: z.string().trim().min(3, { error: 'กรุณากรอกชื่อ-นามสกุล' }),
    phone: z
      .string()
      .trim()
      .refine((value) => value.replace(/\D/g, '').length >= 9, {
        error: 'กรุณากรอกเบอร์โทรให้ถูกต้อง',
      }),
    contactEmail: z.email({ error: 'กรุณากรอกอีเมลให้ถูกต้อง' }),
    nationalTaxId: z.string().trim(),
    companyName: z.string().trim(),
    companyRegistrationNo: z.string().trim(),
    companyTaxId: z.string().trim(),
    businessAddress: z.string().trim(),
    bankCode: z.string().trim(),
    bankName: z.string().trim().min(1, { error: 'กรุณาเลือกธนาคาร' }),
    accountNumber: z
      .string()
      .trim()
      .refine((value) => value.replace(/\D/g, '').length >= 6, {
        error: 'กรุณากรอกเลขบัญชีให้ถูกต้อง',
      }),
    accountName: z.string().trim().min(1, { error: 'กรุณากรอกชื่อบัญชี' }),
    promptpayId: z.string().trim(),
    sellerAgreement: z
      .boolean()
      .refine((value) => value, { error: 'กรุณายอมรับข้อตกลงการเป็นผู้ขาย' }),
    copyrightConfirmed: z
      .boolean()
      .refine((value) => value, { error: 'กรุณายืนยันความเป็นเจ้าของลิขสิทธิ์' }),
    feeAgreement: z.boolean().refine((value) => value, { error: 'กรุณายอมรับการหักค่าธรรมเนียม' }),
    pdpaAccepted: z.boolean().refine((value) => value, { error: 'กรุณายอมรับนโยบาย PDPA' }),
  })
  .superRefine((values, context) => {
    if (values.sellerType !== 'company') return;
    if (values.companyName.trim().length < 2) {
      context.addIssue({ code: 'custom', path: ['companyName'], message: 'กรุณากรอกชื่อบริษัท' });
    }
    if (values.companyRegistrationNo.replace(/\D/g, '').length < 10) {
      context.addIssue({
        code: 'custom',
        path: ['companyRegistrationNo'],
        message: 'กรุณากรอกเลขนิติบุคคลให้ครบ 10 หลัก',
      });
    }
  });

type SellerSetupSchemaType = z.infer<typeof SellerSetupSchema>;

const initialForm: SellerSetupSchemaType = {
  displayName: '',
  displayNameEn: '',
  slug: '',
  bio: '',
  sellerType: 'individual',
  sellerName: '',
  phone: '',
  contactEmail: '',
  nationalTaxId: '',
  companyName: '',
  companyRegistrationNo: '',
  companyTaxId: '',
  businessAddress: '',
  bankCode: '',
  bankName: '',
  accountNumber: '',
  accountName: '',
  promptpayId: '',
  sellerAgreement: false,
  copyrightConfirmed: false,
  feeAgreement: false,
  pdpaAccepted: false,
};

// Fields validated (via trigger) before advancing from each wizard step;
// step 3 (documents) and the agreement checkboxes are validated separately.
const STEP_FIELDS: FieldPath<SellerSetupSchemaType>[][] = [
  ['displayName', 'slug'],
  ['sellerName', 'phone', 'contactEmail', 'companyName', 'companyRegistrationNo'],
  ['bankName', 'accountName', 'accountNumber'],
  [],
  ['sellerAgreement', 'copyrightConfirmed', 'feeAgreement', 'pdpaAccepted'],
];

const requiredDocument = (message: string) =>
  z
    .union([z.instanceof(File), z.string()])
    .nullable()
    .refine((value): value is File | string => value !== null && value !== '', { error: message });
const optionalDocument = z.union([z.instanceof(File), z.string()]).nullable();

const SellerDocumentsSchema = z.object({
  storeLogo: requiredDocument('กรุณาอัปโหลดโลโก้ร้าน'),
  storeCover: optionalDocument,
  bankBook: requiredDocument('กรุณาอัปโหลดหน้าสมุดบัญชี'),
  identityCard: requiredDocument('กรุณาอัปโหลดบัตรประชาชน'),
  companyCertificate: optionalDocument,
  vatCertificate: optionalDocument,
  receiptSignature: optionalDocument,
});

type SellerDocumentsSchemaType = z.infer<typeof SellerDocumentsSchema>;

const initialDocuments: SellerDocumentsSchemaType = {
  storeLogo: null,
  storeCover: null,
  bankBook: null,
  identityCard: null,
  companyCertificate: null,
  vatCertificate: null,
  receiptSignature: null,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9ก-๙]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isGoogleAvatarUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname;
    return ['googleusercontent.com', 'ggpht.com'].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function DigitsField({
  name,
  control,
  onChange,
  helperText,
  ...textFieldProps
}: Omit<TextFieldProps, 'name' | 'value' | 'onChange'> & {
  name: FieldPath<SellerSetupSchemaType>;
  control: Control<SellerSetupSchemaType>;
  onChange?: (value: string) => void;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <TextField
          {...field}
          fullWidth
          error={!!error}
          helperText={error?.message ?? helperText}
          onChange={(event) => {
            const digitsOnly = event.target.value.replace(/\D/g, '');
            field.onChange(digitsOnly);
            onChange?.(digitsOnly);
          }}
          {...textFieldProps}
        />
      )}
    />
  );
}

export function MarketplaceSellerSetupView({ mode = 'setup' }: { mode?: 'setup' | 'edit' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthContext();
  const isSystemStore = user?.role === 'master_admin' || user?.role === 'marketplace_admin';
  const [seller, setSeller] = useState<MarketplaceSeller | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');
  const [showPhone, setShowPhone] = useState(false);
  const [showNationalTaxId, setShowNationalTaxId] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showPromptPayId, setShowPromptPayId] = useState(false);
  const [openAgreement, setOpenAgreement] = useState<Agreement | null>(null);
  const [agreementRead, setAgreementRead] = useState(initialAgreementRead);
  const [legalDocuments, setLegalDocuments] = useState<MarketplaceLegalDocument[]>([]);
  const [showStepErrors, setShowStepErrors] = useState(false);
  const methods = useForm<SellerSetupSchemaType>({
    resolver: zodResolver(SellerSetupSchema),
    defaultValues: initialForm,
  });
  const { control, reset, trigger, setValue, getValues, handleSubmit } = methods;
  const form = useWatch({ control }) as SellerSetupSchemaType;
  const documentsMethods = useForm<SellerDocumentsSchemaType>({
    resolver: zodResolver(SellerDocumentsSchema),
    defaultValues: initialDocuments,
  });
  const { reset: resetDocuments } = documentsMethods;
  const agreements = legalDocuments.flatMap<Agreement>((document) => {
    const key = SELLER_AGREEMENT_KEYS[document.document_type as keyof typeof SELLER_AGREEMENT_KEYS];
    return key ? [{ key, documentType: document.document_type }] : [];
  });
  const missingAgreementTypes = Object.keys(SELLER_AGREEMENT_KEYS).filter(
    (documentType) => !legalDocuments.some((document) => document.document_type === documentType)
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/marketplace/legal-documents', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? 'โหลดเอกสารข้อตกลงไม่สำเร็จ');
        setLegalDocuments(result.items ?? []);
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'โหลดเอกสารข้อตกลงไม่สำเร็จ');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    getSeller({ edit: mode === 'edit' })
      .then(({ seller: current }) => {
        setSeller(current);
        if (!current) {
          reset({
            ...initialForm,
            sellerType: user?.role === 'teacher' ? 'teacher' : 'individual',
          });
          resetDocuments(initialDocuments);
          return;
        }
        const requestedStep = Number(searchParams.get('step'));
        setActiveStep(
          Number.isInteger(requestedStep) && requestedStep >= 1 && requestedStep <= 5
            ? requestedStep - 1
            : Math.max(0, Math.min(4, (current.wizard_step ?? 1) - 1))
        );
        reset({
          displayName: current.display_name ?? '',
          displayNameEn: current.display_name_en ?? '',
          slug: current.slug ?? '',
          bio: current.bio ?? '',
          sellerType: current.seller_type,
          sellerName: current.seller_name ?? '',
          phone: current.phone ?? '',
          contactEmail: current.contact_email ?? user?.email ?? '',
          nationalTaxId: current.national_tax_id ?? '',
          companyName: current.company_name ?? '',
          companyRegistrationNo: current.company_registration_no ?? '',
          companyTaxId: current.company_tax_id ?? '',
          businessAddress: current.business_address ?? '',
          bankCode: current.payout_account?.bank_code ?? '',
          bankName: current.payout_account?.bank_name ?? '',
          accountNumber: current.payout_account?.account_number ?? '',
          accountName: current.payout_account?.account_name ?? '',
          promptpayId: current.payout_account?.promptpay_id ?? '',
          sellerAgreement: Boolean(current.seller_agreement_accepted_at),
          copyrightConfirmed: Boolean(current.copyright_confirmed_at),
          feeAgreement: Boolean(current.fee_agreement_accepted_at),
          pdpaAccepted: Boolean(current.pdpa_accepted_at),
        });
        setAgreementRead({
          sellerAgreement: Boolean(current.seller_agreement_accepted_at),
          copyrightConfirmed: Boolean(current.copyright_confirmed_at),
          feeAgreement: Boolean(current.fee_agreement_accepted_at),
          pdpaAccepted: Boolean(current.pdpa_accepted_at),
        });
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [mode, searchParams, user?.email, user?.role, reset, resetDocuments]);

  const save = async (
    action: 'save_draft' | 'submit',
    step = activeStep + 1,
    showSuccessMessage = true
  ) => {
    setSaving(true);
    setError('');
    try {
      const result = await saveSeller({ ...getValues(), action, wizardStep: step });
      setSeller(result.seller);
      if (showSuccessMessage) toast.success(result.message);
      if (mode === 'edit') router.refresh();
      return result.seller;
    } catch (saveError) {
      const saveErrorMessage =
        saveError instanceof Error ? saveError.message : 'บันทึกข้อมูลไม่สำเร็จ';
      setError(saveErrorMessage);
      toast.error(saveErrorMessage);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    const fields = STEP_FIELDS[activeStep];
    const fieldsValid = fields.length ? await trigger(fields) : true;
    if (!fieldsValid || !isStepComplete(activeStep)) {
      setShowStepErrors(true);
      setError('กรุณากรอกข้อมูลที่จำเป็นและอัปโหลดเอกสารให้ครบ');
      return;
    }
    const saved = await save('save_draft', Math.min(5, activeStep + 2));
    if (saved) {
      setShowStepErrors(false);
      setActiveStep((step) => Math.min(4, step + 1));
    }
  };

  const upload = async (documentType: string, file?: File) => {
    if (!file) return false;
    let current = seller;
    if (!current) current = await save('save_draft', activeStep + 1, false);
    if (!current) return false;
    setUploading(documentType);
    setError('');
    try {
      const data = new FormData();
      data.set('documentType', documentType);
      data.set('file', file);
      const response = await fetch('/api/marketplace/seller/documents', {
        method: 'POST',
        body: data,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setSeller((value) =>
        value
          ? {
              ...value,
              documents: [
                ...(value.documents ?? []).filter(
                  (document) => document.document_type !== documentType
                ),
                result.document,
              ],
              ...(documentType === 'store_logo' && { logo_url: result.document.url }),
              ...(documentType === 'store_cover' && { cover_url: result.document.url }),
            }
          : value
      );
      toast.success(result.message ?? 'อัปโหลดไฟล์เรียบร้อยแล้ว');
      return true;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'อัปโหลดไม่สำเร็จ');
      return false;
    } finally {
      setUploading('');
    }
  };

  const getDocument = (type: string) =>
    seller?.documents?.find((document) => document.document_type === type);
  const hasDocument = (type: string) => Boolean(getDocument(type));
  const googleAvatarUrl = isSystemStore ? null : user?.photoURL || user?.avatar_url || null;
  const defaultStoreLogoUrl = seller?.logo_url || googleAvatarUrl;
  const defaultStoreLogoPreviewUrl = isGoogleAvatarUrl(defaultStoreLogoUrl)
    ? '/api/marketplace/account/avatar'
    : defaultStoreLogoUrl;
  const hasStoreLogo = Boolean(hasDocument('store_logo') || defaultStoreLogoUrl);

  const isStepComplete = (step: number) => {
    if (step === 0) {
      return form.displayName.trim().length >= 2 && form.slug.length >= 3 && hasStoreLogo;
    }
    if (step === 1) {
      return (
        form.sellerName.trim().length >= 3 &&
        form.phone.replace(/\D/g, '').length >= 9 &&
        form.contactEmail.includes('@') &&
        (form.sellerType !== 'company' ||
          (form.companyName.trim().length >= 2 &&
            form.companyRegistrationNo.replace(/\D/g, '').length >= 10))
      );
    }
    if (step === 2) {
      return (
        Boolean(form.bankCode && form.bankName && form.accountName) &&
        form.accountNumber.replace(/\D/g, '').length >= 6 &&
        hasDocument('bank_book')
      );
    }
    if (step === 3) return hasDocument('identity_card') && hasDocument('bank_book');
    return (
      form.sellerAgreement &&
      form.copyrightConfirmed &&
      form.feeAgreement &&
      form.pdpaAccepted &&
      Object.values(agreementRead).every(Boolean)
    );
  };

  const submit = handleSubmit(
    async () => {
      if (!isStepComplete(3) || !Object.values(agreementRead).every(Boolean)) {
        setShowStepErrors(true);
        setError('กรุณาอัปโหลดเอกสารและยอมรับข้อตกลงทั้ง 4 ข้อให้ครบ');
        return;
      }
      const result = await save('submit', 5);
      if (result) {
        router.push('/dashboard/seller');
        router.refresh();
      }
    },
    () => {
      setShowStepErrors(true);
      setError('กรุณากรอกข้อมูลที่จำเป็นและยอมรับข้อตกลงทั้ง 4 ข้อ');
    }
  );

  if (loading) {
    return (
      <Box sx={{ minHeight: 500, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isSystemStore) {
    return (
      <Container maxWidth={false} sx={{ py: { xs: 3, md: 4 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              src={defaultStoreLogoPreviewUrl || undefined}
              variant="rounded"
              sx={{ width: 64, height: 64, bgcolor: 'primary.lighter', color: 'primary.main' }}
            >
              <RiStore2Line size={30} />
            </Avatar>
            <Box>
              <Typography component="h1" variant="h3">
                ข้อมูลร้านค้าทางการ
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                จัดการข้อมูลแบรนด์ บัญชีรับเงิน และข้อมูลสำหรับออกใบเสร็จ
              </Typography>
            </Box>
          </Stack>
          <Chip color="primary" variant="soft" label="ร้านระบบ E-KRU" />
        </Stack>

        <Alert severity="info" sx={{ mb: 3 }}>
          ร้านเจ้าของระบบเปิดใช้งานอัตโนมัติและไม่ต้องผ่านขั้นตอนสมัครผู้ขาย
        </Alert>

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            alignItems: 'start',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(380px, 0.65fr)' },
          }}
        >
          <Stack spacing={3}>
            <Card sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar
                    variant="rounded"
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: 'primary.lighter',
                      color: 'primary.main',
                    }}
                  >
                    <RiStore2Line size={22} />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">ข้อมูลพื้นฐาน</Typography>
                    <Typography variant="body2" color="text.secondary">
                      ข้อมูลที่ลูกค้าจะเห็นบนหน้าร้านและสินค้า
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <Controller
                    name="displayName"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        required
                        fullWidth
                        label="ชื่อร้านค้าทางการ"
                        autoComplete="off"
                        slotProps={{ htmlInput: { maxLength: 120 } }}
                      />
                    )}
                  />
                  <Controller
                    name="displayNameEn"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="ชื่อร้านค้า (ภาษาอังกฤษ)"
                        autoComplete="off"
                        slotProps={{ htmlInput: { maxLength: 120 } }}
                      />
                    )}
                  />
                </Stack>
                <Controller
                  name="contactEmail"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="email"
                      label="อีเมลติดต่อ"
                      autoComplete="off"
                    />
                  )}
                />
                <Controller
                  name="bio"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      minRows={4}
                      label="คำอธิบายร้าน"
                      autoComplete="off"
                    />
                  )}
                />
              </Stack>
            </Card>

            <Card sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar
                    variant="rounded"
                    sx={{ width: 40, height: 40, bgcolor: 'info.lighter', color: 'info.main' }}
                  >
                    <RiImageLine size={22} />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">รูปภาพและแบรนด์</Typography>
                    <Typography variant="body2" color="text.secondary">
                      โลโก้และภาพปกที่แสดงในส่วนต่าง ๆ ของ Marketplace
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
                  <Box sx={{ width: { xs: 1, md: '36%' } }}>
                    <DocumentUploadField
                      required
                      methods={documentsMethods}
                      name="storeLogo"
                      label="รูปโปรไฟล์ร้าน (โลโก้)"
                      done={hasStoreLogo}
                      document={getDocument('store_logo')}
                      currentUrl={defaultStoreLogoPreviewUrl}
                      loading={uploading === 'store_logo'}
                      accept="image/*"
                      previewAspectRatio="1 / 1"
                      maxSizeMb={5}
                      onFile={(file) => upload('store_logo', file)}
                    />
                  </Box>
                  <Box sx={{ flex: 1, width: 1 }}>
                    <DocumentUploadField
                      methods={documentsMethods}
                      name="storeCover"
                      label="ภาพปกร้าน"
                      done={Boolean(seller?.cover_url || hasDocument('store_cover'))}
                      document={getDocument('store_cover')}
                      currentUrl={seller?.cover_url}
                      loading={uploading === 'store_cover'}
                      accept="image/*"
                      previewAspectRatio="16 / 6"
                      maxSizeMb={5}
                      onFile={(file) => upload('store_cover', file)}
                    />
                  </Box>
                </Stack>
              </Stack>
            </Card>
          </Stack>

          <Stack spacing={3}>
            <Card sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar
                    variant="rounded"
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: 'success.lighter',
                      color: 'success.main',
                    }}
                  >
                    <RiBankLine size={22} />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">บัญชีรับเงิน</Typography>
                    <Typography variant="body2" color="text.secondary">
                      บัญชีปลายทางสำหรับรับยอดขายร้าน E-KRU
                    </Typography>
                  </Box>
                </Stack>
                <Alert severity="warning">กรุณาตรวจสอบข้อมูลบัญชีให้ถูกต้องก่อนบันทึก</Alert>
                <Controller
                  name="accountName"
                  control={control}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <TextField
                      {...field}
                      required
                      fullWidth
                      label="ชื่อบัญชีรับเงิน"
                      autoComplete="off"
                      error={!!fieldError}
                      helperText={fieldError?.message}
                    />
                  )}
                />
                <Controller
                  name="bankCode"
                  control={control}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <ThaiBankAutocomplete
                      required
                      value={field.value || form.bankName}
                      error={!!fieldError}
                      helperText={fieldError?.message ?? 'เลือกธนาคารสำหรับรับยอดขายของร้านระบบ'}
                      onChange={(bank) => {
                        field.onChange(bank?.code ?? '');
                        setValue('bankName', bank?.name ?? '', { shouldValidate: true });
                      }}
                    />
                  )}
                />
                <DigitsField
                  required
                  name="accountNumber"
                  control={control}
                  type={showAccountNumber ? 'text' : 'password'}
                  label="เลขบัญชีรับเงิน"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            edge="end"
                            aria-label={showAccountNumber ? 'ซ่อนเลขบัญชี' : 'แสดงเลขบัญชี'}
                            onClick={() => setShowAccountNumber((current) => !current)}
                          >
                            {showAccountNumber ? <RiEyeOffLine /> : <RiEyeLine />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                    htmlInput: { inputMode: 'numeric', autoComplete: 'new-password' },
                  }}
                />
                <DigitsField
                  name="promptpayId"
                  control={control}
                  type={showPromptPayId ? 'text' : 'password'}
                  label="PromptPay (ถ้ามี)"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            edge="end"
                            aria-label={showPromptPayId ? 'ซ่อน PromptPay' : 'แสดง PromptPay'}
                            onClick={() => setShowPromptPayId((current) => !current)}
                          >
                            {showPromptPayId ? <RiEyeOffLine /> : <RiEyeLine />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                    htmlInput: { inputMode: 'numeric', autoComplete: 'new-password' },
                  }}
                />
                <Box
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'background.neutral',
                  }}
                >
                  <Typography variant="subtitle2">ตัวอย่างข้อมูลที่ผู้ดูแลจะตรวจสอบ</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    ชื่อธนาคาร · ชื่อเจ้าของบัญชี · เลขบัญชี และความตรงกันกับหน้าสมุดบัญชี
                  </Typography>
                  <Typography
                    variant="caption"
                    color="primary.main"
                    sx={{ mt: 1, display: 'block' }}
                  >
                    หลังอัปโหลด สามารถกด “ดูตัวอย่าง” เพื่อตรวจเอกสารก่อนบันทึกได้
                  </Typography>
                </Box>
                <DocumentUploadField
                  required
                  methods={documentsMethods}
                  name="bankBook"
                  label="หน้าสมุดบัญชี"
                  recommendation="อัปโหลดหน้าที่เห็นชื่อธนาคาร ชื่อบัญชี และเลขบัญชีชัดเจน ผู้ดูแลจะใช้เอกสารนี้ตรวจสอบบัญชีรับเงิน"
                  done={hasDocument('bank_book')}
                  document={getDocument('bank_book')}
                  loading={uploading === 'bank_book'}
                  maxSizeMb={5}
                  storedMaxSizeMb={1}
                  onFile={(file) => upload('bank_book', file)}
                />
              </Stack>
            </Card>

            <Card sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar
                    variant="rounded"
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: 'warning.lighter',
                      color: 'warning.main',
                    }}
                  >
                    <RiFileShield2Line size={22} />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">ข้อมูลออกใบเสร็จ</Typography>
                    <Typography variant="body2" color="text.secondary">
                      ข้อมูลผู้รับเงินที่แสดงบนเอกสารของระบบ
                    </Typography>
                  </Box>
                </Stack>
                <Controller
                  name="companyName"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      required
                      fullWidth
                      label="ชื่อผู้ออกใบเสร็จ / ชื่อบริษัท"
                      autoComplete="off"
                    />
                  )}
                />
                <DigitsField
                  required
                  name="companyTaxId"
                  control={control}
                  label="เลขประจำตัวผู้เสียภาษี"
                  slotProps={{
                    htmlInput: { inputMode: 'numeric', maxLength: 13, autoComplete: 'off' },
                  }}
                />
                <Controller
                  name="businessAddress"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      required
                      fullWidth
                      multiline
                      minRows={3}
                      label="ที่อยู่ผู้ออกใบเสร็จ"
                      autoComplete="off"
                    />
                  )}
                />
                <DocumentUploadField
                  methods={documentsMethods}
                  name="receiptSignature"
                  label="ลายเซ็นอิเล็กทรอนิกส์"
                  done={hasDocument('receipt_signature')}
                  document={getDocument('receipt_signature')}
                  loading={uploading === 'receipt_signature'}
                  accept="image/png,image/jpeg"
                  maxSizeMb={2}
                  onFile={(file) => upload('receipt_signature', file)}
                />
                <Typography variant="caption" color="text.secondary">
                  ลายเซ็นจะแสดงในช่องผู้รับเงิน แนะนำไฟล์ PNG พื้นหลังโปร่งใส
                </Typography>
              </Stack>
            </Card>
          </Stack>
        </Box>

        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
          <Button
            size="large"
            variant="contained"
            loading={saving}
            onClick={() => save('save_draft')}
            sx={{ minWidth: { xs: 1, sm: 220 } }}
          >
            บันทึกข้อมูลร้าน
          </Button>
        </Stack>
      </Container>
    );
  }

  const activeStepMeta = STEPS[activeStep];
  const ActiveStepIcon = activeStepMeta.icon;
  const maxVisitedStep = Math.max(
    activeStep,
    Math.max(0, Math.min(STEPS.length - 1, (seller?.wizard_step ?? 1) - 1))
  );
  const completedCount = STEPS.filter((_, index) => isStepComplete(index)).length;
  const storeReadiness =
    seller?.status === 'active'
      ? { label: 'พร้อมขาย', color: 'success' as const }
      : seller?.status === 'rejected'
        ? { label: 'ต้องแก้ไขข้อมูล', color: 'error' as const }
        : seller?.status === 'pending' || completedCount === STEPS.length
          ? { label: 'รอตรวจสอบ', color: 'warning' as const }
          : { label: 'ข้อมูลไม่ครบ', color: 'default' as const };

  return (
    <FormProvider {...methods}>
      <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'flex-end' }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography component="h1" variant="h3">
              {mode === 'edit' ? 'แก้ไขข้อมูลร้านค้า' : 'สมัครเปิดร้าน E-KRU Marketplace'}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {mode === 'edit'
                ? 'ตรวจสอบและแก้ไขข้อมูลร้าน บัญชีรับเงิน เอกสาร และข้อตกลง'
                : 'บันทึกร่างได้ทุกขั้น และส่งให้ผู้ดูแลตรวจสอบเมื่อข้อมูลครบ'}
            </Typography>
          </Box>
          <Box sx={{ minWidth: { xs: 1, md: 240 } }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <Typography variant="caption" color="text.secondary">
                ความคืบหน้า
              </Typography>
              <Chip
                size="small"
                variant="soft"
                color={storeReadiness.color}
                label={storeReadiness.label}
              />
            </Stack>
            <LinearProgress
              variant="determinate"
              color={storeReadiness.color === 'default' ? 'primary' : storeReadiness.color}
              value={(completedCount / STEPS.length) * 100}
              sx={{ height: 8, borderRadius: 8 }}
            />
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.75 }}>
              <Typography variant="caption" color="text.secondary">
                {storeReadiness.label === 'ข้อมูลไม่ครบ'
                  ? 'กรุณากรอกข้อมูลให้ครบทุกขั้นตอน'
                  : 'สถานะร้านค้า'}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {completedCount}/{STEPS.length} ขั้นตอน
              </Typography>
            </Stack>
          </Box>
        </Stack>

        <Accordion
          disableGutters
          sx={{
            mb: 3,
            boxShadow: 'none',
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'primary.light',
            bgcolor: 'primary.lighter',
            overflow: 'hidden',
            px: 2,
            '&::before': { display: 'none' },
            '&.Mui-expanded': { m: 0, mb: 3 },
          }}
        >
          <AccordionSummary
            expandIcon={<RiArrowRightLine size={20} />}
            aria-controls="seller-data-protection-content"
            id="seller-data-protection-header"
            sx={{
              px: { xs: 2, md: 2.5 },
              minHeight: 84,
              '&.Mui-expanded': { minHeight: 84 },
              '& .MuiAccordionSummary-content': { my: 1.5 },
              '& .MuiAccordionSummary-content.Mui-expanded': { my: 1.5 },
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar
                variant="rounded"
                sx={{ color: 'primary.main', bgcolor: 'background.paper', flexShrink: 0 }}
              >
                <RiShieldCheckLine size={24} />
              </Avatar>
              <Box>
                <Typography variant="h6">ข้อมูลของคุณได้รับการปกป้อง</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  เราขอเฉพาะข้อมูลที่จำเป็นสำหรับยืนยันผู้ขาย ออกเอกสาร และโอนรายได้ให้ถูกบัญชี
                </Typography>
              </Box>
            </Stack>
          </AccordionSummary>

          <AccordionDetails
            id="seller-data-protection-content"
            sx={{ px: { xs: 2, md: 2.5 }, pt: 0, pb: 2.5 }}
          >
            <Stack spacing={2.5}>
              <Box
                sx={{
                  gap: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                }}
              >
                <TrustItem
                  icon={<RiFileShield2Line size={20} />}
                  title="จำกัดผู้เข้าถึง"
                  description="เอกสารเปิดได้เฉพาะเจ้าของร้านและผู้ดูแล Marketplace ที่ได้รับสิทธิ"
                />
                <TrustItem
                  icon={<RiLockPasswordLine size={20} />}
                  title="ปกป้องข้อมูลสำคัญ"
                  description="ข้อมูลบัญชีรับเงินถูกเข้ารหัส และเลขผู้เสียภาษีที่ผู้ดูแลเห็นจะถูกปิดบัง"
                />
                <TrustItem
                  icon={<RiBankLine size={20} />}
                  title="ใช้ตามวัตถุประสงค์"
                  description="ใช้เพื่อตรวจสอบร้าน ออกใบเสร็จ และจ่ายรายได้จากยอดขายเท่านั้น"
                />
              </Box>

              <Alert severity="warning">
                <Typography variant="subtitle2">E-KRU จะไม่ขอข้อมูลลับของธนาคาร</Typography>
                <Typography variant="body2">
                  เราจะไม่ขอ OTP, รหัสผ่าน, PIN, CVV หรือให้โอนเงินเพื่อยืนยันตัวตน หากมีผู้ร้องขอ
                  กรุณาหยุดดำเนินการและติดต่อทีมงาน
                </Typography>
              </Alert>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  component={RouterLink}
                  href="/privacy-policy"
                >
                  อ่านนโยบายความเป็นส่วนตัว
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  component={RouterLink}
                  href="/seller-agreement"
                >
                  อ่านข้อตกลงผู้ขาย
                </Button>
              </Stack>
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Card
          variant="outlined"
          sx={{
            p: 1.25,
            mb: 3,
            overflowX: 'auto',
            borderRadius: 3,
            scrollbarWidth: 'thin',
          }}
        >
          <Stack direction="row" spacing={1} sx={{ minWidth: { xs: 760, lg: 0 } }}>
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const active = index === activeStep;
              const completed = isStepComplete(index);
              const canOpen = mode === 'edit' || index <= maxVisitedStep;

              return (
                <Button
                  key={step.title}
                  type="button"
                  disabled={!canOpen}
                  onClick={() => {
                    setError('');
                    setShowStepErrors(false);
                    setActiveStep(index);
                  }}
                  sx={{
                    p: 1.5,
                    gap: 1.25,
                    flex: 1,
                    minWidth: 140,
                    borderRadius: 2,
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    color: active ? 'primary.main' : 'text.primary',
                    bgcolor: active ? 'primary.lighter' : 'transparent',
                    border: '1px solid',
                    borderColor: active ? 'primary.light' : 'transparent',
                    '&:hover': {
                      bgcolor: active ? 'primary.lighter' : 'background.neutral',
                    },
                  }}
                >
                  <Avatar
                    sx={{
                      width: 38,
                      height: 38,
                      flexShrink: 0,
                      color: completed
                        ? 'success.main'
                        : active
                          ? 'primary.main'
                          : 'text.secondary',
                      bgcolor: completed
                        ? 'success.lighter'
                        : active
                          ? 'background.paper'
                          : 'background.neutral',
                    }}
                  >
                    {completed ? <RiCheckboxCircleLine size={21} /> : <Icon size={20} />}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="subtitle2"
                      noWrap
                      sx={{ color: 'inherit', lineHeight: 1.25 }}
                    >
                      {index + 1}. {step.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {completed ? 'ข้อมูลครบแล้ว' : active ? 'กำลังดำเนินการ' : step.description}
                    </Typography>
                  </Box>
                </Button>
              );
            })}
          </Stack>
        </Card>
        {!!error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {seller?.status === 'rejected' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            คำขอไม่ผ่าน: {seller.rejection_reason}
          </Alert>
        )}

        <Card variant="outlined" sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 3 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={2}
            sx={{ pb: 2.5, mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar variant="rounded" sx={{ color: 'primary.main', bgcolor: 'primary.lighter' }}>
                <ActiveStepIcon />
              </Avatar>
              <Box>
                <Typography variant="overline" color="primary.main">
                  ขั้นตอนที่ {activeStep + 1} จาก {STEPS.length}
                </Typography>
                <Typography variant="h5">{activeStepMeta.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {activeStepMeta.description}
                </Typography>
              </Box>
            </Stack>
            <Chip
              size="small"
              color={isStepComplete(activeStep) ? 'success' : 'default'}
              variant="soft"
              label={isStepComplete(activeStep) ? 'ข้อมูลครบแล้ว' : 'กำลังกรอก'}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            />
          </Stack>

          {activeStep === 0 && (
            <Stack>
              <Box
                sx={{
                  display: 'grid',
                  gap: { xs: 2.5, md: 3 },
                  alignItems: 'start',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(500px, 0.5fr)' },
                }}
              >
                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="subtitle1">รายละเอียดร้านค้า</Typography>
                    <Typography variant="body2" color="text.secondary">
                      ข้อมูลนี้จะแสดงบนหน้าร้านและช่วยให้ลูกค้าค้นหาร้านของคุณได้ง่ายขึ้น
                    </Typography>
                  </Box>
                  <Controller
                    name="displayName"
                    control={control}
                    render={({ field, fieldState: { error: fieldError } }) => (
                      <TextField
                        {...field}
                        required
                        fullWidth
                        label="ชื่อร้าน"
                        autoComplete="off"
                        error={!!fieldError}
                        helperText={fieldError?.message}
                        onChange={(event) => {
                          const prevSlug = getValues('slug');
                          const prevDisplayName = field.value;
                          field.onChange(event.target.value);
                          if (!prevSlug || prevSlug === slugify(prevDisplayName)) {
                            setValue('slug', slugify(event.target.value), { shouldValidate: true });
                          }
                        }}
                      />
                    )}
                  />
                  <Field.Text name="displayNameEn" label="ชื่อร้านภาษาอังกฤษ" />
                  <Field.Text
                    required
                    name="slug"
                    label="Slug URL"
                    onChange={(event) => setValue('slug', slugify(event.target.value))}
                    helperText={`https://e-kru-marketplace.com/store/${form.slug || 'your-store'}`}
                  />
                  <Field.Text name="bio" label="คำอธิบายร้าน" multiline minRows={4} />

                  <Stack spacing={2.5}>
                    <Box>
                      <DocumentUploadField
                        methods={documentsMethods}
                        name="storeCover"
                        label="ภาพหน้าปกร้าน"
                        recommendation="แนะนำภาพแนวนอน อัตราส่วน 16:6 เช่น 1600 × 600 px"
                        done={hasDocument('store_cover')}
                        document={getDocument('store_cover')}
                        loading={uploading === 'store_cover'}
                        accept="image/*"
                        previewAspectRatio="16 / 6"
                        maxSizeMb={2}
                        onFile={(file) => upload('store_cover', file)}
                      />
                    </Box>
                  </Stack>
                </Stack>

                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="subtitle1">รูปภาพร้านค้า</Typography>
                    <Typography variant="body2" color="text.secondary">
                      อัปโหลดโลโก้และภาพหน้าปกให้ลูกค้าจดจำร้านของคุณได้ง่าย
                      {mode === 'edit' && ' รูปใหม่จะแสดงบนหน้าร้านทันทีโดยไม่ต้องรออนุมัติ'}
                    </Typography>
                  </Box>
                  <Box>
                    <DocumentUploadField
                      required
                      methods={documentsMethods}
                      name="storeLogo"
                      label="โลโก้ร้าน"
                      recommendation="แนะนำภาพสี่เหลี่ยมจัตุรัส อัตราส่วน 1:1 เช่น 800 x 800 px"
                      done={hasStoreLogo}
                      error={showStepErrors && !hasStoreLogo}
                      document={getDocument('store_logo')}
                      currentUrl={defaultStoreLogoPreviewUrl}
                      loading={uploading === 'store_logo'}
                      accept="image/*"
                      previewAspectRatio="1 / 1"
                      maxSizeMb={2}
                      onFile={(file) => upload('store_logo', file)}
                    />
                  </Box>
                </Stack>
              </Box>
            </Stack>
          )}
          {activeStep === 1 && (
            <Stack spacing={2.5}>
              <Field.RadioGroup row name="sellerType" options={SELLER_TYPE_OPTIONS} />
              <Field.Text required name="sellerName" label="ชื่อ-นามสกุล" autoComplete="off" />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <TextField
                      {...field}
                      required
                      fullWidth
                      type={showPhone ? 'text' : 'password'}
                      label="เบอร์โทร"
                      error={!!fieldError}
                      helperText={fieldError?.message}
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                edge="end"
                                aria-label={showPhone ? 'ซ่อนเบอร์โทร' : 'แสดงเบอร์โทร'}
                                onClick={() => setShowPhone((current) => !current)}
                              >
                                {showPhone ? <RiEyeOffLine /> : <RiEyeLine />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        },
                        htmlInput: { inputMode: 'tel', autoComplete: 'off' },
                      }}
                    />
                  )}
                />
                <Field.Text
                  required
                  type="email"
                  name="contactEmail"
                  label="Email"
                  autoComplete="off"
                />
              </Stack>
              <Controller
                name="nationalTaxId"
                control={control}
                render={({ field, fieldState: { error: fieldError } }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type={showNationalTaxId ? 'text' : 'password'}
                    label="เลขบัตรประชาชน หรือเลขผู้เสียภาษี"
                    error={!!fieldError}
                    helperText={
                      fieldError?.message ??
                      'ผู้ดูแลจะเห็นเฉพาะ 4 ตัวหน้าและ 4 ตัวท้าย เช่น 1234*****6789'
                    }
                    onChange={(event) => field.onChange(event.target.value.replace(/\D/g, ''))}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              edge="end"
                              aria-label={
                                showNationalTaxId
                                  ? 'ซ่อนเลขบัตรประชาชนหรือผู้เสียภาษี'
                                  : 'แสดงเลขบัตรประชาชนหรือผู้เสียภาษี'
                              }
                              onClick={() => setShowNationalTaxId((current) => !current)}
                            >
                              {showNationalTaxId ? <RiEyeOffLine /> : <RiEyeLine />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                      htmlInput: {
                        inputMode: 'numeric',
                        maxLength: 13,
                        autoComplete: 'off',
                      },
                    }}
                  />
                )}
              />
              {form.sellerType === 'company' && (
                <>
                  <Field.Text required name="companyName" label="ชื่อบริษัท" autoComplete="off" />
                  <Field.Text
                    required
                    name="companyRegistrationNo"
                    label="เลขนิติบุคคล"
                    autoComplete="off"
                  />
                  <Field.Text name="companyTaxId" label="เลขผู้เสียภาษี" autoComplete="off" />
                </>
              )}
            </Stack>
          )}
          {activeStep === 2 && (
            <Stack spacing={2.5}>
              <Box>
                <Alert severity="warning">
                  <Typography variant="subtitle2">กรุณาตรวจสอบข้อมูลบัญชีให้ถูกต้อง</Typography>
                  <Typography variant="body2">
                    หากชื่อบัญชี เลขบัญชี หรือธนาคารไม่ตรงกัน ระบบจะพักการโอน
                    และนำยอดไปรวมในรอบถัดไปหลังแก้ไขข้อมูลแล้ว
                  </Typography>
                </Alert>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gap: { xs: 2.5, md: 3 },
                  alignItems: 'start',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(360px, 0.9fr)' },
                }}
              >
                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="subtitle1">ข้อมูลบัญชีรับเงิน</Typography>
                    <Typography variant="body2" color="text.secondary">
                      ระบบจะใช้บัญชีนี้สำหรับโอนยอดขายหลังพ้นระยะพักยอด
                    </Typography>
                  </Box>
                  <Field.Text required name="accountName" label="ชื่อบัญชี" />
                  <Controller
                    name="bankCode"
                    control={control}
                    render={({ field, fieldState: { error: fieldError } }) => (
                      <ThaiBankAutocomplete
                        required
                        value={field.value || form.bankName}
                        error={!!fieldError}
                        helperText={
                          fieldError?.message ??
                          'เลือกจากรายการเพื่อให้ชื่อและรหัสธนาคารตรงกับไฟล์โอนเงิน'
                        }
                        onChange={(bank) => {
                          field.onChange(bank?.code ?? '');
                          setValue('bankName', bank?.name ?? '', { shouldValidate: true });
                        }}
                      />
                    )}
                  />
                  <DigitsField
                    required
                    name="accountNumber"
                    control={control}
                    type={showAccountNumber ? 'text' : 'password'}
                    label="เลขบัญชี"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              edge="end"
                              aria-label={showAccountNumber ? 'ซ่อนเลขบัญชี' : 'แสดงเลขบัญชี'}
                              onClick={() => setShowAccountNumber((current) => !current)}
                            >
                              {showAccountNumber ? <RiEyeOffLine /> : <RiEyeLine />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                      htmlInput: { inputMode: 'numeric', autoComplete: 'new-password' },
                    }}
                  />
                  <DigitsField
                    name="promptpayId"
                    control={control}
                    type={showPromptPayId ? 'text' : 'password'}
                    label="PromptPay (ถ้ามี)"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              edge="end"
                              aria-label={showPromptPayId ? 'ซ่อน PromptPay' : 'แสดง PromptPay'}
                              onClick={() => setShowPromptPayId((current) => !current)}
                            >
                              {showPromptPayId ? <RiEyeOffLine /> : <RiEyeLine />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                      htmlInput: { inputMode: 'numeric', autoComplete: 'new-password' },
                    }}
                  />

                  <Alert severity="info">
                    <Typography variant="subtitle2">
                      แนะนำ: บัญชีกสิกรไทยที่ผูกกับ K PLUS
                    </Typography>
                    <Typography variant="body2">
                      ช่วยให้ตรวจสอบเงินเข้าและรับการแจ้งเตือนได้สะดวก แต่ไม่บังคับ
                      ผู้ขายสามารถเลือกบัญชีธนาคารอื่นได้ตามปกติ
                    </Typography>
                  </Alert>
                </Stack>

                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="subtitle1">เอกสารยืนยันบัญชี</Typography>
                    <Typography variant="body2" color="text.secondary">
                      ชื่อและเลขบัญชีในเอกสารต้องตรงกับข้อมูลที่กรอก
                    </Typography>
                  </Box>
                  <DocumentUploadField
                    required
                    methods={documentsMethods}
                    name="bankBook"
                    label="หน้าสมุดบัญชี"
                    recommendation="ผู้ดูแลจะเห็นชื่อธนาคาร ชื่อบัญชี และเลขบัญชีเพื่อเปรียบเทียบกับข้อมูลรับเงิน กดดูตัวอย่างเพื่อตรวจก่อนส่งได้"
                    done={hasDocument('bank_book')}
                    error={showStepErrors && !hasDocument('bank_book')}
                    document={getDocument('bank_book')}
                    loading={uploading === 'bank_book'}
                    maxSizeMb={5}
                    storedMaxSizeMb={1}
                    onFile={(file) => upload('bank_book', file)}
                  />
                </Stack>
              </Box>
            </Stack>
          )}
          {activeStep === 3 && (
            <Stack spacing={2.5}>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  alignItems: 'stretch',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                }}
              >
                <DocumentUploadField
                  required
                  methods={documentsMethods}
                  name="identityCard"
                  label="บัตรประชาชน หรือสำเนาบัตรประชาชน"
                  done={hasDocument('identity_card')}
                  error={showStepErrors && !hasDocument('identity_card')}
                  document={getDocument('identity_card')}
                  loading={uploading === 'identity_card'}
                  storedMaxSizeMb={1}
                  onFile={(file) => upload('identity_card', file)}
                />
                <DocumentUploadField
                  required
                  methods={documentsMethods}
                  name="bankBook"
                  label="หน้าสมุดบัญชี"
                  recommendation="ผู้ดูแลจะเห็นชื่อธนาคาร ชื่อบัญชี และเลขบัญชีเพื่อเปรียบเทียบกับข้อมูลรับเงิน กดดูตัวอย่างเพื่อตรวจก่อนส่งได้"
                  done={hasDocument('bank_book')}
                  error={showStepErrors && !hasDocument('bank_book')}
                  document={getDocument('bank_book')}
                  loading={uploading === 'bank_book'}
                  maxSizeMb={5}
                  storedMaxSizeMb={1}
                  onFile={(file) => upload('bank_book', file)}
                />
                <DocumentUploadField
                  methods={documentsMethods}
                  name="companyCertificate"
                  label="หนังสือรับรองบริษัท (ถ้ามี)"
                  recommendation="เอกสารนี้ไม่จำเป็น สามารถเว้นว่างได้"
                  done={hasDocument('company_certificate')}
                  document={getDocument('company_certificate')}
                  loading={uploading === 'company_certificate'}
                  storedMaxSizeMb={1}
                  onFile={(file) => upload('company_certificate', file)}
                />
                <DocumentUploadField
                  methods={documentsMethods}
                  name="vatCertificate"
                  label="ภ.พ.20 (ถ้ามี)"
                  recommendation="เอกสารนี้ไม่จำเป็น สามารถเว้นว่างได้"
                  done={hasDocument('vat_certificate')}
                  document={getDocument('vat_certificate')}
                  loading={uploading === 'vat_certificate'}
                  storedMaxSizeMb={1}
                  onFile={(file) => upload('vat_certificate', file)}
                />
              </Box>
            </Stack>
          )}
          {activeStep === 4 && (
            <Stack spacing={2}>
              {/* <Alert severity="info">
              ข้อตกลงและนโยบายฉบับล่าสุดที่ระบบเผยแพร่
              เปิดอ่านและเลื่อนจนถึงด้านล่างจึงจะสามารถเลือกยอมรับได้
            </Alert> */}
              {!!missingAgreementTypes.length && (
                <Alert severity="error">
                  ยังไม่มีเอกสารนโยบายฉบับเผยแพร่ครบถ้วน กรุณาให้ผู้ดูแลเผยแพร่เอกสารฉบับสมบูรณ์
                  เอกสารก่อนส่งคำขอ
                </Alert>
              )}
              {agreements.map((agreement) => {
                const hasRead = agreementRead[agreement.key];
                const document = legalDocuments.find(
                  (item) => item.document_type === agreement.documentType
                );
                return (
                  <Box
                    key={agreement.key}
                    sx={{
                      p: 2,
                      gap: 2,
                      border: '1px solid',
                      borderColor: hasRead ? 'success.light' : 'divider',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      flexDirection: { xs: 'column', sm: 'row' },
                      justifyContent: 'space-between',
                    }}
                  >
                    <Field.Checkbox
                      name={agreement.key}
                      slotProps={{ checkbox: { disabled: !hasRead } }}
                      label={
                        <Box>
                          <Typography variant="subtitle2">
                            {document?.title ?? AGREEMENT_CHECKBOX_LABELS[agreement.key]}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {hasRead
                              ? 'อ่านครบแล้ว สามารถเลือกยอมรับได้'
                              : 'กรุณาเปิดอ่านและเลื่อนให้ถึงท้ายเอกสาร'}
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0 }}
                    />
                    <Button
                      variant={hasRead ? 'outlined' : 'contained'}
                      disabled={!document}
                      onClick={() => setOpenAgreement(agreement)}
                      sx={{ flexShrink: 0 }}
                    >
                      {hasRead ? 'อ่านอีกครั้ง' : 'เปิดอ่านข้อตกลง'}
                    </Button>
                  </Box>
                );
              })}
              <Alert severity="warning">
                {mode === 'edit'
                  ? 'ตรวจสอบข้อมูลให้ถูกต้องก่อนส่ง ข้อมูลเดิมจะยังแสดงบนหน้าร้านจนกว่าผู้ดูแลจะอนุมัติข้อมูลใหม่ ยกเว้นโลโก้และภาพหน้าปกซึ่งมีผลทันที'
                  : 'ตรวจสอบข้อมูลและเอกสารให้ถูกต้องก่อนส่ง หลังส่งสถานะจะเป็นกำลังตรวจสอบ'}
              </Alert>
            </Stack>
          )}

          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            justifyContent="space-between"
            spacing={1.5}
            sx={{
              pt: 2.5,
              mt: 4,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Button
              color="inherit"
              disabled={activeStep === 0}
              startIcon={<RiArrowLeftLine />}
              onClick={() => setActiveStep((step) => step - 1)}
            >
              ย้อนกลับ
            </Button>
            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1}>
              <Button variant="outlined" loading={saving} onClick={() => save('save_draft')}>
                {mode === 'edit' ? 'บันทึกการแก้ไข' : 'บันทึกร่าง'}
              </Button>
              {activeStep < 4 ? (
                <Button
                  variant="contained"
                  loading={saving}
                  endIcon={<RiArrowRightLine />}
                  onClick={next}
                >
                  ถัดไป
                </Button>
              ) : (
                <Button
                  variant="contained"
                  loading={saving}
                  startIcon={<RiCheckboxCircleLine />}
                  onClick={submit}
                >
                  {mode === 'edit' && seller?.status === 'active'
                    ? 'ส่งตรวจข้อมูลแก้ไข'
                    : 'ส่งคำขอเปิดร้าน'}
                </Button>
              )}
            </Stack>
          </Stack>
        </Card>
        <AgreementReadDialog
          agreement={openAgreement}
          document={
            openAgreement
              ? (legalDocuments.find(
                  (document) => document.document_type === openAgreement.documentType
                ) ?? null)
              : null
          }
          onClose={() => setOpenAgreement(null)}
          onRead={(key) => {
            setAgreementRead((current) => ({ ...current, [key]: true }));
            setOpenAgreement(null);
          }}
        />
      </Container>
    </FormProvider>
  );
}

function TrustItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="flex-start"
      sx={{ p: 1.75, borderRadius: 2, bgcolor: 'background.paper' }}
    >
      <Avatar
        variant="rounded"
        sx={{ width: 34, height: 34, color: 'primary.main', bgcolor: 'primary.lighter' }}
      >
        {icon}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Typography variant="caption" color="text.secondary">
          {description}
        </Typography>
      </Box>
    </Stack>
  );
}

function DocumentUploadField({
  methods,
  name,
  label,
  recommendation,
  done,
  document,
  currentUrl,
  loading,
  onFile,
  accept = 'image/*,application/pdf',
  previewAspectRatio,
  required = false,
  error = false,
  maxSizeMb = 5,
  storedMaxSizeMb,
}: {
  methods: UseFormReturn<SellerDocumentsSchemaType>;
  name: FieldPath<SellerDocumentsSchemaType>;
  label: string;
  recommendation?: string;
  done: boolean;
  document?: NonNullable<MarketplaceSeller['documents']>[number];
  currentUrl?: string | null;
  loading: boolean;
  onFile: (file: File) => Promise<boolean>;
  accept?: string;
  previewAspectRatio?: string;
  required?: boolean;
  error?: boolean;
  maxSizeMb?: number;
  storedMaxSizeMb?: number;
}) {
  const { control, setValue } = methods;
  const value = useWatch({ control, name });
  const pendingFile = value instanceof File ? value : null;
  const [previewOpen, setPreviewOpen] = useState(false);

  const uploadedUrl = document?.url ?? currentUrl ?? null;

  // Keep the field in sync with the server's copy of the document, without
  // clobbering a file the user has staged locally but not confirmed yet.
  useEffect(() => {
    setValue(name, uploadedUrl, { shouldValidate: false });
  }, [uploadedUrl, name, setValue]);

  const acceptTypes = accept.split(',').map((type) => type.trim());
  const acceptsOnlyImages = acceptTypes.every((type) => type.startsWith('image/'));
  const acceptOption = Object.fromEntries(acceptTypes.map((type) => [type, [] as string[]]));

  const fileName = pendingFile?.name || document?.file_name || '';
  const fileSize = pendingFile?.size ?? document?.file_size ?? 0;
  const showRequiredError = error && !done && !pendingFile;

  const handleConfirmUpload = async () => {
    if (!pendingFile) return;
    await onFile(pendingFile);
  };

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2.5,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="subtitle2">
            {label}
            {required ? <span style={{ color: 'red' }}> *</span> : ''}
          </Typography>
          {done && !pendingFile && (
            <Chip size="small" color="success" variant="soft" label="อัปโหลดแล้ว" />
          )}
          {pendingFile && (
            <Chip size="small" color="warning" variant="soft" label="ยังไม่ได้อัปโหลด" />
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          รองรับ{' '}
          {accept.includes('application/pdf')
            ? 'JPG, PNG, WebP หรือ PDF'
            : accept === 'image/png,image/jpeg'
              ? 'JPG หรือ PNG'
              : 'JPG, PNG หรือ WebP'}{' '}
          ขนาดไม่เกิน {maxSizeMb} MB
        </Typography>
        {storedMaxSizeMb && (
          <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>
            ระบบจะย่อไฟล์รูปก่อนบันทึกให้ไม่เกิน {storedMaxSizeMb} MB ส่วน PDF
            จะตรวจขนาดอีกครั้งหลังประมวลผล
          </Typography>
        )}
        {recommendation && (
          <Typography variant="caption" color="primary.main" sx={{ display: 'block', mb: 1 }}>
            {recommendation}
          </Typography>
        )}

        <FormProvider {...methods}>
          <Field.Upload
            name={name}
            accept={acceptOption}
            maxSize={maxSizeMb * 1024 * 1024}
            disabled={loading}
            loading={loading}
            error={showRequiredError}
            helperText={showRequiredError ? 'กรุณาอัปโหลดไฟล์นี้' : undefined}
            onDelete={() => setValue(name, null, { shouldValidate: true })}
            sx={{
              mt: 1,
              minHeight: 160,
              ...(previewAspectRatio && value ? { aspectRatio: previewAspectRatio } : {}),
            }}
            placeholder={
              <Stack alignItems="center" spacing={1}>
                <Avatar
                  variant="rounded"
                  sx={{ width: 58, height: 58, color: 'primary.main', bgcolor: 'primary.lighter' }}
                >
                  {acceptsOnlyImages ? <RiImageLine size={30} /> : <RiUploadCloud2Line size={30} />}
                </Avatar>
                <Typography variant="subtitle2">ลากไฟล์มาวางที่นี่</Typography>
                <Typography variant="body2" color="text.secondary">
                  หรือคลิกเพื่อเลือกไฟล์จากอุปกรณ์
                </Typography>
              </Stack>
            }
          />
        </FormProvider>

        {fileName && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {fileName}
            {fileSize ? ` • ${(fileSize / 1024 / 1024).toFixed(2)} MB` : ''}
          </Typography>
        )}

        {pendingFile && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            กด “ยืนยันอัปโหลด” เพื่อบันทึกไฟล์นี้
          </Alert>
        )}

        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
          {uploadedUrl && !pendingFile && (
            <Button color="inherit" startIcon={<RiEyeLine />} onClick={() => setPreviewOpen(true)}>
              ดูตัวอย่าง
            </Button>
          )}
          <Button
            variant="contained"
            loading={loading}
            disabled={!pendingFile}
            startIcon={<RiUploadCloud2Line />}
            onClick={handleConfirmUpload}
          >
            ยืนยันอัปโหลด
          </Button>
        </Stack>
      </Card>
      <DocumentPreviewDialog
        file={
          previewOpen && uploadedUrl
            ? {
                url: uploadedUrl,
                title: `ตัวอย่าง ${label}`,
                fileName: document?.file_name,
                mimeType: document?.mime_type,
              }
            : null
        }
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
