'use client';

import type { ScheduleSlot, CreateScheduleParams } from '../../teacher-assignment-actions';

import { memo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { RemixIcon } from 'src/components/remix-icon';

import { ScheduleFormDialog } from './schedule-form-dialog';
import { DAY_LABELS } from './teacher-assignment-detail-types';
import { ScheduleDeleteDialog } from './schedule-delete-dialog';
import {
  getSchedules,
  createSchedule,
  deleteSchedule,
  updateSchedule,
} from '../../teacher-assignment-actions';

type Props = {
  teacherAssignmentId: string;
};

export const ScheduleTab = memo(function ScheduleTab({ teacherAssignmentId }: Props) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleSlot | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<ScheduleSlot | null>(null);

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['schedules', teacherAssignmentId],
    queryFn: () => getSchedules(teacherAssignmentId),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['schedules', teacherAssignmentId] });
  const createMutation = useMutation({
    mutationFn: (params: CreateScheduleParams) => createSchedule(teacherAssignmentId, params),
    onSuccess: refresh,
  });
  const updateMutation = useMutation({
    mutationFn: ({ scheduleId, params }: { scheduleId: string; params: CreateScheduleParams }) =>
      updateSchedule(teacherAssignmentId, scheduleId, params),
    onSuccess: refresh,
  });
  const deleteMutation = useMutation({
    mutationFn: (scheduleId: string) => deleteSchedule(teacherAssignmentId, scheduleId),
    onSuccess: async () => {
      setDeletingSchedule(null);
      await refresh();
    },
  });

  const openCreateDialog = () => {
    setEditingSchedule(null);
    setFormOpen(true);
  };

  const openEditDialog = (schedule: ScheduleSlot) => {
    setEditingSchedule(schedule);
    setFormOpen(true);
  };

  const saveSchedule = async (params: CreateScheduleParams) => {
    if (editingSchedule) {
      await updateMutation.mutateAsync({ scheduleId: editingSchedule.id, params });
      return;
    }
    await createMutation.mutateAsync(params);
  };

  return (
    <>
      <Card variant="outlined" sx={{ overflow: 'hidden', borderRadius: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            p: { xs: 1.5, sm: 2.5 },
            gap: { xs: 1, sm: 2 },
            display: 'flex',
            alignItems: 'center',
            flexDirection: 'row',
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}>
              ตารางเวลาสอน
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              กำหนดวันและเวลาที่สอนรายวิชานี้ในแต่ละสัปดาห์
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<RemixIcon icon="mingcute:add-line" />}
            onClick={openCreateDialog}
            aria-label="เพิ่มคาบสอน"
            sx={{
              minWidth: { xs: 40, sm: 64 },
              px: { xs: 1, sm: 2 },
              '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              เพิ่มคาบสอน
            </Box>
          </Button>
        </Box>

        {deleteMutation.error && (
          <Alert severity="error" sx={{ mx: { xs: 2, sm: 2.5 }, mb: 2 }}>
            {deleteMutation.error.message}
          </Alert>
        )}

        <Divider />
        <Box
          sx={{
            p: 1,
            gap: 0.75,
            display: { xs: 'flex', sm: 'none' },
            flexDirection: 'column',
          }}
        >
          {isLoading && (
            <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
              กำลังโหลด...
            </Typography>
          )}
          {!isLoading && !schedules?.length && (
            <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
              ยังไม่มีคาบสอน
            </Typography>
          )}
          {schedules?.map((slot) => (
            <Box
              key={slot.id}
              sx={{
                p: 1,
                gap: 1,
                display: 'grid',
                border: '1px solid',
                borderRadius: 1.5,
                alignItems: 'center',
                borderColor: 'divider',
                gridTemplateColumns: '44px minmax(0, 1fr) auto',
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  display: 'grid',
                  borderRadius: 1.25,
                  placeItems: 'center',
                  color: 'primary.main',
                  bgcolor: 'primary.lighter',
                }}
              >
                <RemixIcon icon="solar:clock-circle-bold" width={20} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2">วัน{DAY_LABELS[slot.day_of_week]}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} น.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex' }}>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => openEditDialog(slot)}
                  aria-label={`แก้ไขคาบสอนวัน${DAY_LABELS[slot.day_of_week]}`}
                >
                  <RemixIcon icon="solar:pen-bold" width={18} />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => setDeletingSchedule(slot)}
                  aria-label={`ลบคาบสอนวัน${DAY_LABELS[slot.day_of_week]}`}
                >
                  <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
        <TableContainer sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Table sx={{ minWidth: 560 }}>
            <TableHead>
              <TableRow>
                <TableCell>วัน</TableCell>
                <TableCell>เวลาเริ่ม</TableCell>
                <TableCell>เวลาสิ้นสุด</TableCell>
                <TableCell align="right">การจัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4}>กำลังโหลด...</TableCell>
                </TableRow>
              )}
              {!isLoading && !schedules?.length && (
                <TableRow>
                  <TableCell colSpan={4} sx={{ py: 5, textAlign: 'center' }}>
                    <Typography variant="subtitle2">ยังไม่มีคาบสอน</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                      กด “เพิ่มคาบสอน” เพื่อสร้างตารางเวลาสำหรับวิชานี้
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {schedules?.map((slot) => (
                <TableRow key={slot.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">วัน{DAY_LABELS[slot.day_of_week]}</Typography>
                  </TableCell>
                  <TableCell>{slot.start_time.slice(0, 5)} น.</TableCell>
                  <TableCell>{slot.end_time.slice(0, 5)} น.</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => openEditDialog(slot)}
                      aria-label={`แก้ไขคาบสอนวัน${DAY_LABELS[slot.day_of_week]}`}
                    >
                      <RemixIcon icon="solar:pen-bold" width={18} />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeletingSchedule(slot)}
                      aria-label={`ลบคาบสอนวัน${DAY_LABELS[slot.day_of_week]}`}
                    >
                      <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {formOpen && (
        <ScheduleFormDialog
          open
          schedule={editingSchedule}
          onClose={() => setFormOpen(false)}
          onSubmit={saveSchedule}
        />
      )}

      <ScheduleDeleteDialog
        open={Boolean(deletingSchedule)}
        schedule={deletingSchedule}
        isDeleting={deleteMutation.isPending}
        onClose={() => setDeletingSchedule(null)}
        onConfirm={() => {
          if (deletingSchedule) deleteMutation.mutate(deletingSchedule.id);
        }}
      />
    </>
  );
});
