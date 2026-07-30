'use client';

import type {
  ProductInput,
  MarketplaceTag,
  MarketplaceProduct,
  MarketplaceSaleType,
  MarketplaceMediaType,
  MarketplaceCurriculum,
  MarketplaceGradeLevel,
  MarketplaceProductFile,
  MarketplaceProductImage,
  MarketplaceSubjectOption,
  MarketplaceSubscriptionPlan,
} from '../../shared/types';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';
import { SCHOOL_FEATURES } from 'src/lib/school-subscription-config';

import { Upload } from 'src/components/upload';
import { Editor } from 'src/components/editor';
import {
  RemixIcon,
  RiAddLine,
  RiEyeLine,
  RiGiftLine,
  RiSaveLine,
  RiImageAddLine,
  RiFileList3Line,
  RiPriceTag3Line,
  RiCheckboxCircleLine,
  RiCheckboxBlankCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { getMarketplacePricing } from '../../shared/pricing';
import { MARKETPLACE_CATEGORIES } from '../../shared/constants';
import { MARKETPLACE_SELLER_LINE_FEATURE } from '../line-feature';
import { MARKETPLACE_MINIMUM_PAID_PRICE_THB } from '../../shared/payment';
import {
  getTags,
  getCurricula,
  getSaleTypes,
  getCategories,
  createProduct,
  updateProduct,
  getMediaTypes,
  getGradeLevels,
  deleteProductFile,
  getManagedProduct,
  uploadProductFiles,
  deleteProductImage,
  uploadProductImages,
  getSubscriptionPlans,
  setProductCoverImage,
  setProductFilePreview,
  getMarketplaceSubjects,
} from '../../shared/api';

const COVER_IMAGE_ACCEPT = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};
const MAX_COVER_SIZE = 5 * 1024 * 1024;

const PRODUCT_FILE_ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/zip': ['.zip'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};
const MAX_PRODUCT_FILE_SIZE = 50 * 1024 * 1024;
const MAX_EXTERNAL_LINKS = 3;
const MAX_PURCHASE_BENEFITS = 8;

type Props = {
  productId?: string;
};

type PendingProductFile = {
  key: string;
  file: File;
  isPreview: boolean;
};

const initialForm = {
  productKind: 'resource' as 'resource' | 'license',
  title: '',
  titleEn: '',
  shortDescription: '',
  shortDescriptionEn: '',
  description: '',
  descriptionEn: '',
  category: '',
  subjectLabel: '',
  curriculumId: '',
  gradeLevelIds: [] as string[],
  tagIds: [] as string[],
  mediaTypeId: '',
  saleTypeId: '',
  price: '0',
  listPrice: '',
  grantsFeatureKeys: [] as string[],
  grantsPlanCode: '',
  grantDurationDays: '30',
  licenseScope: 'school' as 'individual' | 'school' | 'teacher',
  licenseSeatCount: '1',
  licenseMaxTeachers: '',
  licenseMaxStudents: '',
  licenseMaxSchoolAdmins: '',
  licenseLineQuota: '',
  externalLinks: [] as Array<{ label: string; url: string }>,
  purchaseBenefits: [] as string[],
};

function plainTextLength(html: string) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim().length;
}

function isValidExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function MarketplaceProductFormView({ productId: initialProductId }: Props = {}) {
  const router = useRouter();
  const { currentLang } = useTranslate();
  const { user } = useAuthContext();
  const [productId, setProductId] = useState(initialProductId);
  const [initializing, setInitializing] = useState(Boolean(initialProductId));
  const [saving, setSaving] = useState(false);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [filesUploading, setFilesUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const [categories, setCategories] = useState<string[]>(
    MARKETPLACE_CATEGORIES.filter((item) => item !== 'all')
  );
  const [gradeLevels, setGradeLevels] = useState<MarketplaceGradeLevel[]>([]);
  const [curricula, setCurricula] = useState<MarketplaceCurriculum[]>([]);
  const [tags, setTags] = useState<MarketplaceTag[]>([]);
  const [mediaTypes, setMediaTypes] = useState<MarketplaceMediaType[]>([]);
  const [saleTypes, setSaleTypes] = useState<MarketplaceSaleType[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<MarketplaceSubjectOption[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<MarketplaceSubscriptionPlan[]>([]);
  const [subscriptionPlansLoading, setSubscriptionPlansLoading] = useState(false);
  const [subscriptionPlansError, setSubscriptionPlansError] = useState('');
  const [commissionRate, setCommissionRate] = useState(0);
  const [images, setImages] = useState<MarketplaceProductImage[]>([]);
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [pendingPreviewImages, setPendingPreviewImages] = useState<File[]>([]);
  const [pendingDeletedImageIds, setPendingDeletedImageIds] = useState<string[]>([]);
  const [files, setFiles] = useState<MarketplaceProductFile[]>([]);
  const [pendingProductFiles, setPendingProductFiles] = useState<PendingProductFile[]>([]);
  const [pendingDeletedFileIds, setPendingDeletedFileIds] = useState<string[]>([]);
  const [pendingFilePreview, setPendingFilePreview] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    Promise.all([
      getCategories(),
      getGradeLevels(),
      getCurricula(),
      getTags(),
      getMediaTypes(),
      getSaleTypes(),
      getMarketplaceSubjects(),
    ])
      .then(
        ([
          categoryResult,
          gradeLevelResult,
          curriculumResult,
          tagResult,
          mediaTypeResult,
          saleTypeResult,
          subjectResult,
        ]) => {
          if (categoryResult.categories.length) {
            setCategories(categoryResult.categories.map((item) => item.name));
          }
          setGradeLevels(gradeLevelResult.items);
          setCurricula(curriculumResult.items);
          setTags(tagResult.items);
          setMediaTypes(mediaTypeResult.items);
          setSaleTypes(saleTypeResult.items);
          setSubjectOptions(subjectResult.items);
        }
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role !== 'master_admin') return;

    setSubscriptionPlansLoading(true);
    setSubscriptionPlansError('');
    getSubscriptionPlans()
      .then(({ plans }) => setSubscriptionPlans(plans))
      .catch((loadError) =>
        setSubscriptionPlansError(
          loadError instanceof Error ? loadError.message : 'โหลดแพ็กเกจจาก E-KRU ไม่สำเร็จ'
        )
      )
      .finally(() => setSubscriptionPlansLoading(false));
  }, [user?.role]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'master_admin') {
      setCommissionRate(0);
      return;
    }
    fetch('/api/marketplace/payment-methods')
      .then((response) => response.json())
      .then((result: { commissionRate?: number }) =>
        setCommissionRate(Math.min(100, Math.max(0, Number(result.commissionRate) || 0)))
      )
      .catch(() => setCommissionRate(0));
  }, [user]);

  const hydrate = useCallback((product: MarketplaceProduct) => {
    setForm({
      productKind: product.resource_type === 'feature_unlock' ? 'license' : 'resource',
      title: product.title ?? '',
      titleEn: product.title_en ?? '',
      shortDescription: product.short_description ?? '',
      shortDescriptionEn: product.short_description_en ?? '',
      description: product.description ?? '',
      descriptionEn: product.description_en ?? '',
      category: product.category ?? '',
      subjectLabel: product.subject_label ?? '',
      curriculumId: product.curriculum_id ?? '',
      gradeLevelIds: (product.grade_levels ?? []).map((item) => item.grade_level.id),
      tagIds: (product.tags ?? []).map((item) => item.tag.id),
      mediaTypeId: product.media_type_id ?? '',
      saleTypeId: product.sale_type_id ?? '',
      price: String(product.price ?? 0),
      listPrice: product.list_price == null ? '' : String(product.list_price),
      grantsFeatureKeys: product.grants_feature_keys?.length
        ? product.grants_feature_keys
        : product.grants_feature_key
          ? [product.grants_feature_key]
          : [],
      grantsPlanCode: product.grants_plan_code ?? '',
      grantDurationDays: String(product.grant_duration_days ?? 30),
      licenseScope: product.license_scope ?? 'school',
      licenseSeatCount: String(product.license_seat_count ?? 1),
      licenseMaxTeachers: String(product.license_max_teachers ?? ''),
      licenseMaxStudents: String(product.license_max_students ?? ''),
      licenseMaxSchoolAdmins: String(product.license_max_school_admins ?? ''),
      licenseLineQuota: String(product.license_line_quota ?? ''),
      externalLinks: (product.external_links ?? []).slice(0, MAX_EXTERNAL_LINKS),
      purchaseBenefits: (product.purchase_benefits ?? []).slice(0, MAX_PURCHASE_BENEFITS),
    });
    setImages(product.images ?? []);
    setPendingCover(null);
    setPendingPreviewImages([]);
    setPendingDeletedImageIds([]);
    setFiles(product.files ?? []);
    setPendingProductFiles([]);
    setPendingDeletedFileIds([]);
    setPendingFilePreview({});
    setRejectionReason(product.status === 'rejected' ? (product.rejection_reason ?? null) : null);
  }, []);

  useEffect(() => {
    if (!initialProductId) return;
    getManagedProduct(initialProductId)
      .then(({ product }) => hydrate(product))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลสินค้าไม่สำเร็จ')
      )
      .finally(() => setInitializing(false));
  }, [hydrate, initialProductId]);

  const selectedMediaType = mediaTypes.find((item) => item.id === form.mediaTypeId);
  const selectedSaleType = saleTypes.find((item) => item.id === form.saleTypeId);
  const licenseMediaType = mediaTypes.find((item) => item.delivery_mode === 'feature_unlock');
  const isLicenseProduct = form.productKind === 'license';
  const selectedSubscriptionPlan = subscriptionPlans.find(
    (plan) => plan.code === form.grantsPlanCode
  );
  const compatibleSubscriptionPlans = subscriptionPlans.filter(
    (plan) => plan.plan_scope === (form.licenseScope === 'individual' ? 'individual' : 'school')
  );
  const isFileOptional =
    selectedMediaType?.delivery_mode === 'service' ||
    selectedMediaType?.delivery_mode === 'feature_unlock';
  const visibleMediaTypes = mediaTypes.filter((item) => item.delivery_mode !== 'feature_unlock');
  const licenseFeatures =
    form.licenseScope === 'teacher'
      ? SCHOOL_FEATURES.filter((feature) => feature.key.startsWith('teacher.'))
      : form.licenseScope === 'individual'
        ? [...SCHOOL_FEATURES, MARKETPLACE_SELLER_LINE_FEATURE]
        : SCHOOL_FEATURES;
  const isPerpetualLicense = form.grantsFeatureKeys.includes(MARKETPLACE_SELLER_LINE_FEATURE.key);
  const visibleImages = images.filter((image) => !pendingDeletedImageIds.includes(image.id));
  const coverImage = visibleImages.find((image) => image.is_cover) ?? visibleImages[0];
  const previewImages = visibleImages.filter((image) => image.id !== coverImage?.id);
  const visibleFiles = files.filter((file) => !pendingDeletedFileIds.includes(file.id));
  const previewInEnglish = currentLang.value === 'en';
  const previewTitle = (previewInEnglish && form.titleEn.trim()) || form.title;
  const previewShortDescription =
    (previewInEnglish && form.shortDescriptionEn.trim()) || form.shortDescription;
  const selectedSubject =
    subjectOptions.find((item) => item.value === form.subjectLabel) ??
    (form.subjectLabel
      ? {
          value: form.subjectLabel,
          label: form.subjectLabel,
          group: 'รายวิชาในระบบ' as const,
          code: null,
        }
      : null);
  const availableSubjectOptions =
    selectedSubject && !subjectOptions.some((item) => item.value === selectedSubject.value)
      ? [selectedSubject, ...subjectOptions]
      : subjectOptions;

  const readinessItems = [
    {
      label: 'ชื่อสินค้าอย่างน้อย 3 ตัวอักษร',
      completed: form.title.trim().length >= 3,
    },
    {
      label: 'รายละเอียดสินค้าอย่างน้อย 10 ตัวอักษร',
      completed: plainTextLength(form.description) >= 10,
    },
    {
      label: 'เลือกหมวดหมู่สินค้า',
      completed: Boolean(form.category),
    },
    {
      label: isLicenseProduct ? 'ประเภทสื่อ License พร้อมใช้งาน' : 'เลือกประเภทสื่อ',
      completed: Boolean(form.mediaTypeId) && (!isLicenseProduct || Boolean(licenseMediaType)),
    },
    {
      label:
        selectedSaleType?.pricing_mode === 'paid'
          ? `เลือกประเภทการจำหน่ายและระบุราคาอย่างน้อย ${MARKETPLACE_MINIMUM_PAID_PRICE_THB} บาท`
          : 'เลือกประเภทการจำหน่าย',
      completed:
        Boolean(form.saleTypeId) &&
        (selectedSaleType?.pricing_mode !== 'paid' ||
          Number(form.price) >= MARKETPLACE_MINIMUM_PAID_PRICE_THB),
    },
    {
      label: 'เพิ่มภาพปกสินค้า',
      completed: Boolean(pendingCover || coverImage),
    },
    ...(!isFileOptional
      ? [
          {
            label: 'เพิ่มไฟล์หรือลิงก์ส่งมอบอย่างน้อย 1 รายการ',
            completed:
              visibleFiles.length + pendingProductFiles.length > 0 || form.externalLinks.length > 0,
          },
        ]
      : []),
    ...(isLicenseProduct
      ? [
          {
            label: 'เลือกฟีเจอร์ในแพ็กเกจอย่างน้อย 1 รายการ',
            completed: form.grantsFeatureKeys.length > 0,
          },
          {
            label: 'กำหนดระยะเวลาของ License',
            completed: isPerpetualLicense || Number(form.grantDurationDays) > 0,
          },
          ...(form.licenseScope === 'school' &&
          form.grantsFeatureKeys.length === SCHOOL_FEATURES.length
            ? [
                {
                  label: 'กำหนด Plan Code และข้อจำกัดแพ็กเกจทั้งระบบ',
                  completed:
                    Boolean(form.grantsPlanCode.trim()) &&
                    form.licenseMaxTeachers !== '' &&
                    form.licenseMaxStudents !== '' &&
                    form.licenseMaxSchoolAdmins !== '' &&
                    form.licenseLineQuota !== '',
                },
              ]
            : []),
          ...(form.licenseScope === 'teacher'
            ? [
                {
                  label: 'กำหนดจำนวน Seat ครู',
                  completed: Number(form.licenseSeatCount) > 0,
                },
              ]
            : []),
        ]
      : []),
    ...(form.externalLinks.length
      ? [
          {
            label: 'กรอกชื่อและ URL ของลิงก์ส่งมอบให้ถูกต้อง',
            completed: form.externalLinks.every(
              (link) =>
                link.label.trim().length > 0 &&
                link.label.trim().length <= 80 &&
                link.url.trim().length <= 2048 &&
                isValidExternalUrl(link.url.trim())
            ),
          },
        ]
      : []),
  ];
  const requirements = readinessItems.filter((item) => !item.completed).map((item) => item.label);
  const previewPricing = getMarketplacePricing({
    price: form.price,
    list_price: form.listPrice || null,
  });

  const productInput = (submit = false): ProductInput => ({
    title: form.title.trim(),
    titleEn: form.titleEn.trim() || undefined,
    shortDescription: form.shortDescription.trim() || undefined,
    shortDescriptionEn: form.shortDescriptionEn.trim() || undefined,
    description: form.description,
    descriptionEn: form.descriptionEn,
    ...(form.category && { category: form.category }),
    subjectLabel: form.subjectLabel,
    curriculumId: form.curriculumId,
    gradeLevelIds: form.gradeLevelIds,
    tagIds: form.tagIds,
    ...(form.mediaTypeId && { mediaTypeId: form.mediaTypeId }),
    ...(form.saleTypeId && { saleTypeId: form.saleTypeId }),
    price: Number(form.price) || 0,
    listPrice: form.listPrice === '' ? null : Number(form.listPrice),
    grantsFeatureKey: isLicenseProduct ? form.grantsFeatureKeys[0] || undefined : undefined,
    grantsFeatureKeys: isLicenseProduct ? form.grantsFeatureKeys : [],
    grantsPlanCode: isLicenseProduct ? form.grantsPlanCode.trim() || undefined : undefined,
    grantDurationDays:
      isLicenseProduct && form.grantsFeatureKeys.length
        ? isPerpetualLicense
          ? null
          : Number(form.grantDurationDays)
        : undefined,
    licenseScope: form.licenseScope,
    licenseSeatCount: form.licenseScope === 'teacher' ? Number(form.licenseSeatCount) || 1 : 1,
    licenseMaxTeachers:
      isLicenseProduct && form.licenseMaxTeachers !== ''
        ? Number(form.licenseMaxTeachers)
        : undefined,
    licenseMaxStudents:
      isLicenseProduct && form.licenseMaxStudents !== ''
        ? Number(form.licenseMaxStudents)
        : undefined,
    licenseMaxSchoolAdmins:
      isLicenseProduct && form.licenseMaxSchoolAdmins !== ''
        ? Number(form.licenseMaxSchoolAdmins)
        : undefined,
    licenseLineQuota:
      isLicenseProduct && form.licenseLineQuota !== '' ? Number(form.licenseLineQuota) : undefined,
    externalLinks: form.externalLinks.map((link) => ({
      label: link.label.trim(),
      url: link.url.trim(),
    })),
    purchaseBenefits: form.purchaseBenefits.map((item) => item.trim()).filter(Boolean),
    ...(submit && { submit: true }),
  });

  const ensureDraft = async () => {
    if (productId) return productId;
    if (form.title.trim().length < 3) {
      throw new Error('กรุณากรอกชื่อสินค้าอย่างน้อย 3 ตัวอักษรก่อนอัปโหลด');
    }
    const { product } = await createProduct({
      title: form.title.trim(),
      titleEn: form.titleEn.trim() || undefined,
      shortDescription: form.shortDescription.trim() || undefined,
      shortDescriptionEn: form.shortDescriptionEn.trim() || undefined,
      description: form.description,
      descriptionEn: form.descriptionEn,
    });
    setProductId(product.id);
    return product.id;
  };

  const syncPendingImages = async (id: string) => {
    let updatedImages = images;
    setImagesUploading(true);
    try {
      for (const imageId of pendingDeletedImageIds) {
        const result = await deleteProductImage(id, imageId);
        updatedImages = result.images;
        setImages(updatedImages);
        setPendingDeletedImageIds((current) => current.filter((item) => item !== imageId));
      }

      if (pendingCover) {
        const previousImageIds = new Set(updatedImages.map((image) => image.id));
        const uploaded = await uploadProductImages(id, [pendingCover]);
        const uploadedCover = uploaded.images.find((image) => !previousImageIds.has(image.id));
        if (!uploadedCover) throw new Error('ไม่พบภาพปกที่อัปโหลด');
        const result = uploadedCover.is_cover
          ? uploaded
          : await setProductCoverImage(id, uploadedCover.id);
        updatedImages = result.images;
        setImages(updatedImages);
        setPendingCover(null);
      }

      if (pendingPreviewImages.length) {
        const result = await uploadProductImages(id, pendingPreviewImages);
        updatedImages = result.images;
        setImages(updatedImages);
        setPendingPreviewImages([]);
      }

      setImages(updatedImages);
      setPendingCover(null);
      setPendingPreviewImages([]);
      setPendingDeletedImageIds([]);
      return updatedImages;
    } finally {
      setImagesUploading(false);
    }
  };

  const syncPendingFiles = async (id: string) => {
    let updatedFiles = files;
    setFilesUploading(true);
    try {
      for (const fileId of pendingDeletedFileIds) {
        const result = await deleteProductFile(id, fileId);
        updatedFiles = result.files;
        setFiles(updatedFiles);
        setPendingDeletedFileIds((current) => current.filter((item) => item !== fileId));
      }

      const existingPreviewChanges = Object.entries(pendingFilePreview).filter(
        ([fileId]) => !pendingDeletedFileIds.includes(fileId)
      );
      for (const [fileId, isPreview] of existingPreviewChanges) {
        const result = await setProductFilePreview(id, fileId, isPreview);
        updatedFiles = result.files;
        setFiles(updatedFiles);
        setPendingFilePreview((current) => {
          const next = { ...current };
          delete next[fileId];
          return next;
        });
      }

      if (pendingProductFiles.length) {
        const previousIds = new Set(updatedFiles.map((file) => file.id));
        const uploaded = await uploadProductFiles(
          id,
          pendingProductFiles.map((item) => item.file)
        );
        updatedFiles = uploaded.files;
        setFiles(updatedFiles);
        setPendingProductFiles([]);

        const newFiles = updatedFiles.filter((file) => !previousIds.has(file.id));
        const matchedIds = new Set<string>();
        for (const pendingFile of pendingProductFiles.filter((item) => item.isPreview)) {
          const uploadedFile = newFiles.find(
            (file) =>
              !matchedIds.has(file.id) &&
              file.file_name === pendingFile.file.name &&
              Number(file.file_size) === pendingFile.file.size
          );
          if (uploadedFile) {
            matchedIds.add(uploadedFile.id);
            const result = await setProductFilePreview(id, uploadedFile.id, true);
            updatedFiles = result.files;
            setFiles(updatedFiles);
          }
        }
      }

      setFiles(updatedFiles);
      setPendingProductFiles([]);
      setPendingDeletedFileIds([]);
      setPendingFilePreview({});
      return updatedFiles;
    } finally {
      setFilesUploading(false);
    }
  };

  const saveProduct = async (submit = false) => {
    if (form.title.trim().length < 3) {
      setError('กรุณากรอกชื่อสินค้าอย่างน้อย 3 ตัวอักษร');
      return;
    }
    if (
      form.externalLinks.some(
        (link) =>
          !link.label.trim() ||
          link.label.trim().length > 80 ||
          link.url.trim().length > 2048 ||
          !isValidExternalUrl(link.url.trim())
      )
    ) {
      setError('กรุณากรอกชื่อและ URL ของลิงก์ส่งมอบให้ถูกต้อง');
      return;
    }
    if (submit && requirements.length) {
      setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบก่อนส่งตรวจ');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const id = await ensureDraft();
      await updateProduct(id, productInput(false));
      await syncPendingImages(id);
      await syncPendingFiles(id);
      const { product } = submit
        ? await updateProduct(id, productInput(true))
        : await getManagedProduct(id);
      hydrate(product);
      if (submit) {
        router.push('/dashboard/seller');
        return;
      }
      setMessage('บันทึกฉบับร่างเรียบร้อยแล้ว');
      router.replace(`/dashboard/seller/products/${id}/edit`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'บันทึกสินค้าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleCoverDrop = async (dropped: File[]) => {
    const coverFile = dropped[0];
    if (!coverFile) return;
    if (!pendingCover && visibleImages.length + pendingPreviewImages.length >= 10) {
      setError('รูปภาพครบ 10 รูปแล้ว กรุณาลบภาพพรีวิวอย่างน้อย 1 รูปก่อนเปลี่ยนภาพปก');
      return;
    }
    setError('');
    setPendingCover(coverFile);
  };

  const handlePreviewDrop = async (dropped: File[]) => {
    if (!pendingCover && !coverImage) {
      setError('กรุณาเพิ่มภาพปกสินค้าก่อนเพิ่มภาพพรีวิว');
      return;
    }
    const remainingSlots =
      10 - visibleImages.length - pendingPreviewImages.length - (pendingCover ? 1 : 0);
    if (dropped.length > remainingSlots) {
      setError(`เพิ่มรูปภาพได้อีกไม่เกิน ${Math.max(remainingSlots, 0)} รูป`);
      return;
    }
    setError('');
    setPendingPreviewImages((current) => [...current, ...dropped]);
  };

  const handleFileDrop = (dropped: File[]) => {
    if (!dropped.length) return;
    const availableSlots = 20 - visibleFiles.length - pendingProductFiles.length;
    if (dropped.length > availableSlots) {
      setError(`เพิ่มไฟล์สินค้าได้อีกไม่เกิน ${Math.max(availableSlots, 0)} ไฟล์`);
      return;
    }
    setError('');
    setPendingProductFiles((current) => [
      ...current,
      ...dropped.map((file) => ({
        key: crypto.randomUUID(),
        file,
        isPreview: false,
      })),
    ]);
  };

  const handleImageDelete = async (imageId: string) => {
    setPendingDeletedImageIds((current) =>
      current.includes(imageId) ? current : [...current, imageId]
    );
    setError('');
  };

  const handleFileDelete = (fileId: string) => {
    setPendingDeletedFileIds((current) =>
      current.includes(fileId) ? current : [...current, fileId]
    );
    setError('');
  };

  const handleTogglePreview = (fileId: string, isPreview: boolean) => {
    setPendingFilePreview((current) => ({ ...current, [fileId]: isPreview }));
    setError('');
  };

  const handlePendingFileDelete = (key: string) => {
    setPendingProductFiles((current) => current.filter((item) => item.key !== key));
  };

  const handlePendingFilePreview = (key: string, isPreview: boolean) => {
    setPendingProductFiles((current) =>
      current.map((item) => (item.key === key ? { ...item, isPreview } : item))
    );
  };

  const openPendingFile = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  if (initializing) {
    return (
      <Box sx={{ minHeight: 500, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 4 }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Typography component="h1" variant="h3">
              {initialProductId ? 'แก้ไขสินค้า' : 'ลงสินค้าใหม่'}
            </Typography>
            <Chip
              variant="soft"
              color={requirements.length ? 'warning' : 'success'}
              label={requirements.length ? `เหลือ ${requirements.length} รายการ` : 'ข้อมูลครบแล้ว'}
            />
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            กรอกข้อมูลทั้งหมดในหน้าเดียว บันทึกร่างได้ตลอด และส่งตรวจเมื่อพร้อม
          </Typography>
        </Box>
        <Button color="inherit" onClick={() => router.push('/dashboard/seller')}>
          กลับไปร้านค้าของฉัน
        </Button>
      </Stack>

      {!!rejectionReason && (
        <Alert severity="error" sx={{ mb: 3 }}>
          สินค้านี้ไม่ผ่านการอนุมัติ: {rejectionReason}
        </Alert>
      )}
      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {!!message && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}

      <Grid container spacing={3} alignItems="flex-start">
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={{ xs: 2.5, md: 4 }}>
            <FormSection
              number="01"
              title="รายละเอียดสินค้า"
              description="บอกว่าสินค้านี้ช่วยเรื่องอะไร เหมาะกับใคร และใช้อย่างไร"
              icon={<RiFileList3Line />}
            >
              <Stack spacing={2.5}>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box
                      sx={{
                        p: 2,
                        height: 1,
                        borderRadius: 2,
                        bgcolor: 'primary.lighter',
                        border: '1px solid',
                        borderColor: 'primary.light',
                      }}
                    >
                      <Typography variant="subtitle2" color="primary.darker">
                        เขียนในส่วนนี้
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        เนื้อหาเหมาะกับใคร และนำไปใช้สอนอย่างไร
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box
                      sx={{
                        p: 2,
                        height: 1,
                        borderRadius: 2,
                        bgcolor: 'background.neutral',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="subtitle2">ไปเขียนในส่วนที่ 05</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        จำนวนไฟล์ จำนวนหน้า เฉลย และลิงก์ที่ลูกค้าจะได้รับ
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" color="primary" label="TH" />
                  <Typography variant="subtitle1">ข้อมูลภาษาไทย</Typography>
                </Stack>
                <TextField
                  required
                  label="ชื่อสินค้า (ภาษาไทย)"
                  placeholder="เช่น ใบงานคณิตศาสตร์ ป.4 เรื่องเศษส่วน"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
                <TextField
                  label="คำอธิบายสั้น (ภาษาไทย)"
                  placeholder="สรุปจุดเด่นของสินค้าใน 1–2 บรรทัด"
                  value={form.shortDescription}
                  helperText={`${form.shortDescription.length}/150`}
                  slotProps={{ htmlInput: { maxLength: 150 } }}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      shortDescription: event.target.value,
                    }))
                  }
                />
                <Stack spacing={1}>
                  <Typography variant="subtitle2">รายละเอียดสำหรับช่วยตัดสินใจ *</Typography>
                  <Editor
                    value={form.description}
                    onChange={(value) => setForm((current) => ({ ...current, description: value }))}
                    placeholder="เช่น แบบฝึกเรื่องเศษส่วนสำหรับ ป.4 ใช้ทบทวนในชั้นเรียนหรือมอบหมายเป็นการบ้าน"
                    sx={{ minHeight: 220 }}
                  />
                  <Typography
                    variant="caption"
                    color={plainTextLength(form.description) < 10 ? 'error' : 'text.secondary'}
                  >
                    อย่างน้อย 10 ตัวอักษร · ปัจจุบัน {plainTextLength(form.description)} ตัวอักษร
                  </Typography>
                </Stack>

                <Divider />

                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" variant="outlined" label="EN" />
                  <Box>
                    <Typography variant="subtitle1">English information</Typography>
                    <Typography variant="caption" color="text.secondary">
                      ไม่บังคับ · หากไม่กรอก หน้าภาษาอังกฤษจะแสดงข้อมูลภาษาไทย
                    </Typography>
                  </Box>
                </Stack>
                <TextField
                  label="Product name (English)"
                  placeholder="e.g. Grade 4 Fraction Worksheets"
                  value={form.titleEn}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, titleEn: event.target.value }))
                  }
                />
                <TextField
                  label="Short description (English)"
                  placeholder="Summarize the product in 1–2 lines"
                  value={form.shortDescriptionEn}
                  helperText={`${form.shortDescriptionEn.length}/150`}
                  slotProps={{ htmlInput: { maxLength: 150 } }}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      shortDescriptionEn: event.target.value,
                    }))
                  }
                />
                <Stack spacing={1}>
                  <Typography variant="subtitle2">Product description (English)</Typography>
                  <Editor
                    value={form.descriptionEn}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, descriptionEn: value }))
                    }
                    placeholder="Describe the contents, file format, usage, and what buyers receive"
                    sx={{ minHeight: 220 }}
                  />
                </Stack>
              </Stack>
            </FormSection>

            <FormSection
              number="02"
              title="กลุ่มเป้าหมายและการค้นหา"
              description="จัดหมวดหมู่เพื่อให้ครูค้นพบสินค้าได้ง่าย"
              icon={<RiPriceTag3Line />}
            >
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    select
                    label="หมวดหมู่สินค้า"
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, category: event.target.value }))
                    }
                  >
                    <MenuItem value="">เลือกหมวดหมู่</MenuItem>
                    {categories.map((item) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Autocomplete
                    options={availableSubjectOptions}
                    groupBy={(option) => option.group}
                    getOptionLabel={(option) => option.label}
                    isOptionEqualToValue={(option, value) => option.value === value.value}
                    value={selectedSubject}
                    onChange={(_event, selected) =>
                      setForm((current) => ({
                        ...current,
                        subjectLabel: selected?.value ?? '',
                      }))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="รายวิชา / กลุ่มสาระ"
                        placeholder="เลือกจากข้อมูล Master"
                        helperText="ดึงจากรายวิชาและกลุ่มสาระที่เปิดใช้งานใน e-Kru"
                      />
                    )}
                    noOptionsText="ยังไม่มีข้อมูลรายวิชาหรือกลุ่มสาระ"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Autocomplete
                    multiple
                    options={gradeLevels}
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    value={gradeLevels.filter((item) => form.gradeLevelIds.includes(item.id))}
                    onChange={(_event, selected) =>
                      setForm((current) => ({
                        ...current,
                        gradeLevelIds: selected.map((item) => item.id),
                      }))
                    }
                    renderInput={(params) => <TextField {...params} label="ระดับชั้น" />}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    select
                    label="หลักสูตร"
                    value={form.curriculumId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, curriculumId: event.target.value }))
                    }
                  >
                    <MenuItem value="">ไม่ระบุ</MenuItem>
                    {curricula.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={12}>
                  <Autocomplete
                    multiple
                    options={tags}
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    value={tags.filter((item) => form.tagIds.includes(item.id))}
                    onChange={(_event, selected) =>
                      setForm((current) => ({
                        ...current,
                        tagIds: selected.map((item) => item.id),
                      }))
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="แท็ก" placeholder="เลือกคำค้นที่เกี่ยวข้อง" />
                    )}
                  />
                </Grid>
              </Grid>
            </FormSection>

            <FormSection
              number="03"
              title="รูปแบบสินค้าและราคา"
              description="กำหนดวิธีส่งมอบและรูปแบบการจำหน่าย"
              icon={<RiPriceTag3Line />}
            >
              <Grid container spacing={2.5}>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    required
                    select
                    label="รูปแบบสินค้า"
                    value={form.productKind}
                    onChange={(event) => {
                      const productKind = event.target.value as 'resource' | 'license';
                      setForm((current) => ({
                        ...current,
                        productKind,
                        mediaTypeId:
                          productKind === 'license'
                            ? (licenseMediaType?.id ?? '')
                            : current.productKind === 'license'
                              ? ''
                              : current.mediaTypeId,
                        grantsFeatureKeys:
                          productKind === 'license' ? current.grantsFeatureKeys : [],
                      }));
                    }}
                    helperText={
                      isLicenseProduct
                        ? 'ผู้ซื้อจะได้รับสิทธิ์ใช้งานระบบตามระยะเวลา ไม่ได้รับไฟล์ดาวน์โหลด'
                        : 'สินค้าสื่อการสอน ไฟล์ดาวน์โหลด สินค้าจัดส่ง หรือบริการ'
                    }
                  >
                    <MenuItem value="resource">สื่อการสอน / สินค้าทั่วไป</MenuItem>
                    {user?.role === 'master_admin' && (
                      <MenuItem value="license">แพ็กเกจ E-KRU / สิทธิ์ใช้งานระบบ</MenuItem>
                    )}
                  </TextField>
                </Grid>

                {!isLicenseProduct ? (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      required
                      select
                      label="ประเภทสื่อ"
                      value={form.mediaTypeId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          mediaTypeId: event.target.value,
                        }))
                      }
                    >
                      <MenuItem value="">เลือกประเภทสื่อ</MenuItem>
                      {visibleMediaTypes.map((item) => (
                        <MenuItem key={item.id} value={item.id}>
                          {item.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                ) : (
                  <Grid size={12}>
                    <Alert severity={licenseMediaType ? 'info' : 'error'}>
                      {licenseMediaType
                        ? 'สินค้า License จะสร้างสิทธิ์ให้โรงเรียนหลังชำระเงินสำเร็จ และหมดอายุตามจำนวนวันที่กำหนด'
                        : 'ไม่พบประเภทสื่อ License ที่เปิดใช้งาน กรุณาเปิดใช้งานในเมนู Master → ประเภทสื่อ'}
                    </Alert>
                  </Grid>
                )}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    select
                    label="ประเภทการจำหน่าย"
                    value={form.saleTypeId}
                    onChange={(event) => {
                      const selected = saleTypes.find((item) => item.id === event.target.value);
                      setForm((current) => ({
                        ...current,
                        saleTypeId: event.target.value,
                        price: selected?.pricing_mode === 'free' ? '0' : current.price,
                        listPrice: selected?.pricing_mode === 'free' ? '' : current.listPrice,
                      }));
                    }}
                  >
                    <MenuItem value="">เลือกประเภทการจำหน่าย</MenuItem>
                    {saleTypes.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="ราคาขาย (บาท)"
                    value={form.price}
                    disabled={selectedSaleType?.pricing_mode === 'free'}
                    slotProps={{
                      htmlInput: {
                        min:
                          selectedSaleType?.pricing_mode === 'paid'
                            ? MARKETPLACE_MINIMUM_PAID_PRICE_THB
                            : 0,
                        step: 1,
                      },
                    }}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, price: event.target.value }))
                    }
                    error={
                      selectedSaleType?.pricing_mode === 'paid' &&
                      Number(form.price) < MARKETPLACE_MINIMUM_PAID_PRICE_THB
                    }
                    helperText={
                      selectedSaleType?.pricing_mode === 'paid' &&
                      Number(form.price) < MARKETPLACE_MINIMUM_PAID_PRICE_THB
                        ? `ราคาขายหลังส่วนลดต้องไม่น้อยกว่า ${MARKETPLACE_MINIMUM_PAID_PRICE_THB} บาท`
                        : 'ยอดที่ผู้ซื้อชำระจริงหลังส่วนลด'
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="ราคาเต็ม (บาท)"
                    value={form.listPrice}
                    disabled={selectedSaleType?.pricing_mode === 'free'}
                    slotProps={{ htmlInput: { min: Number(form.price) || 0, step: 1 } }}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, listPrice: event.target.value }))
                    }
                    error={
                      form.listPrice !== '' && Number(form.listPrice) < Number(form.price || 0)
                    }
                    helperText={
                      form.listPrice !== '' && Number(form.listPrice) < Number(form.price || 0)
                        ? 'ราคาเต็มต้องไม่น้อยกว่าราคาขาย'
                        : previewPricing.hasDiscount
                          ? `ส่วนลด ${previewPricing.discountPercent}%`
                          : 'เว้นว่างเมื่อไม่มีส่วนลด'
                    }
                  />
                </Grid>
                {selectedSaleType?.pricing_mode === 'paid' && (
                  <Grid size={12}>
                    <Alert severity="info">
                      ราคาขาย {previewPricing.salePrice.toLocaleString('th-TH')} บาท ·
                      ค่าธรรมเนียมแพลตฟอร์ม {commissionRate}% ={' '}
                      {((previewPricing.salePrice * commissionRate) / 100).toLocaleString('th-TH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      บาท · ผู้ขายได้รับประมาณ{' '}
                      {(previewPricing.salePrice * (1 - commissionRate / 100)).toLocaleString(
                        'th-TH',
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}{' '}
                      บาท
                    </Alert>
                  </Grid>
                )}
                {isLicenseProduct && (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        select
                        label="ขอบเขต License"
                        value={form.licenseScope}
                        onChange={(event) => {
                          const licenseScope = event.target.value as
                            | 'individual'
                            | 'school'
                            | 'teacher';
                          setForm((current) => ({
                            ...current,
                            licenseScope,
                            grantsPlanCode: '',
                            grantsFeatureKeys:
                              licenseScope === 'teacher'
                                ? current.grantsFeatureKeys.filter((key) =>
                                    key.startsWith('teacher.')
                                  )
                                : licenseScope === 'school'
                                  ? current.grantsFeatureKeys.filter(
                                      (key) => key !== MARKETPLACE_SELLER_LINE_FEATURE.key
                                    )
                                  : current.grantsFeatureKeys,
                            licenseMaxTeachers: '',
                            licenseMaxStudents: '',
                            licenseMaxSchoolAdmins: '',
                            licenseLineQuota: '',
                          }));
                        }}
                      >
                        <MenuItem value="individual">บุคคล — ไม่ต้องสังกัดโรงเรียน</MenuItem>
                        <MenuItem value="school">ทั้งโรงเรียน</MenuItem>
                        <MenuItem value="teacher">รายครูภายใต้โรงเรียน</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      {isPerpetualLicense ? (
                        <Alert severity="success">License ซื้อขาด · ไม่มีวันหมดอายุ</Alert>
                      ) : (
                        <TextField
                          fullWidth
                          type="number"
                          label="ระยะเวลาปลดล็อก (วัน)"
                          value={form.grantDurationDays}
                          disabled={
                            selectedSubscriptionPlan?.billing_cycle === 'monthly' ||
                            selectedSubscriptionPlan?.billing_cycle === 'yearly'
                          }
                          slotProps={{ htmlInput: { min: 1 } }}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              grantDurationDays: event.target.value,
                            }))
                          }
                        />
                      )}
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      {form.licenseScope === 'school' && (
                        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                grantsFeatureKeys: SCHOOL_FEATURES.map((feature) => feature.key),
                              }))
                            }
                          >
                            เลือกฟีเจอร์ E-KRU ทั้งระบบ
                          </Button>
                        </Stack>
                      )}
                      <Autocomplete
                        multiple
                        disableCloseOnSelect
                        disabled={Boolean(selectedSubscriptionPlan)}
                        options={licenseFeatures}
                        value={licenseFeatures.filter((feature) =>
                          form.grantsFeatureKeys.includes(feature.key)
                        )}
                        getOptionLabel={(option) => `${option.group} · ${option.label}`}
                        isOptionEqualToValue={(option, value) => option.key === value.key}
                        onChange={(_event, values) =>
                          setForm((current) => ({
                            ...current,
                            grantsFeatureKeys: values.map((feature) => feature.key),
                          }))
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            required
                            label="ฟีเจอร์ในแพ็กเกจ"
                            placeholder="เลือกได้หลายฟีเจอร์"
                            helperText={
                              selectedSubscriptionPlan
                                ? `ดึง ${selectedSubscriptionPlan.enabled_features.length} ฟีเจอร์จากแพ็กเกจ ${selectedSubscriptionPlan.name}`
                                : form.licenseScope === 'teacher'
                                  ? 'License รายครูเลือกได้เฉพาะฟีเจอร์สำหรับครู'
                                  : form.licenseScope === 'individual'
                                    ? 'สิทธิ์จะเปิดให้บัญชีผู้ซื้อรายบุคคล'
                                    : 'สิทธิ์จะเปิดให้ผู้ใช้ทั้งโรงเรียน'
                            }
                          />
                        )}
                      />
                    </Grid>
                    {form.licenseScope === 'teacher' && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          type="number"
                          label="จำนวน Seat ครู"
                          value={form.licenseSeatCount}
                          slotProps={{ htmlInput: { min: 1, step: 1 } }}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              licenseSeatCount: event.target.value,
                            }))
                          }
                          helperText="จำนวนครูสูงสุดที่โรงเรียนเพิ่มเข้า License นี้ได้"
                        />
                      </Grid>
                    )}
                    {form.licenseScope !== 'teacher' && (
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          select
                          label="แพ็กเกจจากระบบ E-KRU"
                          value={form.grantsPlanCode}
                          disabled={subscriptionPlansLoading}
                          onChange={(event) => {
                            const plan = compatibleSubscriptionPlans.find(
                              (item) => item.code === event.target.value
                            );
                            setForm((current) =>
                              plan
                                ? {
                                    ...current,
                                    grantsPlanCode: plan.code,
                                    grantsFeatureKeys: plan.enabled_features,
                                    price: String(plan.price),
                                    grantDurationDays:
                                      plan.billing_cycle === 'monthly'
                                        ? '30'
                                        : plan.billing_cycle === 'yearly'
                                          ? '365'
                                          : current.grantDurationDays,
                                    licenseMaxTeachers: String(plan.max_teachers),
                                    licenseMaxStudents: String(plan.max_students),
                                    licenseMaxSchoolAdmins: String(plan.max_school_admins),
                                    licenseLineQuota: String(plan.max_line_notifications),
                                  }
                                : { ...current, grantsPlanCode: '' }
                            );
                          }}
                          helperText={
                            subscriptionPlansError ||
                            (selectedSubscriptionPlan
                              ? `${selectedSubscriptionPlan.code} · ${selectedSubscriptionPlan.billing_cycle === 'monthly' ? 'รายเดือน' : selectedSubscriptionPlan.billing_cycle === 'yearly' ? 'รายปี' : 'กำหนดเอง'} · ${Number(selectedSubscriptionPlan.price).toLocaleString('th-TH')} บาท`
                              : 'เลือกเพื่อดึง Feature และข้อจำกัดจาก subscription_plans อัตโนมัติ')
                          }
                        >
                          <MenuItem value="">ไม่เชื่อมแพ็กเกจ / กำหนดสิทธิ์เอง</MenuItem>
                          {!selectedSubscriptionPlan && form.grantsPlanCode && (
                            <MenuItem value={form.grantsPlanCode}>
                              {form.grantsPlanCode} (ไม่พบหรือปิดใช้งานแล้ว)
                            </MenuItem>
                          )}
                          {compatibleSubscriptionPlans.map((plan) => (
                            <MenuItem key={plan.id} value={plan.code}>
                              {plan.name} ({plan.code})
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                    )}
                    {form.licenseScope === 'school' &&
                      [
                        ['licenseMaxSchoolAdmins', 'จำนวนผู้ดูแลสูงสุด'],
                        ['licenseMaxTeachers', 'จำนวนครูสูงสุด'],
                        ['licenseMaxStudents', 'จำนวนนักเรียนสูงสุด'],
                        ['licenseLineQuota', 'LINE quota'],
                      ].map(([key, label]) => (
                        <Grid key={key} size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            type="number"
                            label={label}
                            disabled={Boolean(selectedSubscriptionPlan)}
                            value={form[key as keyof typeof form] as string}
                            slotProps={{ htmlInput: { min: 0, step: 1 } }}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                [key]: event.target.value,
                              }))
                            }
                          />
                        </Grid>
                      ))}
                  </>
                )}
              </Grid>
            </FormSection>

            <FormSection
              number="04"
              title="รูปภาพสินค้า"
              description="รูปภาพใช้แสดงตัวอย่างและรายละเอียดสินค้าในหน้าร้าน"
              icon={<RiImageAddLine />}
            >
              <Stack spacing={2.5}>
                <Stack
                  spacing={1.5}
                  sx={{
                    p: { xs: 2, md: 2.5 },
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        display: 'grid',
                        borderRadius: 1,
                        placeItems: 'center',
                        color: 'primary.main',
                        bgcolor: 'primary.lighter',
                      }}
                    >
                      <RiImageAddLine size={18} />
                    </Box>
                    <Typography variant="subtitle1">ภาพพรีวิวสินค้า</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    เพิ่มภาพรายละเอียดหรือภาพตัวอย่างที่ผู้ซื้อจะเห็นถัดจากภาพปก · สูงสุด 9 รูป
                  </Typography>
                  <Upload
                    multiple
                    value={pendingPreviewImages}
                    accept={COVER_IMAGE_ACCEPT}
                    maxSize={MAX_COVER_SIZE}
                    loading={imagesUploading}
                    disabled={imagesUploading}
                    onDrop={handlePreviewDrop}
                    onRemove={(file) =>
                      setPendingPreviewImages((current) => current.filter((item) => item !== file))
                    }
                    onRemoveAll={() => setPendingPreviewImages([])}
                    sx={{ height: 170 }}
                  />
                  {!!pendingPreviewImages.length && (
                    <Alert severity="info" variant="outlined">
                      ภาพพรีวิวใหม่ {pendingPreviewImages.length} รูปเป็นไฟล์ชั่วคราว
                      และจะอัปโหลดเมื่อกดบันทึกเท่านั้น
                    </Alert>
                  )}
                  {!!previewImages.length && (
                    <Grid container spacing={1.5}>
                      {previewImages.map((image) => (
                        <Grid key={image.id} size={{ xs: 6, sm: 4, md: 3 }}>
                          <Box
                            sx={{
                              position: 'relative',
                              borderRadius: 1.5,
                              overflow: 'hidden',
                              border: '1px solid',
                              borderColor: 'divider',
                            }}
                          >
                            <Box
                              component="img"
                              src={image.url}
                              alt={image.file_name}
                              sx={{
                                width: '100%',
                                height: 120,
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                            <IconButton
                              size="small"
                              onClick={() => handleImageDelete(image.id)}
                              sx={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                bgcolor: 'background.paper',
                              }}
                            >
                              <RemixIcon icon="mingcute:close-line" width={14} />
                            </IconButton>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Stack>
              </Stack>
            </FormSection>

            <FormSection
              number="05"
              title="ของที่ลูกค้าจะได้รับหลังซื้อ"
              description="ระบุของที่ส่งมอบจริง เช่น ไฟล์ จำนวนหน้า เฉลย หรือลิงก์"
              icon={<RiGiftLine />}
            >
              <Stack spacing={3}>
                <Alert severity="info" variant="outlined">
                  ส่วนนี้ไม่ใช่คำอธิบายสินค้า — ระบุเฉพาะของที่ลูกค้าจะได้รับจริง
                </Alert>

                {!isLicenseProduct && (
                  <Stack
                    spacing={1.5}
                    sx={{
                      p: { xs: 2, md: 2.5 },
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          display: 'grid',
                          borderRadius: 1,
                          placeItems: 'center',
                          color: 'primary.main',
                          bgcolor: 'primary.lighter',
                        }}
                      >
                        <RiFileList3Line size={18} />
                      </Box>
                      <Typography variant="subtitle1">
                        แนบไฟล์ที่จะส่งให้ลูกค้า (เลือกได้)
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, ZIP หรือรูปภาพ ไม่เกิน 50MB ต่อไฟล์
                    </Typography>
                    {isFileOptional && selectedMediaType && (
                      <Alert severity="info" variant="outlined">
                        ประเภทสื่อ “{selectedMediaType.name}” ไม่บังคับอัปโหลดไฟล์
                      </Alert>
                    )}
                    <Upload
                      multiple
                      value={[]}
                      accept={PRODUCT_FILE_ACCEPT}
                      maxSize={MAX_PRODUCT_FILE_SIZE}
                      loading={filesUploading}
                      disabled={filesUploading}
                      onDrop={handleFileDrop}
                      sx={{ height: 170 }}
                    />
                    {!!pendingProductFiles.length && (
                      <Alert severity="info" variant="outlined">
                        ไฟล์ใหม่ {pendingProductFiles.length} ไฟล์ยังไม่ได้อัปโหลดเข้าระบบ
                        สามารถตรวจสอบไฟล์ได้ก่อน แล้วกดบันทึกเพื่อยืนยันการอัปโหลด
                      </Alert>
                    )}
                    {!!pendingProductFiles.length && (
                      <Stack spacing={1}>
                        <Typography variant="subtitle2">ไฟล์ใหม่ (รอบันทึก)</Typography>
                        {pendingProductFiles.map((item) => (
                          <Stack
                            key={item.key}
                            direction={{ xs: 'column', sm: 'row' }}
                            alignItems={{ xs: 'stretch', sm: 'center' }}
                            spacing={1.25}
                            sx={{
                              p: 1.5,
                              border: '1px solid',
                              borderColor: 'primary.light',
                              borderRadius: 1.5,
                              bgcolor: 'primary.lighter',
                            }}
                          >
                            <RemixIcon icon="solar:file-text-bold-duotone" width={22} />
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography variant="body2" noWrap>
                                {item.file.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {(item.file.size / 1024 / 1024).toLocaleString('th-TH', {
                                  maximumFractionDigits: 2,
                                })}{' '}
                                MB · ยังไม่ได้อัปโหลด
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              color="inherit"
                              variant="outlined"
                              startIcon={<RiEyeLine />}
                              onClick={() => openPendingFile(item.file)}
                            >
                              ดูไฟล์
                            </Button>
                            <Chip
                              size="small"
                              label={item.isPreview ? 'ไฟล์ตัวอย่าง' : 'ตั้งเป็นตัวอย่าง'}
                              color={item.isPreview ? 'primary' : 'default'}
                              onClick={() => handlePendingFilePreview(item.key, !item.isPreview)}
                              sx={{ cursor: 'pointer' }}
                            />
                            <IconButton
                              size="small"
                              onClick={() => handlePendingFileDelete(item.key)}
                            >
                              <RemixIcon icon="mingcute:close-line" width={16} />
                            </IconButton>
                          </Stack>
                        ))}
                      </Stack>
                    )}
                    {!!visibleFiles.length && (
                      <Stack spacing={1}>
                        <Typography variant="subtitle2">ไฟล์ที่บันทึกแล้ว</Typography>
                        {visibleFiles.map((file) => {
                          const isPreview = pendingFilePreview[file.id] ?? file.is_preview;
                          return (
                            <Stack
                              key={file.id}
                              direction={{ xs: 'column', sm: 'row' }}
                              alignItems={{ xs: 'stretch', sm: 'center' }}
                              spacing={1.25}
                              sx={{
                                p: 1.5,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1.5,
                              }}
                            >
                              <RemixIcon icon="solar:file-text-bold-duotone" width={22} />
                              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                <Typography variant="body2" noWrap>
                                  {file.file_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {(Number(file.file_size) / 1024 / 1024).toLocaleString('th-TH', {
                                    maximumFractionDigits: 2,
                                  })}{' '}
                                  MB
                                </Typography>
                              </Box>
                              <Button
                                component="a"
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                size="small"
                                color="inherit"
                                variant="outlined"
                                startIcon={<RiEyeLine />}
                              >
                                ดูไฟล์
                              </Button>
                              <Chip
                                size="small"
                                label={isPreview ? 'ไฟล์ตัวอย่าง' : 'ตั้งเป็นตัวอย่าง'}
                                color={isPreview ? 'primary' : 'default'}
                                onClick={() => handleTogglePreview(file.id, !isPreview)}
                                sx={{ cursor: 'pointer' }}
                              />
                              <IconButton size="small" onClick={() => handleFileDelete(file.id)}>
                                <RemixIcon icon="mingcute:close-line" width={16} />
                              </IconButton>
                            </Stack>
                          );
                        })}
                      </Stack>
                    )}
                    {!!pendingDeletedFileIds.length && (
                      <Typography variant="caption" color="warning.dark">
                        มีไฟล์รอลบ {pendingDeletedFileIds.length} ไฟล์ การลบจะมีผลเมื่อกดบันทึก
                      </Typography>
                    )}
                  </Stack>
                )}

                <Stack
                  spacing={1.5}
                  sx={{
                    p: { xs: 2, md: 2.5 },
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        display: 'grid',
                        borderRadius: 1,
                        placeItems: 'center',
                        color: 'primary.main',
                        bgcolor: 'primary.lighter',
                      }}
                    >
                      <RemixIcon icon="eva:link-2-fill" width={18} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1">
                        เพิ่มลิงก์ที่จะส่งให้ลูกค้า (ไม่บังคับ)
                      </Typography>
                    </Box>
                  </Stack>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      เช่น Google Drive, Canva หรือเว็บไซต์สำหรับเข้าใช้งาน · สูงสุด 3 ลิงก์
                    </Typography>
                  </Box>

                  {form.externalLinks.map((link, index) => {
                    const labelError = !link.label.trim() || link.label.trim().length > 80;
                    const urlError = !isValidExternalUrl(link.url.trim());

                    return (
                      <Stack
                        key={`external-link-${index}`}
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                      >
                        <TextField
                          fullWidth
                          label={`ชื่อลิงก์ ${index + 1}`}
                          placeholder="เช่น เปิดไฟล์ Canva"
                          value={link.label}
                          error={labelError}
                          helperText={
                            labelError
                              ? link.label.trim().length > 80
                                ? 'ชื่อลิงก์ต้องไม่เกิน 80 ตัวอักษร'
                                : 'กรุณากรอกชื่อลิงก์'
                              : ' '
                          }
                          slotProps={{ htmlInput: { maxLength: 80 } }}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              externalLinks: current.externalLinks.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, label: event.target.value } : item
                              ),
                            }))
                          }
                        />
                        <TextField
                          fullWidth
                          type="url"
                          label="URL"
                          placeholder="https://example.com"
                          value={link.url}
                          error={urlError}
                          helperText={
                            urlError ? 'กรุณากรอก URL ที่ขึ้นต้นด้วย http:// หรือ https://' : ' '
                          }
                          slotProps={{ htmlInput: { maxLength: 2048 } }}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              externalLinks: current.externalLinks.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, url: event.target.value } : item
                              ),
                            }))
                          }
                        />
                        <IconButton
                          aria-label={`ลบลิงก์ ${index + 1}`}
                          color="error"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              externalLinks: current.externalLinks.filter(
                                (_, itemIndex) => itemIndex !== index
                              ),
                            }))
                          }
                          sx={{ mt: { sm: 1 } }}
                        >
                          <RemixIcon icon="mingcute:close-line" width={18} />
                        </IconButton>
                      </Stack>
                    );
                  })}

                  {form.externalLinks.length < MAX_EXTERNAL_LINKS && (
                    <Button
                      variant="outlined"
                      startIcon={<RiAddLine />}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          externalLinks: [...current.externalLinks, { label: '', url: '' }],
                        }))
                      }
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      เพิ่มลิงก์
                    </Button>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    เพิ่มแล้ว {form.externalLinks.length}/{MAX_EXTERNAL_LINKS} ลิงก์
                  </Typography>
                </Stack>

                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: 'background.neutral',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                    ระบบจะส่งมอบให้อัตโนมัติ
                  </Typography>
                  <Stack spacing={1.25}>
                    {isLicenseProduct ? (
                      <>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <RiCheckboxCircleLine size={20} color="#16A34A" />
                          <Typography variant="body2">
                            เปิดสิทธิ์ License หลังยืนยันการชำระเงินสำเร็จ
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <RiCheckboxCircleLine size={20} color="#16A34A" />
                          <Typography variant="body2">
                            {isPerpetualLicense
                              ? `สิทธิ์ถาวร · ${form.grantsFeatureKeys.length} ฟีเจอร์`
                              : `ใช้งาน ${Number(form.grantDurationDays) || 0} วัน · ${
                                  form.grantsFeatureKeys.length
                                } ฟีเจอร์`}
                          </Typography>
                        </Stack>
                      </>
                    ) : (
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <RiCheckboxCircleLine size={20} color="#16A34A" />
                        <Typography variant="body2">
                          {visibleFiles.length + pendingProductFiles.length > 0
                            ? `ไฟล์สินค้าฉบับเต็ม ${
                                visibleFiles.length + pendingProductFiles.length
                              } ไฟล์ พร้อมดาวน์โหลดจากรายละเอียดการซื้อ`
                            : form.externalLinks.length > 0
                              ? `ลิงก์ส่งมอบ ${form.externalLinks.length} ลิงก์ พร้อมเปิดจากรายละเอียดการซื้อ`
                              : isFileOptional
                                ? 'ผู้ซื้อเข้าดูรายละเอียดและขั้นตอนรับสินค้าหรือบริการได้จากรายการซื้อ'
                                : 'ยังไม่มีสิ่งที่จะส่งมอบ กรุณาเพิ่มไฟล์หรือลิงก์อย่างน้อย 1 รายการ'}
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="subtitle1">สรุปสิ่งที่ลูกค้าจะได้รับ (แนะนำ)</Typography>
                  <Typography variant="body2" color="text.secondary">
                    เขียนสั้น ๆ รายการละ 1 อย่าง เช่น “ไฟล์ PDF 30 หน้า”
                  </Typography>
                </Box>

                <Stack spacing={1.25}>
                  {form.purchaseBenefits.map((benefit, index) => (
                    <Stack
                      key={`purchase-benefit-${index}`}
                      direction="row"
                      spacing={1}
                      alignItems="flex-start"
                    >
                      <TextField
                        fullWidth
                        label={`รายการที่ ${index + 1}`}
                        placeholder="เช่น ไฟล์ PDF พร้อมเฉลย จำนวน 30 หน้า"
                        value={benefit}
                        helperText={`${benefit.length}/120 ตัวอักษร`}
                        slotProps={{ htmlInput: { maxLength: 120 } }}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            purchaseBenefits: current.purchaseBenefits.map((item, itemIndex) =>
                              itemIndex === index ? event.target.value : item
                            ),
                          }))
                        }
                      />
                      <IconButton
                        aria-label={`ลบรายการที่ ${index + 1}`}
                        color="error"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            purchaseBenefits: current.purchaseBenefits.filter(
                              (_, itemIndex) => itemIndex !== index
                            ),
                          }))
                        }
                        sx={{ mt: 1 }}
                      >
                        <RemixIcon icon="mingcute:close-line" width={18} />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>

                {form.purchaseBenefits.length < MAX_PURCHASE_BENEFITS && (
                  <Button
                    variant="outlined"
                    startIcon={<RiAddLine />}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        purchaseBenefits: [...current.purchaseBenefits, ''],
                      }))
                    }
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    เพิ่มรายการที่ลูกค้าจะได้รับ
                  </Button>
                )}
                <Typography variant="caption" color="text.secondary">
                  เพิ่มได้สูงสุด {MAX_PURCHASE_BENEFITS} รายการ
                </Typography>
              </Stack>
            </FormSection>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3} sx={{ position: { lg: 'sticky' }, top: { lg: 96 } }}>
            <Card variant="outlined" sx={{ overflow: 'hidden' }}>
              <Upload
                value={pendingCover ?? coverImage?.url ?? null}
                accept={COVER_IMAGE_ACCEPT}
                maxSize={MAX_COVER_SIZE}
                loading={imagesUploading}
                disabled={imagesUploading}
                onDrop={handleCoverDrop}
                onDelete={
                  pendingCover
                    ? () => setPendingCover(null)
                    : coverImage
                      ? () => {
                          handleImageDelete(coverImage.id);
                        }
                      : undefined
                }
                placeholder={
                  <Stack alignItems="center" spacing={1}>
                    <RiImageAddLine size={48} />
                    <Typography variant="subtitle2">เพิ่มภาพปกสินค้า</Typography>
                    <Typography variant="caption" color="text.secondary">
                      คลิกหรือลากรูปภาพมาวาง
                    </Typography>
                  </Stack>
                }
                helperText={
                  <Typography variant="caption" color="text.secondary">
                    {pendingCover
                      ? 'กำลังแสดงตัวอย่าง · รูปจะอัปโหลดเมื่อกดบันทึก'
                      : coverImage
                        ? 'คลิกที่ภาพเพื่อเปลี่ยนภาพปก · ปุ่ม × สำหรับลบ'
                        : 'PNG, JPEG หรือ WEBP ไม่เกิน 5MB'}
                  </Typography>
                }
                sx={{
                  minHeight: 0,
                  aspectRatio: '16 / 10',
                  border: 0,
                  borderRadius: 0,
                  bgcolor: 'background.neutral',
                }}
              />
              <Box sx={{ p: 2.5 }}>
                <Typography variant="overline" color="text.secondary">
                  ตัวอย่างหน้าสินค้า
                </Typography>
                <Typography variant="h6" sx={{ mt: 0.5 }}>
                  {previewTitle || 'ชื่อสินค้าของคุณ'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, minHeight: 42 }}>
                  {previewShortDescription || 'คำอธิบายสั้นจะแสดงบริเวณนี้'}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
                  <Typography variant="h5" color="primary.main">
                    {selectedSaleType?.pricing_mode === 'free'
                      ? 'ฟรี'
                      : `${previewPricing.salePrice.toLocaleString('th-TH')} บาท`}
                  </Typography>
                  {selectedSaleType?.pricing_mode !== 'free' && previewPricing.hasDiscount && (
                    <>
                      <Typography
                        variant="body2"
                        color="text.disabled"
                        sx={{ textDecoration: 'line-through' }}
                      >
                        {previewPricing.listPrice.toLocaleString('th-TH')} บาท
                      </Typography>
                      <Chip
                        size="small"
                        color="error"
                        label={`ลด ${previewPricing.discountPercent}%`}
                      />
                    </>
                  )}
                </Stack>
              </Box>
            </Card>

            <Card variant="outlined" sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">ความพร้อมของสินค้า</Typography>
                <Chip
                  size="small"
                  color={requirements.length ? 'warning' : 'success'}
                  label={requirements.length ? `เหลือ ${requirements.length}` : 'พร้อมส่ง'}
                />
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={1}>
                {readinessItems.map((item) => (
                  <Stack
                    key={item.label}
                    direction="row"
                    spacing={1.25}
                    alignItems="center"
                    sx={{
                      px: 1.25,
                      py: 1,
                      borderRadius: 1.25,
                      bgcolor: item.completed ? 'success.lighter' : 'background.neutral',
                    }}
                  >
                    {item.completed ? (
                      <RiCheckboxCircleLine size={20} color="var(--palette-success-main)" />
                    ) : (
                      <RiCheckboxBlankCircleLine size={20} color="var(--palette-text-disabled)" />
                    )}
                    <Typography
                      variant="body2"
                      color={item.completed ? 'success.darker' : 'text.secondary'}
                      sx={{ fontWeight: item.completed ? 600 : 400 }}
                    >
                      {item.label}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              {!requirements.length && (
                <Alert severity="success" variant="outlined" sx={{ mt: 2 }}>
                  ข้อมูลครบถ้วน พร้อมส่งให้ผู้ดูแลตรวจสอบ
                </Alert>
              )}

              <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
                เมื่อส่งตรวจ คุณยืนยันว่าสินค้าเป็นไปตาม{' '}
                <Link
                  component={RouterLink}
                  href={paths.legal.productContentPolicy}
                  target="_blank"
                >
                  นโยบายสินค้า
                </Link>
                ,{' '}
                <Link component={RouterLink} href={paths.legal.copyrightTakedown} target="_blank">
                  นโยบายลิขสิทธิ์
                </Link>{' '}
                และ{' '}
                <Link
                  component={RouterLink}
                  href={paths.legal.digitalProductLicense}
                  target="_blank"
                >
                  สิทธิการใช้สินค้าดิจิทัล
                </Link>
              </Alert>

              <Stack spacing={1.25} sx={{ mt: 3 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  loading={saving}
                  startIcon={<RiSaveLine />}
                  onClick={() => saveProduct(false)}
                >
                  บันทึกฉบับร่าง
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  loading={saving}
                  disabled={Boolean(requirements.length)}
                  startIcon={<RiCheckboxCircleLine />}
                  onClick={() => saveProduct(true)}
                >
                  {user?.role === 'master_admin' ? 'เผยแพร่สินค้า' : 'ส่งตรวจอนุมัติ'}
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
                {user?.role === 'master_admin'
                  ? 'สินค้าจากร้านค้าทางการจะเผยแพร่ทันที'
                  : 'สินค้าจะแสดงใน Marketplace หลังผู้ดูแลอนุมัติ'}
              </Typography>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

function FormSection({
  number,
  title,
  description,
  icon,
  children,
}: {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        p: 0,
        overflow: 'hidden',
        borderRadius: 2.5,
        borderColor: 'divider',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
      }}
    >
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 2.5 },
          bgcolor: 'background.neutral',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 48,
              height: 48,
              flexShrink: 0,
              borderRadius: 2,
              color: 'primary.main',
              bgcolor: 'primary.lighter',
              display: 'grid',
              placeItems: 'center',
              border: '1px solid',
              borderColor: 'primary.light',
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              color="primary.main"
              sx={{ display: 'block', lineHeight: 1.4, fontWeight: 700 }}
            >
              SECTION {number}
            </Typography>
            <Typography variant="h5">{title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {description}
            </Typography>
          </Box>
        </Stack>
      </Box>
      <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.paper' }}>{children}</Box>
    </Card>
  );
}
