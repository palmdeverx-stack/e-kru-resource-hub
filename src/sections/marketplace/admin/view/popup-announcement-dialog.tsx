'use client';

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
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Upload } from 'src/components/upload';
import { Form, Field } from 'src/components/hook-form';

export type AnnouncementAudience = 'all' | 'authenticated' | 'guests' | 'roles';
export type AnnouncementRole =
  | 'master_admin'
  | 'school_admin'
  | 'teacher'
  | 'student'
  | 'marketplace_user';

export type PopupAnnouncement = {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  link_url: string | null;
  button_label: string | null;
  audience: AnnouncementAudience;
  role_targets: AnnouncementRole[];
  priority: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
};

export const ANNOUNCEMENT_AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  all: 'ทุกคน',
  authenticated: 'ผู้ที่เข้าสู่ระบบ',
  guests: 'ผู้เยี่ยมชม',
  roles: 'เลือกตาม Role',
};

const ROLE_OPTIONS: Array<{ value: AnnouncementRole; label: string }> = [
  { value: 'master_admin', label: 'Super Admin' },
  { value: 'school_admin', label: 'ผู้ดูแลโรงเรียน' },
  { value: 'teacher', label: 'ครู' },
  { value: 'student', label: 'นักเรียน' },
  { value: 'marketplace_user', label: 'ผู้ใช้ Marketplace' },
];

function isHttpUrl(value: string) {
  if (!value) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isAnnouncementLink(value: string) {
  if (!value) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  return isHttpUrl(value);
}

const PopupAnnouncementSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, { error: 'หัวข้อประกาศต้องมีอย่างน้อย 3 ตัวอักษร' })
      .max(150, { error: 'หัวข้อประกาศต้องไม่เกิน 150 ตัวอักษร' }),
    message: z
      .string()
      .trim()
      .min(3, { error: 'รายละเอียดต้องมีอย่างน้อย 3 ตัวอักษร' })
      .max(3000, { error: 'รายละเอียดต้องไม่เกิน 3,000 ตัวอักษร' }),
    imageUrl: z
      .string()
      .trim()
      .max(1000, { error: 'URL รูปภาพยาวเกินไป' })
      .refine(isHttpUrl, { error: 'URL รูปภาพไม่ถูกต้อง' }),
    linkUrl: z
      .string()
      .trim()
      .max(1000, { error: 'ลิงก์ปุ่มยาวเกินไป' })
      .refine(isAnnouncementLink, { error: 'กรุณาใช้ path ภายในระบบ หรือ URL http/https' }),
    buttonLabel: z.string().trim().max(80, { error: 'ข้อความบนปุ่มต้องไม่เกิน 80 ตัวอักษร' }),
    audience: z.enum(['all', 'authenticated', 'guests', 'roles']),
    roleTargets: z.array(
      z.enum(['master_admin', 'school_admin', 'teacher', 'student', 'marketplace_user'])
    ),
    priority: z.number().int({ error: 'ลำดับต้องเป็นจำนวนเต็ม' }).min(0).max(999),
    isActive: z.boolean(),
    startsAt: z.string().nullable(),
    endsAt: z.string().nullable(),
  })
  .superRefine((values, context) => {
    if (values.audience === 'roles' && values.roleTargets.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['roleTargets'],
        message: 'กรุณาเลือก Role อย่างน้อย 1 รายการ',
      });
    }

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

type PopupAnnouncementFormValues = z.infer<typeof PopupAnnouncementSchema>;

const EMPTY_VALUES: PopupAnnouncementFormValues = {
  title: '',
  message: '',
  imageUrl: '',
  linkUrl: '',
  buttonLabel: '',
  audience: 'all',
  roleTargets: [],
  priority: 0,
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
  announcement: PopupAnnouncement | null;
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
};

