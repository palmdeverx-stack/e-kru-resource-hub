'use client';

import type { HolidayType, SchoolHoliday, HolidayAnnounceMode } from '../school-holiday-actions';

import * as z from 'zod';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { Box, Stack } from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import {
  listSchoolHolidays,
  createSchoolHoliday,
  deleteSchoolHoliday,
  updateSchoolHoliday,
} from '../school-holiday-actions';

// ----------------------------------------------------------------------

const HOLIDAY_TYPE_LABEL: Record<HolidayType, string> = {
  regular: 'หยุดปกติ (ราชการ)',
  urgent: 'หยุดด่วน',
  special: 'หยุดพิเศษ',
};

const HOLIDAY_TYPE_COLOR: Record<HolidayType, 'info' | 'error' | 'warning'> = {
  regular: 'info',
  urgent: 'error',
  special: 'warning',
};

const ANNOUNCE_MODE_LABEL: Record<HolidayAnnounceMode, string> = {
  immediate: 'ทันที (ประกาศเมื่อบันทึก)',
  scheduled: 'ตั้งเวลา (แจ้งล่วงหน้าตามจำนวนวัน)',
};

const HolidaySchema = z.object({
  holidayDate: z.string().min(1, { error: 'กรุณาเลือกวันที่' }),
  name: z.string().trim().min(1, { error: 'กรุณากรอกชื่อวันหยุด' }),
  holidayType: z.enum(['regular', 'urgent', 'special']),
  announceMode: z.enum(['immediate', 'scheduled']),
  // Field.Text type="number" converts the value to a real number on blur
  // (minimal-shared's transformValueOnBlur), but leaves it as '' when empty
  // — so the field is genuinely string | number, not always a string.
  noticeDays: z.union([z.string(), z.number()]),
});

type HolidayFormValues = z.infer<typeof HolidaySchema>;

const DEFAULT_VALUES: HolidayFormValues = {
  holidayDate: '',
  name: '',
  holidayType: 'regular',
  announceMode: 'scheduled',
  noticeDays: '',
};

function formatThaiDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00+07:00`));
}

export function SchoolHolidaysListView() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<SchoolHoliday | null>(null);
  const [deletingHoliday, setDeletingHoliday] = useState<SchoolHoliday | null>(null);

  const {
    data: holidays = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['school-holidays'], queryFn: listSchoolHolidays });

  const methods = useForm<HolidayFormValues>({
    resolver: zodResolver(HolidaySchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { handleSubmit, reset, control } = methods;
  const announceMode = useWatch({ control, name: 'announceMode' });

  const saveMutation = useMutation({
    mutationFn: (data: HolidayFormValues) => {
      const noticeDaysText = String(data.noticeDays).trim();
      const params = {
        holidayDate: dayjs(data.holidayDate).format('YYYY-MM-DD'),
        name: data.name.trim(),
        holidayType: data.holidayType,
        announceMode: data.announceMode,
        noticeDays:
          data.announceMode === 'scheduled' && noticeDaysText ? Number(noticeDaysText) : null,
      };
      return editingHoliday
        ? updateSchoolHoliday(editingHoliday.id, params)
        : createSchoolHoliday(params);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['school-holidays'] });
      setDialogOpen(false);
      setEditingHoliday(null);
      reset(DEFAULT_VALUES);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSchoolHoliday,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['school-holidays'] });
      setDeletingHoliday(null);
    },
  });

  const openCreateDialog = () => {
    setEditingHoliday(null);
    reset(DEFAULT_VALUES);
    saveMutation.reset();
    setDialogOpen(true);
  };

  const openEditDialog = (holiday: SchoolHoliday) => {
    setEditingHoliday(holiday);
    reset({
      holidayDate: holiday.holiday_date,
      name: holiday.name,
      holidayType: holiday.holiday_type,
      announceMode: holiday.announce_mode,
      noticeDays: holiday.notice_days === null ? '' : String(holiday.notice_days),
    });
    saveMutation.reset();
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saveMutation.isPending) return;
    setDialogOpen(false);
    setEditingHoliday(null);
    reset(DEFAULT_VALUES);
    saveMutation.reset();
  };

  const onSubmit = handleSubmit((data) => saveMutation.mutate(data));

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Box
        sx={{
          mb: 4,
          gap: 2,
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            วันหยุดโรงเรียน
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            กำหนดวันหยุดปกติ วันหยุดด่วน และวันหยุดพิเศษ — ระบบจะไม่ส่งแจ้งเตือนขาด/ลา/สาย ผ่าน LINE
            ในวันเหล่านี้ และตั้งให้ประกาศแจ้งล่วงหน้าอัตโนมัติได้
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={openCreateDialog}
          startIcon={<RemixIcon icon="mingcute:add-line" />}
        >
          เพิ่มวันหยุด
        </Button>
      </Box>

      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
          sx={{ mb: 3 }}
        >
          ไม่สามารถโหลดรายการวันหยุดได้
        </Alert>
      )}

      <Card variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 200 }}>วันที่</TableCell>
                <TableCell>ชื่อวันหยุด</TableCell>
                <TableCell sx={{ width: 160 }}>ประเภท</TableCell>
                <TableCell sx={{ width: 200 }}>ประกาศล่วงหน้า</TableCell>
                <TableCell sx={{ width: 110 }} align="right">
                  จัดการ
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5}>กำลังโหลด...</TableCell>
                </TableRow>
              )}
              {!isLoading && !holidays.length && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                  >
                    ยังไม่มีวันหยุดที่กำหนดไว้ กด “เพิ่มวันหยุด” เพื่อเริ่มต้น
                  </TableCell>
                </TableRow>
              )}
              {holidays.map((holiday) => (
                <TableRow key={holiday.id} hover>
                  <TableCell>
                    <Typography variant="body2">{formatThaiDate(holiday.holiday_date)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2">{holiday.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Label variant="soft" color={HOLIDAY_TYPE_COLOR[holiday.holiday_type]}>
                      {HOLIDAY_TYPE_LABEL[holiday.holiday_type]}
                    </Label>
                  </TableCell>
                  <TableCell>
                    {holiday.announce_mode === 'immediate' ? (
                      <Box>
                        <Typography variant="body2">ทันทีเมื่อบันทึก</Typography>
                        <Label
                          variant="soft"
                          color={holiday.announcement_id ? 'success' : 'default'}
                        >
                          {holiday.announcement_id ? 'ประกาศแล้ว' : 'ยังไม่ได้ประกาศ'}
                        </Label>
                      </Box>
                    ) : holiday.notice_days === null ? (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        ไม่ประกาศอัตโนมัติ
                      </Typography>
                    ) : (
                      <Box>
                        <Typography variant="body2">ล่วงหน้า {holiday.notice_days} วัน</Typography>
                        <Label
                          variant="soft"
                          color={holiday.announcement_id ? 'success' : 'default'}
                        >
                          {holiday.announcement_id ? 'ประกาศแล้ว' : 'รอถึงกำหนดประกาศ'}
                        </Label>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="แก้ไข">
                      <IconButton
                        size="small"
                        onClick={() => openEditDialog(holiday)}
                        aria-label={`แก้ไข ${holiday.name}`}
                      >
                        <RemixIcon icon="solar:pen-bold" width={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ลบ">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          deleteMutation.reset();
                          setDeletingHoliday(holiday);
                        }}
                        aria-label={`ลบ ${holiday.name}`}
                      >
                        <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="xs">
        <Form methods={methods} onSubmit={onSubmit}>
          <DialogTitle>{editingHoliday ? 'แก้ไขวันหยุด' : 'เพิ่มวันหยุด'}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Stack sx={{ py: 2 }} spacing={2}>
              {saveMutation.error && <Alert severity="error">{saveMutation.error.message}</Alert>}
              <Field.DatePicker
                name="holidayDate"
                label="วันที่ *"
                format="DD/MM/YYYY"
                slotProps={{ textField: { fullWidth: true } }}
              />
              <Field.Text name="name" label="ชื่อวันหยุด *" placeholder="เช่น วันแม่แห่งชาติ" />
              <Field.Select name="holidayType" label="ประเภทวันหยุด *">
                {(Object.keys(HOLIDAY_TYPE_LABEL) as HolidayType[]).map((type) => (
                  <MenuItem key={type} value={type}>
                    {HOLIDAY_TYPE_LABEL[type]}
                  </MenuItem>
                ))}
              </Field.Select>
              <Field.Select name="announceMode" label="เวลาการประกาศ *">
                {(Object.keys(ANNOUNCE_MODE_LABEL) as HolidayAnnounceMode[]).map((mode) => (
                  <MenuItem key={mode} value={mode}>
                    {ANNOUNCE_MODE_LABEL[mode]}
                  </MenuItem>
                ))}
              </Field.Select>
              {announceMode === 'scheduled' && (
                <Field.Text
                  name="noticeDays"
                  label="ประกาศล่วงหน้ากี่วัน"
                  type="number"
                  helperText="เว้นว่างไว้ถ้าไม่ต้องการให้ประกาศแจ้งอัตโนมัติ"
                  slotProps={{ htmlInput: { min: 0, max: 60, step: 1 } }}
                />
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={closeDialog} disabled={saveMutation.isPending}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="contained" loading={saveMutation.isPending}>
              บันทึก
            </Button>
          </DialogActions>
        </Form>
      </Dialog>

      <Dialog
        open={!!deletingHoliday}
        onClose={() => !deleteMutation.isPending && setDeletingHoliday(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการลบวันหยุด</DialogTitle>
        <DialogContent>
          {deleteMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteMutation.error.message}
            </Alert>
          )}
          <Typography variant="body2">
            ต้องการลบ <strong>{deletingHoliday?.name}</strong> ใช่หรือไม่?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => setDeletingHoliday(null)}
            disabled={deleteMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={deleteMutation.isPending}
            onClick={() => deletingHoliday && deleteMutation.mutate(deletingHoliday.id)}
          >
            ลบวันหยุด
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
