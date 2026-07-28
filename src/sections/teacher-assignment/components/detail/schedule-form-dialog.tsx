'use client';

import type { ScheduleSlot, CreateScheduleParams } from '../../teacher-assignment-actions';

import dayjs from 'dayjs';
import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';

import { DAY_LABELS } from './teacher-assignment-detail-types';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  schedule?: ScheduleSlot | null;
  onClose: () => void;
  onSubmit: (params: CreateScheduleParams) => Promise<void>;
};

export function ScheduleFormDialog({ open, schedule, onClose, onSubmit }: Props) {
  const [dayOfWeek, setDayOfWeek] = useState(schedule?.day_of_week ?? 1);
  const [startTime, setStartTime] = useState(schedule?.start_time.slice(0, 5) ?? '08:00');
  const [endTime, setEndTime] = useState(schedule?.end_time.slice(0, 5) ?? '09:00');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = Boolean(schedule);
  const invalidTime = startTime >= endTime;

  const handleSubmit = async () => {
    if (invalidTime) {
      setError('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSubmit({ dayOfWeek, startTime, endTime });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ไม่สามารถบันทึกคาบสอนได้');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={isSaving ? undefined : onClose}>
      <DialogTitle>{isEditing ? 'แก้ไขคาบสอน' : 'เพิ่มคาบสอน'}</DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          select
          fullWidth
          label="วัน"
          value={dayOfWeek}
          onChange={(event) => setDayOfWeek(Number(event.target.value))}
          sx={{ mt: 1 }}
        >
          {DAY_LABELS.slice(1).map((label, index) => (
            <MenuItem key={label} value={index + 1}>
              {label}
            </MenuItem>
          ))}
        </TextField>

        <TimePicker
          label="เวลาเริ่ม"
          value={dayjs(`2000-01-01T${startTime}`)}
          onChange={(value) => {
            if (value?.isValid()) {
              setStartTime(value.format('HH:mm'));
              setError(null);
            }
          }}
          ampm={false}
          format="HH:mm"
          slotProps={{ textField: { fullWidth: true } }}
          sx={{ mt: 2 }}
        />

        <TimePicker
          label="เวลาสิ้นสุด"
          value={dayjs(`2000-01-01T${endTime}`)}
          onChange={(value) => {
            if (value?.isValid()) {
              setEndTime(value.format('HH:mm'));
              setError(null);
            }
          }}
          ampm={false}
          format="HH:mm"
          slotProps={{
            textField: {
              fullWidth: true,
              error: invalidTime,
              helperText: invalidTime ? 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น' : undefined,
            },
          }}
          sx={{ mt: 2 }}
        />
      </DialogContent>

      <DialogActions>
        <Button color="inherit" variant="outlined" disabled={isSaving} onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          loading={isSaving}
          disabled={invalidTime}
          onClick={handleSubmit}
        >
          {isEditing ? 'บันทึกการแก้ไข' : 'เพิ่มคาบสอน'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