export function PopupAnnouncementDialog({ open, announcement, onClose, onSaved }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [uploadError, setUploadError] = useState('');

  const methods = useForm<PopupAnnouncementFormValues>({
    resolver: zodResolver(PopupAnnouncementSchema),
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
  const audience = watch('audience');
  const imageUrl = watch('imageUrl');
  const message = watch('message');

  useEffect(() => {
    if (!open) return;
    reset(
      announcement
        ? {
            title: announcement.title,
            message: announcement.message,
            imageUrl: announcement.image_url ?? '',
            linkUrl: announcement.link_url ?? '',
            buttonLabel: announcement.button_label ?? '',
            audience: announcement.audience,
            roleTargets: announcement.role_targets ?? [],
            priority: announcement.priority,
            isActive: announcement.is_active,
            startsAt: announcement.starts_at,
            endsAt: announcement.ends_at,
          }
        : EMPTY_VALUES
    );
    setUploadFile(null);
    setSubmitError('');
    setUploadError('');
  }, [announcement, open, reset]);

  useEffect(() => {
    if (audience !== 'roles') {
      setValue('roleTargets', [], { shouldValidate: false });
    }
  }, [audience, setValue]);

  const uploadImage = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploadFile(file);
    setUploading(true);
    setUploadError('');
    try {
      const payload = new FormData();
      payload.set('file', file);
      const result = await parseResponse(
        await fetch('/api/marketplace/announcements/image', { method: 'POST', body: payload })
      );
      setValue('imageUrl', result.url, { shouldDirty: true, shouldValidate: true });
      setUploadFile(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  };

  const submit = handleSubmit(async (values) => {
    setSubmitError('');
    try {
      await parseResponse(
        await fetch(
          announcement
            ? `/api/marketplace/announcements/${announcement.id}`
            : '/api/marketplace/announcements',
          {
            method: announcement ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...values,
              startsAt: values.startsAt ? dayjs(values.startsAt).toISOString() : null,
              endsAt: values.endsAt ? dayjs(values.endsAt).toISOString() : null,
            }),
          }
        )
      );
      await onSaved(announcement ? 'แก้ไขประกาศแล้ว' : 'สร้างประกาศแล้ว');
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'บันทึกประกาศไม่สำเร็จ');
    }
  });

  const close = () => {
    if (!isSubmitting && !uploading) onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md">
      <Form methods={methods} onSubmit={submit}>
        <DialogTitle>{announcement ? 'แก้ไขประกาศ' : 'สร้างประกาศ'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} py={2}>
            {!!submitError && <Alert severity="error">{submitError}</Alert>}

            <Field.Text name="title" required label="หัวข้อประกาศ" />
            <Field.Text
              name="message"
              required
              multiline
              minRows={4}
              label="รายละเอียด"
              helperText={`${message.length}/3,000 ตัวอักษร`}
            />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                รูป Banner
              </Typography>
              <Upload
                value={uploadFile ?? imageUrl ?? null}
                accept={{
                  'image/jpeg': ['.jpg', '.jpeg'],
                  'image/png': ['.png'],
                  'image/webp': ['.webp'],
                }}
                maxSize={5 * 1024 * 1024}
                loading={uploading}
                disabled={uploading || isSubmitting}
                onDrop={uploadImage}
                onDelete={() => {
                  setUploadFile(null);
                  setValue('imageUrl', '', { shouldDirty: true, shouldValidate: true });
                }}
                onDropRejected={() =>
                  setUploadError('รองรับเฉพาะ JPG, PNG หรือ WEBP ขนาดไม่เกิน 5 MB')
                }
                helperText={
                  uploadError || 'ลากรูปมาวาง หรือกดเลือกไฟล์ · JPG, PNG, WEBP ไม่เกิน 5 MB'
                }
                error={Boolean(uploadError)}
                sx={{ height: 190 }}
              />
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Field.Text
                name="linkUrl"
                label="ลิงก์ปุ่ม"
                placeholder="/products หรือ https://..."
              />
              <Field.Text name="buttonLabel" label="ข้อความบนปุ่ม" placeholder="ดูรายละเอียด" />
            </Stack>

            <Field.Select name="audience" label="กลุ่มผู้ชม">
              {Object.entries(ANNOUNCEMENT_AUDIENCE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Field.Select>

            {audience === 'roles' && (
              <Field.MultiSelect
                checkbox
                name="roleTargets"
                label="Role ที่เห็นประกาศ"
                options={ROLE_OPTIONS}
              />
            )}

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
                name="priority"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="ลำดับ"
                    error={Boolean(error)}
                    helperText={error?.message || 'มากแสดงก่อน'}
                    onChange={(event) => field.onChange(Number(event.target.value))}
                    slotProps={{ htmlInput: { min: 0, max: 999, step: 1 } }}
                    sx={{ width: { md: 160 }, flexShrink: 0 }}
                  />
                )}
              />
            </Stack>

            <Field.Switch name="isActive" label="เปิดใช้งานประกาศ" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" disabled={isSubmitting || uploading} onClick={close}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="contained" loading={isSubmitting} disabled={uploading}>
            บันทึก
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
