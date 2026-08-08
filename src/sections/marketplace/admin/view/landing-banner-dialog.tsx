'use client';

import type { MarketplaceLandingBanner } from '../../shared/landing-banner-types';

import * as z from 'zod';
import dayjs from 'dayjs';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Upload } from 'src/components/upload';
import { Form, Field } from 'src/components/hook-form';

function isBannerLink(value: string) {
  if (!value) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const LandingBannerSchema = z
  .object({
    title: z.string().trim().min(3, 'ชื่อแบนเนอร์ต้องมีอย่างน้อย 3 ตัวอักษร').max(150),
    altText: z.string().trim().max(200, 'คำอธิบายรูปต้องไม่เกิน 200 ตัวอักษร'),
    desktopImageUrl: z.string().min(1, 'กรุณาอัปโหลดรูป Desktop'),
    mobileImageUrl: z.string(),
    linkUrl: z
      .string()
      .trim()
      .max(1000)
      .refine(isBannerLink, 'กรุณาใช้ path ภายในระบบ หรือ URL http/https'),
    sortOrder: z.number().int().min(0).max(999),
    isActive: z.boolean(),
    startsAt: z.string().nullable(),
    endsAt: z.string().nullable(),
  })
  .superRefine((values, context) => {
    const startsAt = values.startsAt ? dayjs(values.startsAt) : null;
    const endsAt = values.endsAt ? dayjs(values.endsAt) : null;
    if (startsAt && !startsAt.isValid()) {
      context.addIssue({ code: 'custom', path: ['startsAt'], message: 'วันเวลาเริ่มไม่ถูกต้อง' });
    }
    if (endsAt && !endsAt.isValid()) {
      context.addIssue({ code: 'custom', path: ['endsAt'], message: 'วันเวลาสิ้นสุดไม่ถูกต้อง' });
    }
    if (startsAt?.isValid() && endsAt?.isValid() && !endsAt.isAfter(startsAt)) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'วันเวลาสิ้นสุดต้องอยู่หลังวันเวลาเริ่ม',
      });
    }
  });

type LandingBannerFormValues = z.infer<typeof LandingBannerSchema>;
type ImageVariant = 'desktop' | 'mobile';

const EMPTY_VALUES: LandingBannerFormValues = {
  title: '',
  altText: '',
  desktopImageUrl: '',
  mobileImageUrl: '',
  linkUrl: '',
  sortOrder: 0,
  isActive: false,
  startsAt: null,
  endsAt: null,
};

async function parseResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'ไม่สามารถดำเนินการได้');
  return result;
}

type Props = {
  open: boolean;
  banner: MarketplaceLandingBanner | null;
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
};

