'use client';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Form, Field } from 'src/components/hook-form';
import { RiSendPlaneLine } from 'src/components/remix-icon';

export type FeedbackCategory = 'feature' | 'improvement' | 'bug' | 'blocker' | 'general';

export const FEEDBACK_CATEGORY_OPTIONS: Array<{
  value: FeedbackCategory;
  label: string;
  description: string;
}> = [
  {
    value: 'feature',
    label: 'อยากให้เพิ่มฟีเจอร์',
    description: 'เสนอความสามารถหรือส่วนใหม่ที่ยังไม่มีในระบบ',
  },
  {
    value: 'improvement',
    label: 'อยากให้ปรับแก้',
    description: 'ส่วนเดิมใช้งานได้ แต่อยากให้สะดวกหรือชัดเจนขึ้น',
  },
  { value: 'bug', label: 'พบปัญหา', description: 'ระบบแสดงผลหรือทำงานไม่ถูกต้อง' },
  {
    value: 'blocker',
    label: 'ติดขัดการใช้งาน',
    description: 'มีขั้นตอนที่ทำให้ไม่สามารถทำงานต่อได้',
  },
  { value: 'general', label: 'ความคิดเห็นทั่วไป', description: 'บอกเล่าประสบการณ์ใช้งานระบบ' },
];

const FeedbackSchema = z
  .object({
    category: z.enum(['feature', 'improvement', 'bug', 'blocker', 'general']),
    title: z
      .string()
      .trim()
      .min(3, { error: 'หัวข้อต้องมีอย่างน้อย 3 ตัวอักษร' })
      .max(150, { error: 'หัวข้อต้องไม่เกิน 150 ตัวอักษร' }),
    systemArea: z
      .string()
      .trim()
      .max(100, { error: 'ชื่อส่วนของระบบต้องไม่เกิน 100 ตัวอักษร' }),
    currentBehavior: z
      .string()
      .trim()
      .max(4000, { error: 'รายละเอียดระบบปัจจุบันต้องไม่เกิน 4,000 ตัวอักษร' }),
    requestedChange: z
      .string()
      .trim()
      .max(4000, { error: 'สิ่งที่ต้องการให้ปรับต้องไม่เกิน 4,000 ตัวอักษร' }),
    blockerDetail: z
      .string()
      .trim()
      .max(4000, { error: 'รายละเอียดจุดติดขัดต้องไม่เกิน 4,000 ตัวอักษร' }),
    pageUrl: z.string().trim().max(500, { error: 'URL ต้องไม่เกิน 500 ตัวอักษร' }),
  })
  .superRefine((values, context) => {
    const detailLength =
      values.currentBehavior.length +
      values.requestedChange.length +
      values.blockerDetail.length;
    if (detailLength < 10) {
      context.addIssue({
        code: 'custom',
        path: ['currentBehavior'],
        message: 'กรุณาระบุรายละเอียดรวมอย่างน้อย 10 ตัวอักษร',
      });
    }
  });

type FeedbackFormValues = z.infer<typeof FeedbackSchema>;

const DEFAULT_VALUES: FeedbackFormValues = {
  category: 'feature',
  title: '',
  systemArea: '',
  currentBehavior: '',
  requestedChange: '',
  blockerDetail: '',
  pageUrl: '',
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void | Promise<void>;
};

export function MarketplaceFeedbackDialog({ open, onClose, onSubmitted }: Props) {
  const [submitError, setSubmitError] = useState('');
  const methods = useForm<FeedbackFormValues>({
    resolver: zodResolver(FeedbackSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const {
    reset,
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;
  const selectedCategory = FEEDBACK_CATEGORY_OPTIONS.find(
    (option) => option.value === watch('category')
  );

  useEffect(() => {
    if (!open) return;
    reset(DEFAULT_VALUES);
    setSubmitError('');
  }, [open, reset]);

  const submit = handleSubmit(async (values) => {
    setSubmitError('');
    try {
      const response = await fetch('/api/marketplace/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'ส่ง Feedback ไม่สำเร็จ');
      await onSubmitted();
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'ส่ง Feedback ไม่สำเร็จ');
    }
  });

  const close = () => {
    if (!isSubmitting) onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md">
      <Form methods={methods} onSubmit={submit}>
        <DialogTitle>ส่งความคิดเห็นเกี่ยวกับแพลตฟอร์ม</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Typography variant="body2" color="text.secondary">
              ความคิดเห็นของคุณจะช่วยให้แพลตฟอร์มปรับปรุงการใช้งานได้ดียิ่งขึ้น
              กรุณาระบุขั้นตอนและผลลัพธ์ที่ต้องการให้ชัดเจน
            </Typography>

            <Alert severity="info">
              หากเป็นเรื่องการชำระเงิน การคืนเงิน หรือ Chargeback กรุณาอ่าน{' '}
              <Link
                component={RouterLink}
                href={paths.legal.complaintDisputePolicy}
                target="_blank"
              >
                นโยบายข้อร้องเรียนและข้อพิพาท
              </Link>{' '}
              ก่อนส่งเรื่อง
            </Alert>

            {!!submitError && <Alert severity="error">{submitError}</Alert>}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Field.Select
                name="category"
                required
                label="ประเภท Feedback"
                helperText={selectedCategory?.description}
              >
                {FEEDBACK_CATEGORY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Field.Select>
              <Field.Text
                name="systemArea"
                label="ส่วนของระบบ"
                placeholder="เช่น ตะกร้า, Checkout, ร้านค้า, License"
              />
            </Stack>

            <Field.Text
              name="title"
              required
              label="หัวข้อ"
              placeholder="สรุปเรื่องที่ต้องการแจ้ง"
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Field.Text
                name="currentBehavior"
                multiline
                minRows={4}
                label="ระบบปัจจุบันเป็นอย่างไร"
                placeholder="อธิบายสิ่งที่เห็น ขั้นตอนที่ทำ และผลลัพธ์ที่เกิดขึ้น"
              />
              <Field.Text
                name="requestedChange"
                multiline
                minRows={4}
                label="อยากให้เพิ่มหรือแก้ไขอย่างไร"
                placeholder="อธิบายผลลัพธ์หรือรูปแบบที่ต้องการ"
              />
            </Stack>

            <Field.Text
              name="blockerDetail"
              multiline
              minRows={3}
              label="ติดขัดตรงไหน"
              placeholder="ระบุจุดที่ทำงานต่อไม่ได้ ข้อความ Error หรือสิ่งที่ทำให้สับสน"
            />
            <Field.Text
              name="pageUrl"
              label="URL หน้าที่เกี่ยวข้อง"
              placeholder="/dashboard/..."
              helperText="ไม่บังคับ ห้ามใส่รหัสผ่านหรือข้อมูลลับ"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" disabled={isSubmitting} onClick={() => reset(DEFAULT_VALUES)}>
            ล้างข้อมูล
          </Button>
          <Button color="inherit" disabled={isSubmitting} onClick={close}>
            ยกเลิก
          </Button>
          <Button
            type="submit"
            variant="contained"
            loading={isSubmitting}
            startIcon={<RiSendPlaneLine />}
          >
            ส่ง Feedback
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
