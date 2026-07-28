'use client';

import type { AcademicYear } from '../academic-year-actions';

import * as z from 'zod';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { createAcademicYear, updateAcademicYear } from '../academic-year-actions';

// ----------------------------------------------------------------------

const AcademicYearSchema = z
  .object({
    year: z
      .string()
      .trim()
      .min(1, { error: 'กรุณากรอกปีการศึกษา!' })
      .regex(/^\d{4}$/, { error: 'กรุณากรอกปีการศึกษาเป็นตัวเลข 4 หลัก!' }),
    startDate: z.string().min(1, { error: 'กรุณาเลือกวันที่เริ่มต้น!' }),
    endDate: z.string().min(1, { error: 'กรุณาเลือกวันที่สิ้นสุด!' }),
  })
  .refine(
    (data) =>
      !data.startDate ||
      !data.endDate ||
      dayjs(data.endDate).isAfter(data.startDate) ||
      dayjs(data.endDate).isSame(data.startDate, 'day'),
    {
      path: ['endDate'],
      error: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น!',
    }
  );

type Props = {
  open: boolean;
  academicYear: AcademicYear | null;
  onClose: () => void;
};

const DEFAULT_VALUES = { year: '', startDate: '', endDate: '' };

export function AcademicYearFormDialog({ open, academicYear, onClose }: Props) {
  const queryClient = useQueryClient();
  const methods = useForm({
    resolver: zodResolver(AcademicYearSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { handleSubmit, reset, control } = methods;
  const startDate = useWatch({ control, name: 'startDate' });

  const saveMutation = useMutation({
    mutationFn: (data: z.infer<typeof AcademicYearSchema>) => {
      const values = {
        year: data.year.trim(),
        startDate: dayjs(data.startDate).format('YYYY-MM-DD'),
        endDate: dayjs(data.endDate).format('YYYY-MM-DD'),
      };

      return academicYear
        ? updateAcademicYear(academicYear.id, values)
        : createAcademicYear(values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;

    reset(
      academicYear
        ? {
            year: academicYear.year,
            startDate: academicYear.start_date ?? '',
            endDate: academicYear.end_date ?? '',
          }
        : DEFAULT_VALUES
    );
  }, [academicYear, open, reset]);

  const handleClose = () => {
    if (saveMutation.isPending) return;
    saveMutation.reset();
    onClose();
  };

  const onSubmit = handleSubmit((data) => saveMutation.mutate(data));

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box>
              <Typography component="h2" variant="h6">
                {academicYear ? 'แก้ไขปีการศึกษา' : 'เพิ่มปีการศึกษา'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                {academicYear
                  ? 'ปรับปีและช่วงเวลาของปีการศึกษา'
                  : 'สร้างปีการศึกษาใหม่สำหรับจัดกลุ่มภาคเรียน'}
              </Typography>
            </Box>
            <IconButton
              onClick={handleClose}
              disabled={saveMutation.isPending}
              aria-label="ปิดหน้าต่าง"
            >
              <RemixIcon icon="mingcute:close-line" />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Stack sx={{ py: 2 }}>
            {saveMutation.error && (
              <Alert severity="error" sx={{ mb: 2.5 }}>
                {saveMutation.error.message}
              </Alert>
            )}
            <Field.Text
              name="year"
              label="ปีการศึกษา *"
              placeholder="เช่น 2569"
              helperText="กรอกเป็นตัวเลข พ.ศ. 4 หลัก"
              autoFocus
              slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 4 } }}
            />
            <Box
              sx={{
                gap: 2,
                mt: 2.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              }}
            >
              <Field.DatePicker
                name="startDate"
                label="วันที่เริ่มต้น"
                format="DD/MM/YYYY"
                required
                slotProps={{ textField: { fullWidth: true, helperText: 'วันเปิดปีการศึกษา' } }}
              />
              <Field.DatePicker
                name="endDate"
                label="วันที่สิ้นสุด"
                format="DD/MM/YYYY"
                required
                minDate={startDate ? dayjs(startDate) : undefined}
                slotProps={{ textField: { fullWidth: true, helperText: 'วันปิดปีการศึกษา' } }}
              />
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button color="inherit" onClick={handleClose} disabled={saveMutation.isPending}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="contained" loading={saveMutation.isPending}>
            {academicYear ? 'บันทึกการแก้ไข' : 'เพิ่มปีการศึกษา'}
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
