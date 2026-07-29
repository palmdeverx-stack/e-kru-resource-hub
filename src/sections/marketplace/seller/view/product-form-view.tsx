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
} from '../../shared/types';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
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

import { useRouter } from 'src/routes/hooks';

import { useTranslate } from 'src/locales';
import { SCHOOL_FEATURES } from 'src/lib/school-subscription-config';

import { Upload } from 'src/components/upload';
import { Editor } from 'src/components/editor';
import {
  RemixIcon,
  RiEyeLine,
  RiSaveLine,
  RiImageAddLine,
  RiFileList3Line,
  RiPriceTag3Line,
  RiCheckboxCircleLine,
  RiCheckboxBlankCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { MARKETPLACE_CATEGORIES } from '../../shared/constants';
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
  grantsFeatureKeys: [] as string[],
  grantsPlanCode: '',
  grantDurationDays: '30',
  licenseScope: 'school' as 'school' | 'teacher',
  licenseSeatCount: '1',
  licenseMaxTeachers: '',
  licenseMaxStudents: '',
  licenseMaxSchoolAdmins: '',
  licenseLineQuota: '',
};

function plainTextLength(html: string) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim().length;
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
  const isFileOptional =
    selectedMediaType?.delivery_mode === 'service' ||
    selectedMediaType?.delivery_mode === 'feature_unlock';
  const visibleMediaTypes = mediaTypes.filter((item) => item.delivery_mode !== 'feature_unlock');
  const licenseFeatures =
    form.licenseScope === 'teacher'
      ? SCHOOL_FEATURES.filter((feature) => feature.key.startsWith('teacher.'))
      : SCHOOL_FEATURES;
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
          ? 'เลือกประเภทการจำหน่ายและระบุราคา'
          : 'เลือกประเภทการจำหน่าย',
      completed:
        Boolean(form.saleTypeId) &&
        (selectedSaleType?.pricing_mode !== 'paid' || Number(form.price) > 0),
    },
    {
      label: 'เพิ่มภาพปกสินค้า',
      completed: Boolean(pendingCover || coverImage),
    },
    ...(!isFileOptional
      ? [
          {
            label: 'อัปโหลดไฟล์สินค้าอย่างน้อย 1 ไฟล์',
            completed: visibleFiles.length + pendingProductFiles.length > 0,
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
            completed: Number(form.grantDurationDays) > 0,
          },
          ...(form.grantsFeatureKeys.length === SCHOOL_FEATURES.length
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
  ];
  const requirements = readinessItems.filter((item) => !item.completed).map((item) => item.label);

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
    grantsFeatureKey: isLicenseProduct ? form.grantsFeatureKeys[0] || undefined : undefined,
    grantsFeatureKeys: isLicenseProduct ? form.grantsFeatureKeys : [],
    grantsPlanCode: isLicenseProduct ? form.grantsPlanCode.trim() || undefined : undefined,
    grantDurationDays:
      isLicenseProduct && form.grantsFeatureKeys.length
        ? Number(form.grantDurationDays)
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
    <Container maxWidth={false} sx={{ py: { xs: 4, md: 6 } }}>
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
          <Stack spacing={3}>
            <FormSection
              number="01"
              title="ข้อมูลสินค้า"
              description="ชื่อและรายละเอียดที่ผู้ซื้อจะเห็นในหน้าสินค้า"
              icon={<RiFileList3Line />}
            >
              <Stack spacing={2.5}>
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
                  <Typography variant="subtitle2">รายละเอียดสินค้า *</Typography>
                  <Editor
                    value={form.description}
                    onChange={(value) => setForm((current) => ({ ...current, description: value }))}
                    placeholder="อธิบายเนื้อหา จำนวนหน้า รูปแบบไฟล์ วิธีใช้งาน และสิ่งที่ผู้ซื้อจะได้รับ"
                    sx={{ minHeight: 260 }}
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
                    label="ชนิดสินค้า"
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
                      <MenuItem value="license">License / Package ระบบ e-KRU</MenuItem>
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
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="ราคา (บาท)"
                    value={form.price}
                    disabled={selectedSaleType?.pricing_mode === 'free'}
                    slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, price: event.target.value }))
                    }
                  />
                </Grid>
                {isLicenseProduct && (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        select
                        label="รูปแบบ License"
                        value={form.licenseScope}
                        onChange={(event) => {
                          const licenseScope = event.target.value as 'school' | 'teacher';
                          setForm((current) => ({
                            ...current,
                            licenseScope,
                            grantsFeatureKeys:
                              licenseScope === 'teacher'
                                ? current.grantsFeatureKeys.filter((key) =>
                                    key.startsWith('teacher.')
                                  )
                                : current.grantsFeatureKeys,
                          }));
                        }}
                      >
                        <MenuItem value="school">ทั้งโรงเรียน</MenuItem>
                        <MenuItem value="teacher">License รายครู</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="ระยะเวลาปลดล็อก (วัน)"
                        value={form.grantDurationDays}
                        slotProps={{ htmlInput: { min: 1 } }}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            grantDurationDays: event.target.value,
                          }))
                        }
                      />
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
                            เลือกฟีเจอร์ eKru ทั้งระบบ
                          </Button>
                        </Stack>
                      )}
                      <Autocomplete
                        multiple
                        disableCloseOnSelect
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
                              form.licenseScope === 'teacher'
                                ? 'License รายครูเลือกได้เฉพาะฟีเจอร์สำหรับครู'
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
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label="Plan Code"
                        value={form.grantsPlanCode}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            grantsPlanCode: event.target.value,
                          }))
                        }
                        helperText="ใช้เชื่อมกับ subscription_plans เช่น FULL_SYSTEM"
                      />
                    </Grid>
                    {[
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
              title={isLicenseProduct ? 'รูปภาพสินค้า' : 'รูปภาพและไฟล์สินค้า'}
              description={
                isLicenseProduct
                  ? 'รูปภาพใช้แสดงรายละเอียด Package และสิทธิ์ที่ผู้ซื้อจะได้รับ'
                  : 'รูปภาพใช้แสดงหน้าร้าน ส่วนไฟล์จะส่งให้ผู้ซื้อหลังชำระเงิน'
              }
              icon={<RiImageAddLine />}
            >
              <Stack spacing={4}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1">ภาพพรีวิวสินค้า</Typography>
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

                {!isLicenseProduct && (
                  <>
                    <Divider />

                    <Stack spacing={1.5}>
                      <Typography variant="subtitle1">
                        ไฟล์สินค้า {isFileOptional ? '(ไม่บังคับ)' : '*'}
                      </Typography>
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
                                    {(Number(file.file_size) / 1024 / 1024).toLocaleString(
                                      'th-TH',
                                      {
                                        maximumFractionDigits: 2,
                                      }
                                    )}{' '}
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
                  </>
                )}
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
                <Typography variant="h5" color="primary.main" sx={{ mt: 1.5 }}>
                  {selectedSaleType?.pricing_mode === 'free'
                    ? 'ฟรี'
                    : `${Number(form.price || 0).toLocaleString('th-TH')} บาท`}
                </Typography>
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
    <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 } }}>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Box
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 2,
            color: 'primary.main',
            bgcolor: 'primary.lighter',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="overline" color="primary.main">
            SECTION {number}
          </Typography>
          <Typography variant="h5">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
      </Stack>
      <Divider sx={{ my: 3 }} />
      {children}
    </Card>
  );
}