export function LandingBannerDialog({ open, banner, onClose, onSaved }: Props) {
  const [uploading, setUploading] = useState<ImageVariant | null>(null);
  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [uploadError, setUploadError] = useState('');

  const methods = useForm<LandingBannerFormValues>({
    resolver: zodResolver(LandingBannerSchema),
    defaultValues: EMPTY_VALUES,
  });
  const {
    reset,
    watch,
    setValue,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;
  const desktopImageUrl = watch('desktopImageUrl');
  const mobileImageUrl = watch('mobileImageUrl');

  useEffect(() => {
    if (!open) return;
    reset(
      banner
        ? {
            title: banner.title,
            altText: banner.alt_text,
            desktopImageUrl: banner.desktop_image_url,
            mobileImageUrl: banner.mobile_image_url ?? '',
            linkUrl: banner.link_url ?? '',
            sortOrder: banner.sort_order,
            isActive: banner.is_active,
            startsAt: banner.starts_at,
            endsAt: banner.ends_at,
          }
        : EMPTY_VALUES
    );
    setDesktopFile(null);
    setMobileFile(null);
    setSubmitError('');
    setUploadError('');
  }, [banner, open, reset]);

  const uploadImage = async (variant: ImageVariant, files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (variant === 'desktop') setDesktopFile(file);
    else setMobileFile(file);
    setUploading(variant);
    setUploadError('');
    try {
      const payload = new FormData();
      payload.set('file', file);
      payload.set('variant', variant);
      const result = await parseResponse(
        await fetch('/api/marketplace/landing-banners/image', { method: 'POST', body: payload })
      );
      setValue(variant === 'desktop' ? 'desktopImageUrl' : 'mobileImageUrl', result.url, {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (variant === 'desktop') setDesktopFile(null);
      else setMobileFile(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploading(null);
    }
  };

  const submit = handleSubmit(async (values) => {
    setSubmitError('');
    try {
      await parseResponse(
        await fetch(
          banner
            ? `/api/marketplace/landing-banners/${banner.id}`
            : '/api/marketplace/landing-banners',
          {
            method: banner ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...values,
              startsAt: values.startsAt ? dayjs(values.startsAt).toISOString() : null,
              endsAt: values.endsAt ? dayjs(values.endsAt).toISOString() : null,
            }),
          }
        )
      );
      await onSaved(banner ? 'แก้ไขแบนเนอร์แล้ว' : 'สร้างแบนเนอร์แล้ว');
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'บันทึกแบนเนอร์ไม่สำเร็จ');
    }
  });

  const close = () => {
    if (!isSubmitting && !uploading) onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md">
      <Form methods={methods} onSubmit={submit}>
        <DialogTitle>{banner ? 'แก้ไขแบนเนอร์หน้าหลัก' : 'เพิ่มแบนเนอร์หน้าหลัก'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} py={2}>
            {!!submitError && <Alert severity="error">{submitError}</Alert>}
            {!!uploadError && <Alert severity="error">{uploadError}</Alert>}

            <Field.Text name="title" required label="ชื่อประกาศหรือข่าวสาร" />
            <Field.Text
              name="altText"
              label="คำอธิบายรูปสำหรับ Accessibility"
              placeholder="เช่น เปิดรับสมัครร้านค้าครู ประจำเดือนสิงหาคม"
            />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                รูป Desktop *
              </Typography>
              <Upload
                value={desktopFile ?? desktopImageUrl ?? null}
                accept={{
                  'image/jpeg': ['.jpg', '.jpeg'],
                  'image/png': ['.png'],
                  'image/webp': ['.webp'],
                }}
                maxSize={5 * 1024 * 1024}
                loading={uploading === 'desktop'}
                disabled={Boolean(uploading) || isSubmitting}
                onDrop={(files) => uploadImage('desktop', files)}
                onDelete={() => {
                  setDesktopFile(null);
                  setValue('desktopImageUrl', '', { shouldDirty: true, shouldValidate: true });
                }}
                onDropRejected={() =>
                  setUploadError('รูป Desktop ต้องเป็น JPG, PNG หรือ WEBP ไม่เกิน 5 MB')
                }
                helperText="แนะนำ 1920 × 620 px · JPG, PNG หรือ WEBP ไม่เกิน 5 MB"
                sx={{ height: 220 }}
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                รูป Mobile (ไม่บังคับ)
              </Typography>
              <Upload
                value={mobileFile ?? mobileImageUrl ?? null}
                accept={{
                  'image/jpeg': ['.jpg', '.jpeg'],
                  'image/png': ['.png'],
                  'image/webp': ['.webp'],
                }}
                maxSize={5 * 1024 * 1024}
                loading={uploading === 'mobile'}
                disabled={Boolean(uploading) || isSubmitting}
                onDrop={(files) => uploadImage('mobile', files)}
                onDelete={() => {
                  setMobileFile(null);
                  setValue('mobileImageUrl', '', { shouldDirty: true });
                }}
                onDropRejected={() =>
                  setUploadError('รูป Mobile ต้องเป็น JPG, PNG หรือ WEBP ไม่เกิน 5 MB')
                }
                helperText="แนะนำ 1080 × 1350 px · หากไม่ใส่ ระบบจะใช้รูป Desktop"
                sx={{ height: 190 }}
              />
            </Box>

            <Field.Text
              name="linkUrl"
              label="ลิงก์เมื่อคลิกแบนเนอร์"
              placeholder="/products หรือ https://..."
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Field.DateTimePicker
                name="startsAt"
                label="เริ่มแสดง"
                slotProps={{ textField: { fullWidth: true } }}
              />
              <Field.DateTimePicker
                name="endsAt"
                label="สิ้นสุด"
                slotProps={{ textField: { fullWidth: true } }}
              />
              <Controller
                name="sortOrder"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="ลำดับ"
                    error={Boolean(error)}
                    helperText={error?.message || 'น้อยแสดงก่อน'}
                    onChange={(event) => field.onChange(Number(event.target.value))}
                    slotProps={{ htmlInput: { min: 0, max: 999, step: 1 } }}
                    sx={{ width: { md: 160 }, flexShrink: 0 }}
                  />
                )}
              />
            </Stack>

            <Field.Switch name="isActive" label="เปิดใช้งานแบนเนอร์" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" disabled={isSubmitting || Boolean(uploading)} onClick={close}>
            ยกเลิก
          </Button>
          <Button
            type="submit"
            variant="contained"
            loading={isSubmitting}
            disabled={Boolean(uploading)}
          >
            บันทึก
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
