'use client';

import type { SchedulePeriod } from '../schedule-period-actions';
import type { ScheduleMode } from '../schedule-settings-actions';
import type {
  ClassroomScheduleSlot,
  ClassroomScheduleAssignment,
} from '../schedule-builder-actions';

import { useMemo } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';

import { PeriodScheduleGrid } from './period-schedule-grid';

// ----------------------------------------------------------------------

const DAYS = [
  { value: 1, label: 'วันจันทร์', shortLabel: 'จ.' },
  { value: 2, label: 'วันอังคาร', shortLabel: 'อ.' },
  { value: 3, label: 'วันพุธ', shortLabel: 'พ.' },
  { value: 4, label: 'วันพฤหัสบดี', shortLabel: 'พฤ.' },
  { value: 5, label: 'วันศุกร์', shortLabel: 'ศ.' },
  { value: 6, label: 'วันเสาร์', shortLabel: 'ส.' },
  { value: 7, label: 'วันอาทิตย์', shortLabel: 'อา.' },
];

const ROW_HEIGHT = 108;
const SLOT_COLORS = ['primary', 'secondary', 'error', 'info', 'success', 'warning'] as const;

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function formatMinutes(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getSlotColor(id: string) {
  const hash = [...id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return SLOT_COLORS[hash % SLOT_COLORS.length];
}

type Props = {
  schedules: ClassroomScheduleSlot[];
  assignments: ClassroomScheduleAssignment[];
  periods?: SchedulePeriod[];
  scheduleMode?: ScheduleMode;
  /** Omit for a read-only grid (e.g. the director's review view). */
  onSlotClick?: (slot: ClassroomScheduleSlot) => void;
};

export function ScheduleGrid({
  schedules,
  assignments,
  periods = [],
  scheduleMode = 'hour',
  onSlotClick,
}: Props) {
  const assignmentById = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.id, assignment])),
    [assignments]
  );

  const grid = useMemo(() => {
    const slotsByDay = new Map<number, ClassroomScheduleSlot[]>();
    schedules.forEach((slot) => {
      slotsByDay.set(slot.day_of_week, [...(slotsByDay.get(slot.day_of_week) ?? []), slot]);
    });

    const startMinute =
      Math.floor(
        Math.min(8 * 60, ...schedules.map((slot) => timeToMinutes(slot.start_time))) / 60
      ) * 60;
    const endMinute =
      Math.ceil(Math.max(17 * 60, ...schedules.map((slot) => timeToMinutes(slot.end_time))) / 60) *
      60;
    const totalHours = Math.max(1, (endMinute - startMinute) / 60);
    const timeLabels = Array.from({ length: totalHours }, (_, index) => startMinute + index * 60);
    const visibleDays = DAYS.filter(
      (day) => day.value <= 5 || schedules.some((slot) => slot.day_of_week === day.value)
    );

    return { slotsByDay, visibleDays, timeLabels, startMinute, totalHours };
  }, [schedules]);

  if (scheduleMode === 'period' && periods.length) {
    return (
      <PeriodScheduleGrid
        schedules={schedules}
        assignments={assignments}
        periods={periods}
        onSlotClick={onSlotClick}
      />
    );
  }

  return (
    <Card variant="outlined" sx={{ overflow: 'hidden', borderRadius: 3, boxShadow: 'none' }}>
      <Box sx={{ width: 1, overflowX: 'auto' }}>
        <Box sx={{ minWidth: 640 }}>
          <Box
            sx={{
              height: 58,
              display: 'grid',
              gridTemplateColumns: '104px minmax(0, 1fr)',
              bgcolor: 'background.neutral',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                px: 2,
                display: 'flex',
                alignItems: 'center',
                borderRight: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2">วัน / เวลา</Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${grid.totalHours}, minmax(0, 1fr))`,
              }}
            >
              {grid.timeLabels.map((minute) => (
                <Box
                  key={minute}
                  sx={{
                    px: 1,
                    display: 'flex',
                    alignItems: 'center',
                    borderRight: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    {formatMinutes(minute)} น.
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {grid.visibleDays.map((day) => {
            const daySlots = [...(grid.slotsByDay.get(day.value) ?? [])].sort((a, b) =>
              a.start_time.localeCompare(b.start_time)
            );

            return (
              <Box
                key={day.value}
                sx={{
                  height: ROW_HEIGHT,
                  display: 'grid',
                  gridTemplateColumns: '104px minmax(0, 1fr)',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                <Box
                  sx={{
                    px: 2,
                    display: 'flex',
                    alignItems: 'center',
                    borderRight: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="subtitle2">{day.label}</Typography>
                </Box>

                <Box
                  sx={{
                    position: 'relative',
                    backgroundSize: `${100 / grid.totalHours}% 100%`,
                    backgroundImage: (theme) =>
                      `linear-gradient(to right, transparent calc(100% - 1px), ${theme.vars.palette.divider} calc(100% - 1px))`,
                  }}
                >
                  {!daySlots.length && (
                    <Typography
                      variant="caption"
                      sx={{
                        top: '50%',
                        left: 20,
                        position: 'absolute',
                        color: 'text.disabled',
                        transform: 'translateY(-50%)',
                      }}
                    >
                      ไม่มีคาบสอน
                    </Typography>
                  )}

                  {daySlots.map((slot) => {
                    const start = timeToMinutes(slot.start_time);
                    const end = timeToMinutes(slot.end_time);
                    const left = ((start - grid.startMinute) / (grid.totalHours * 60)) * 100;
                    const width = ((end - start) / (grid.totalHours * 60)) * 100;
                    const assignment = assignmentById.get(slot.teacher_assignment_id);
                    const color = getSlotColor(slot.teacher_assignment_id);
                    const teacherName =
                      `${assignment?.teacher?.first_name ?? ''} ${assignment?.teacher?.last_name ?? ''}`.trim();

                    return (
                      <Card
                        key={slot.id}
                        onClick={onSlotClick ? () => onSlotClick(slot) : undefined}
                        title={
                          onSlotClick
                            ? `${assignment?.subject?.name ?? ''} ครู${teacherName} ${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)} น.${slot.location_name ? ` สถานที่ ${slot.location_name}` : ''} — คลิกเพื่อแก้ไข`
                            : `${assignment?.subject?.name ?? ''} ครู${teacherName} ${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)} น.${slot.location_name ? ` สถานที่ ${slot.location_name}` : ''}`
                        }
                        sx={{
                          top: 10,
                          left: `calc(${left}% + 2px)`,
                          width: `calc(${width}% - 4px)`,
                          height: ROW_HEIGHT - 20,
                          px: 1,
                          py: 0.75,
                          cursor: onSlotClick ? 'pointer' : 'default',
                          display: 'flex',
                          overflow: 'hidden',
                          position: 'absolute',
                          borderRadius: 1.5,
                          color: `${color}.darker`,
                          flexDirection: 'column',
                          justifyContent: 'center',
                          bgcolor: `${color}.lighter`,
                          border: '1px solid',
                          borderColor: `${color}.light`,
                          '&:hover': onSlotClick
                            ? { boxShadow: (theme) => theme.shadows[8] }
                            : undefined,
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          noWrap
                          sx={{ color: 'inherit', fontSize: '0.82rem' }}
                        >
                          {assignment?.subject?.name ?? 'ไม่ระบุวิชา'}
                        </Typography>
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{ color: 'inherit', opacity: 0.82 }}
                        >
                          ครู{teacherName || '-'}
                        </Typography>
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{ color: 'inherit', fontWeight: 700 }}
                        >
                          {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} น.
                        </Typography>
                        {slot.location_name && (
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{ color: 'inherit', opacity: 0.82 }}
                          >
                            สถานที่ {slot.location_name}
                          </Typography>
                        )}
                      </Card>
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Card>
  );
}
