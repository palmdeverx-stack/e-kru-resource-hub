'use client';

import type { SchedulePeriod } from '../schedule-period-actions';
import type { ClassroomScheduleSlot, ClassroomScheduleAssignment } from '../schedule-builder-actions';

import dayjs from 'dayjs';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';

// ----------------------------------------------------------------------

const DAY_LABELS = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

type Props = {
  open: boolean;
  assignments: ClassroomScheduleAssignment[];
  periods: SchedulePeriod[];
  editingSlot?: ClassroomScheduleSlot | null;
  onClose: () => void;
  onSubmit: (params: {
    teacherAssignmentId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    locationName: string;
    schedulePeriodId: string;
  }) => Promise<void>;
  onDelete?: (slot: ClassroomScheduleSlot) => void;
};

function assignmentLabel(assignment: ClassroomScheduleAssignment) {
  const subject = assignment.subject?.name ?? 'ไม่ระบุวิชา';
  const teacher = `${assignment.teacher?.first_name ?? ''} ${assignment.teacher?.last_name ?? ''}`.trim();
  return teacher ? `${subject} · ครู${teacher}` : subject;
}

export function ScheduleSlotFormDialog({
  open,
  assignments,
  periods,
  editingSlot = null,
  onClose,
  onSubmit,
  onDelete,
}: Props) {
  const isEdit = !!editingSlot;
  const teachingPeriods = periods.filter((period) => !period.is_break);
  const matchedPeriod = teachingPeriods.find(
    (period) =>
      period.id === editingSlot?.schedule_period_id ||
      (period.start_time.slice(0, 5) === editingSlot?.start_time.slice(0, 5) &&
        period.end_time.slice(0, 5) === editingSlot?.end_time.slice(0, 5))
  );
  const initialPeriod = matchedPeriod ?? teachingPeriods[0];
  const [teacherAssignmentId, setTeacherAssignmentId] = useState(
    editingSlot?.teacher_assignment_id ?? assignments[0]?.id ?? ''
  );
  const [dayOfWeek, setDayOfWeek] = useState(editingSlot?.day_of_week ?? 1);
  const [startTime, setStartTime] = useState(
    editingSlot?.start_time.slice(0, 5) ?? initialPeriod?.start_time.slice(0, 5) ?? '08:00'
  );
  const [endTime, setEndTime] = useState(
    editingSlot?.end_time.slice(0, 5) ?? initialPeriod?.end_time.slice(0, 5) ?? '09:00'
  );
  const [locationName, setLocationName] = useState(editingSlot?.location_name ?? '');
  const [schedulePeriodId, setSchedulePeriodId] = useState(initialPeriod?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const invalidTime = startTime >= endTime;

  const handleSubmit = async () => {
    if (!teacherAssignmentId) {
      setError('กรุณาเลือกวิชา/ครูผู้สอน');
      return;
    }
    if (teachingPeriods.length && !schedulePeriodId) {
      setError('กรุณาเลือกคาบเรียน');
      return;
    }
    if (invalidTime) {
      setError('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSubmit({
        teacherAssignmentId,
        dayOfWeek,
        startTime,
        endTime,
        locationName: locationName.trim(),
        schedulePeriodId,
      });
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : isEdit
            ? 'ไม่สามารถแก้ไขคาบสอนได้'
            : 'ไม่สามารถเพิ่มคาบสอนได้'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={isSaving ? undefined : onClose}>
      <DialogTitle>{isEdit ? 'แก้ไขคาบสอน' : 'เพิ่มคาบสอน'}</DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          select
          fullWidth
          label="วิชา / ครูผู้สอน"
          value={teacherAssignmentId}
          onChange={(event) => setTeacherAssignmentId(event.target.value)}
          sx={{ mt: 1 }}
        >
          {assignments.map((assignment) => (
            <MenuItem key={assignment.id} value={assignment.id}>
              {assignmentLabel(assignment)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          fullWidth
          label="คาบเรียน"
          value={schedulePeriodId}
          onChange={(event) => {
            const nextPeriod = teachingPeriods.find(
              (period) => period.id === event.target.value
            );
            setSchedulePeriodId(event.target.value);
            if (nextPeriod) {
              setStartTime(nextPeriod.start_time.slice(0, 5));
              setEndTime(nextPeriod.end_time.slice(0, 5));
            }
          }}
          helperText={
            teachingPeriods.length
              ? 'เวลาอ้างอิงจากคาบที่ Admin กำหนด'
              : 'ยังไม่ได้ตั้งค่าคาบเรียน กรุณาระบุเวลาด้วยตนเอง'
          }
          sx={{ mt: 2 }}
        >
          {teachingPeriods.map((period) => (
            <MenuItem key={period.id} value={period.id}>
              คาบ {period.period_number} · {period.start_time.slice(0, 5)}–
              {period.end_time.slice(0, 5)} น.
            </MenuItem>
          ))}
        </TextField>

        <TextField
          fullWidth
          label="ห้อง / อาคาร / สถานที่สอน"
          value={locationName}
          onChange={(event) => setLocationName(event.target.value)}
          placeholder="เช่น ห้อง 204, อาคารวิทยาศาสตร์"
          slotProps={{ htmlInput: { maxLength: 200 } }}
          helperText="ไม่บังคับ ระบุได้สูงสุด 200 ตัวอักษร"
          sx={{ mt: 2 }}
        />

        <TextField
          select
          fullWidth
          label="วัน"
          value={dayOfWeek}
          onChange={(event) => setDayOfWeek(Number(event.target.value))}
          sx={{ mt: 2 }}
        >
          {DAY_LABELS.slice(1).map((label, index) => (
            <MenuItem key={label} value={index + 1}>
              {label}
            </MenuItem>
          ))}
        </TextField>

        {!teachingPeriods.length && (
          <>
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
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ justifyContent: isEdit && onDelete ? 'space-between' : 'flex-end' }}>
        {isEdit && onDelete && (
          <Button
            color="error"
            disabled={isSaving}
            onClick={() => editingSlot && onDelete(editingSlot)}
          >
            ลบคาบสอนนี้
          </Button>
        )}
        <Box sx={{ gap: 1, display: 'flex' }}>
          <Button color="inherit" variant="outlined" disabled={isSaving} onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            loading={isSaving}
            disabled={invalidTime || !assignments.length}
            onClick={handleSubmit}
          >
            {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มคาบสอน'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
