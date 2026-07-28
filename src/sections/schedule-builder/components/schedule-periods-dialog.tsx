'use client';

import type {
  SchedulePeriod,
  SchedulePeriodInput,
} from '../schedule-period-actions';

import dayjs from 'dayjs';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import FormControlLabel from '@mui/material/FormControlLabel';

import { RemixIcon } from 'src/components/remix-icon';

import {
  createSchedulePeriod,
  deleteSchedulePeriod,
  updateSchedulePeriod,
} from '../schedule-period-actions';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  semesterId: string;
  periods: SchedulePeriod[];
  onClose: () => void;
  onChanged: () => Promise<void>;
};

export function SchedulePeriodsDialog({
  open,
  semesterId,
  periods,
  onClose,
  onChanged,
}: Props) {
  const initialNumber =
    Math.max(0, ...periods.map((period) => period.period_number ?? 0)) + 1;
  const initialStart = periods.at(-1)?.end_time.slice(0, 5) ?? '08:30';
  const [editing, setEditing] = useState<SchedulePeriod | null>(null);
  const [periodNumber, setPeriodNumber] = useState(initialNumber);
  const [name, setName] = useState(`คาบที่ ${initialNumber}`);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(
    dayjs(`2000-01-01T${initialStart}`).add(1, 'hour').format('HH:mm')
  );
  const [isBreak, setIsBreak] = useState(false);
  const [deleting, setDeleting] = useState<SchedulePeriod | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    const nextNumber =
      Math.max(0, ...periods.map((period) => period.period_number ?? 0)) + 1;
    const nextStart = periods.at(-1)?.end_time.slice(0, 5) ?? '08:30';
    setEditing(null);
    setPeriodNumber(nextNumber);
    setName(`คาบที่ ${nextNumber}`);
    setStartTime(nextStart);
    setEndTime(dayjs(`2000-01-01T${nextStart}`).add(1, 'hour').format('HH:mm'));
    setIsBreak(false);
    setError(null);
  };

  const beginEdit = (period: SchedulePeriod) => {
    setEditing(period);
    setPeriodNumber(period.period_number ?? 1);
    setName(period.name);
    setStartTime(period.start_time.slice(0, 5));
    setEndTime(period.end_time.slice(0, 5));
    setIsBreak(period.is_break);
    setError(null);
  };

  const save = async () => {
    if (!name.trim() || startTime >= endTime || (!isBreak && periodNumber < 1)) {
      setError('กรุณากรอกข้อมูลคาบเรียนและเวลาให้ถูกต้อง');
      return;
    }

    const input: SchedulePeriodInput = {
      semesterId,
      periodNumber: isBreak ? null : periodNumber,
      name: name.trim(),
      startTime,
      endTime,
      isBreak,
    };

    setSaving(true);
    setError(null);
    try {
      if (editing) await updateSchedulePeriod(editing.id, input);
      else await createSchedulePeriod(input);
      await onChanged();
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ไม่สามารถบันทึกคาบเรียนได้');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    setError(null);
    try {
      await deleteSchedulePeriod(deleting.id);
      await onChanged();
      setDeleting(null);
      if (editing?.id === deleting.id) resetForm();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'ไม่สามารถลบคาบเรียนได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
        <DialogTitle>ตั้งค่าคาบเรียนและเวลา</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box
            sx={{
              p: 2,
              gap: 2,
              display: 'grid',
              borderRadius: 2,
              bgcolor: 'background.neutral',
              gridTemplateColumns: { xs: '1fr', sm: '100px 1fr 1fr', md: '100px 1fr 1fr 1fr auto' },
            }}
          >
            <TextField
              type="number"
              label="คาบที่"
              value={periodNumber}
              disabled={isBreak}
              onChange={(event) => setPeriodNumber(Number(event.target.value))}
              slotProps={{ htmlInput: { min: 1 } }}
            />
            <TextField
              label={isBreak ? 'ชื่อช่วงพัก' : 'ชื่อคาบ'}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={isBreak ? 'พักกลางวัน' : 'คาบที่ 1'}
            />
            <TimePicker
              label="เวลาเริ่ม"
              value={dayjs(`2000-01-01T${startTime}`)}
              onChange={(value) => value?.isValid() && setStartTime(value.format('HH:mm'))}
              ampm={false}
              format="HH:mm"
            />
            <TimePicker
              label="เวลาสิ้นสุด"
              value={dayjs(`2000-01-01T${endTime}`)}
              onChange={(value) => value?.isValid() && setEndTime(value.format('HH:mm'))}
              ampm={false}
              format="HH:mm"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={isBreak}
                  onChange={(event) => {
                    setIsBreak(event.target.checked);
                    if (event.target.checked) setName('พักกลางวัน');
                  }}
                />
              }
              label="ช่วงพัก"
            />
          </Box>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {editing && (
              <Button color="inherit" onClick={resetForm} disabled={saving}>
                ยกเลิกแก้ไข
              </Button>
            )}
            <Button
              variant="contained"
              loading={saving}
              startIcon={<RemixIcon icon={editing ? 'solar:diskette-bold' : 'mingcute:add-line'} />}
              onClick={save}
            >
              {editing ? 'บันทึกการแก้ไข' : 'เพิ่มคาบเรียน'}
            </Button>
          </Box>

          <TableContainer sx={{ mt: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ลำดับ</TableCell>
                  <TableCell>ชื่อ</TableCell>
                  <TableCell>เวลา</TableCell>
                  <TableCell>ประเภท</TableCell>
                  <TableCell align="right">จัดการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!periods.length && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 5, textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        ยังไม่ได้ตั้งค่าคาบเรียน
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {periods.map((period) => (
                  <TableRow key={period.id} hover>
                    <TableCell>{period.is_break ? '-' : period.period_number}</TableCell>
                    <TableCell>{period.name}</TableCell>
                    <TableCell>
                      {period.start_time.slice(0, 5)}–{period.end_time.slice(0, 5)} น.
                    </TableCell>
                    <TableCell>{period.is_break ? 'ช่วงพัก' : 'คาบเรียน'}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => beginEdit(period)}>
                        แก้ไข
                      </Button>
                      <Button size="small" color="error" onClick={() => setDeleting(period)}>
                        ลบ
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose} disabled={saving}>
            ปิด
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleting} onClose={saving ? undefined : () => setDeleting(null)} maxWidth="xs">
        <DialogTitle>ยืนยันการลบคาบเรียน</DialogTitle>
        <DialogContent>
          คาบสอนที่ใช้คาบนี้อยู่จะยังคงเวลาเดิม แต่จะไม่ผูกกับคาบเรียนนี้อีก
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleting(null)} disabled={saving}>
            ยกเลิก
          </Button>
          <Button color="error" variant="contained" loading={saving} onClick={remove}>
            ลบคาบเรียน
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
