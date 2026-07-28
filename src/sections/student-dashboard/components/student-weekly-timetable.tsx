'use client';

import type { StudentSubjectsDashboard } from '../student-dashboard-actions';
import type { ScheduleMode } from 'src/sections/schedule-builder/schedule-settings-actions';

import { useMemo } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { EmptyCard, displayName, SectionHeading } from '../view/student-dashboard-shared';

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

const ROW_HEIGHT = 92;
const SLOT_COLORS = ['primary', 'secondary', 'error', 'info', 'success', 'warning'] as const;

type Props = {
  schedules: StudentSubjectsDashboard['schedules'];
  scheduleMode: ScheduleMode;
};

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

export function StudentWeeklyTimetable({ schedules, scheduleMode }: Props) {
  const timetable = useMemo(() => {
    const slotsByDay = new Map<number, typeof schedules>();
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

    return {
      slotsByDay,
      startMinute,
      totalHours,
      timeLabels: Array.from({ length: totalHours }, (_, index) => startMinute + index * 60),
      visibleDays: DAYS.filter(
        (day) => day.value <= 5 || schedules.some((slot) => slot.day_of_week === day.value)
      ),
    };
  }, [schedules]);

  const today = new Date().getDay() || 7;

  return (
    <Card variant="outlined" sx={{ overflow: 'hidden', borderRadius: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{
          px: { xs: 1.5, sm: 2.5 },
          py: { xs: 1.5, sm: 2 },
          alignItems: { sm: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ '& > *': { mb: 0 } }}>
          <SectionHeading
            compact
            icon="solar:calendar-date-bold"
            title="ตารางเรียน"
            subtitle={
              schedules.length
                ? `เวลา ${formatMinutes(timetable.startMinute)}–${formatMinutes(timetable.startMinute + timetable.totalHours * 60)} น.`
                : 'ตารางเรียนประจำสัปดาห์'
            }
          />
        </Box>
        {!!schedules.length && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            แสดงเวลาเรียนตลอดสัปดาห์
          </Typography>
        )}
      </Stack>

      {!schedules.length ? (
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <EmptyCard text="ยังไม่มีการกำหนดตารางเรียน" compact />
        </Box>
      ) : (
        <>
          <Box
            aria-label="ตารางเรียนรายสัปดาห์"
            sx={{
              display: { xs: 'block', md: 'none' },
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            {timetable.visibleDays.map((day) => {
              const daySlots = [...(timetable.slotsByDay.get(day.value) ?? [])].sort((a, b) =>
                a.start_time.localeCompare(b.start_time)
              );
              const isToday = day.value === today;

              return (
                <Box
                  component="section"
                  key={day.value}
                  aria-label={day.label}
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: isToday ? 'primary.lighter' : 'background.paper',
                    '&:last-child': { borderBottom: 0 },
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        variant="subtitle1"
                        sx={{ color: isToday ? 'primary.darker' : 'text.primary' }}
                      >
                        {day.label}
                      </Typography>
                      {isToday && <Chip size="small" color="primary" label="วันนี้" />}
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {daySlots.length} คาบ
                    </Typography>
                  </Stack>

                  {daySlots.length ? (
                    <Stack spacing={1} sx={{ mt: 1.25 }}>
                      {daySlots.map((slot) => {
                        const color = getSlotColor(slot.teacher_assignment_id);
                        return (
                          <Box
                            key={slot.id}
                            sx={{
                              p: 1.5,
                              gap: 1.25,
                              minWidth: 0,
                              display: 'grid',
                              borderRadius: 2,
                              alignItems: 'start',
                              bgcolor: 'background.paper',
                              gridTemplateColumns: '68px minmax(0, 1fr)',
                              border: '1px solid',
                              borderColor: 'divider',
                              borderLeft: '4px solid',
                              borderLeftColor: `${color}.main`,
                            }}
                          >
                            <Box
                              sx={{
                                py: 0.75,
                                textAlign: 'center',
                                borderRadius: 1.25,
                                color: `${color}.darker`,
                                bgcolor: `${color}.lighter`,
                              }}
                            >
                              <Typography variant="subtitle2" sx={{ lineHeight: 1.15 }}>
                                {slot.start_time.slice(0, 5)}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: 'inherit', opacity: 0.78 }}
                              >
                                ถึง {slot.end_time.slice(0, 5)}
                              </Typography>
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                                {scheduleMode === 'period' &&
                                slot.schedule_period?.period_number
                                  ? `คาบ ${slot.schedule_period.period_number} · `
                                  : ''}
                                {slot.subject.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ display: 'block', color: 'text.secondary' }}
                              >
                                {slot.subject.code && `${slot.subject.code} · `}ห้อง{' '}
                                {slot.classroom.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ display: 'block', color: 'text.secondary' }}
                              >
                                ครู {displayName(slot.teacher)}
                              </Typography>
                              {slot.location_name && (
                                <Typography
                                  variant="caption"
                                  sx={{ display: 'block', color: 'text.secondary' }}
                                >
                                  สถานที่ {slot.location_name}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ py: 1.5, color: 'text.disabled' }}>
                      ไม่มีคาบเรียน
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>

          <Box
            role="grid"
            aria-label="ตารางเรียนรายสัปดาห์แบบตาราง"
            sx={{
              width: 1,
              overflow: 'hidden',
              borderTop: '1px solid',
              borderColor: 'divider',
              display: { xs: 'none', md: 'block' },
            }}
          >
            <Box
              role="row"
              sx={{
                height: 58,
                display: 'grid',
                gridTemplateColumns: { xs: '64px minmax(0, 1fr)', sm: '104px minmax(0, 1fr)' },
                bgcolor: 'background.neutral',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                role="columnheader"
                sx={{
                  px: { xs: 1, sm: 2 },
                  display: 'flex',
                  alignItems: 'center',
                  borderRight: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontSize: { xs: '0.68rem', sm: '0.82rem' } }}>
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    วัน / เวลา
                  </Box>
                  <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                    วัน
                  </Box>
                </Typography>
              </Box>

              <Box
                sx={{
                  minWidth: 0,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${timetable.totalHours}, minmax(0, 1fr))`,
                }}
              >
                {timetable.timeLabels.map((minute) => (
                  <Box
                    key={minute}
                    role="columnheader"
                    sx={{
                      px: { xs: 0.25, sm: 1 },
                      display: 'flex',
                      alignItems: 'center',
                      borderRight: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        width: 1,
                        fontWeight: 700,
                        color: 'text.secondary',
                        fontSize: { xs: '0.6rem', sm: '0.72rem' },
                        textAlign: { xs: 'center', sm: 'left' },
                      }}
                    >
                      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                        {formatMinutes(minute)} น.
                      </Box>
                      <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                        {String(Math.floor(minute / 60)).padStart(2, '0')}
                      </Box>
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {timetable.visibleDays.map((day) => {
              const daySlots = [...(timetable.slotsByDay.get(day.value) ?? [])].sort((a, b) =>
                a.start_time.localeCompare(b.start_time)
              );
              const isToday = day.value === today;

              return (
                <Box
                  role="row"
                  key={day.value}
                  sx={{
                    height: { xs: 76, sm: ROW_HEIGHT },
                    display: 'grid',
                    gridTemplateColumns: { xs: '64px minmax(0, 1fr)', sm: '104px minmax(0, 1fr)' },
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 0 },
                  }}
                >
                  <Box
                    role="rowheader"
                    sx={{
                      px: { xs: 1, sm: 2 },
                      display: 'flex',
                      alignItems: 'center',
                      bgcolor: isToday ? 'primary.lighter' : 'background.paper',
                      borderRight: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ color: isToday ? 'primary.darker' : 'text.primary' }}
                      >
                        <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                          {day.shortLabel}
                        </Box>
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                          {day.label}
                        </Box>
                      </Typography>
                      {isToday && (
                        <Typography
                          variant="caption"
                          sx={{ color: 'primary.main', fontWeight: 700 }}
                        >
                          วันนี้
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  <Box
                    role="gridcell"
                    sx={{
                      minWidth: 0,
                      position: 'relative',
                      backgroundSize: `${100 / timetable.totalHours}% 100%`,
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
                        ไม่มีคาบเรียน
                      </Typography>
                    )}

                    {daySlots.map((slot) => {
                      const start = timeToMinutes(slot.start_time);
                      const end = timeToMinutes(slot.end_time);
                      const left =
                        ((start - timetable.startMinute) / (timetable.totalHours * 60)) * 100;
                      const width = ((end - start) / (timetable.totalHours * 60)) * 100;
                      const color = getSlotColor(slot.teacher_assignment_id);
                      const title = `${slot.subject.name} เวลา ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)} น. ครู ${displayName(slot.teacher)}`;

                      return (
                        <Card
                          key={slot.id}
                          title={title}
                          aria-label={title}
                          sx={{
                            top: { xs: 7, sm: 10 },
                            left: `calc(${left}% + 2px)`,
                            width: `calc(${width}% - 4px)`,
                            height: { xs: 62, sm: ROW_HEIGHT - 20 },
                            px: { xs: 0.5, sm: 1 },
                            py: { xs: 0.5, sm: 0.75 },
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
                            boxShadow: (theme) => theme.shadows[2],
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            noWrap
                            sx={{ color: 'inherit', fontSize: { xs: '0.62rem', sm: '0.82rem' } }}
                          >
                            {scheduleMode === 'period' && slot.schedule_period?.period_number
                              ? `คาบ ${slot.schedule_period.period_number} · `
                              : ''}
                            {slot.subject.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{
                              color: 'inherit',
                              opacity: 0.82,
                              fontSize: '0.7rem',
                              display: { xs: 'none', sm: 'block' },
                            }}
                          >
                            {slot.subject.code && `${slot.subject.code} · `}ครู{' '}
                            {displayName(slot.teacher)}
                          </Typography>
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{
                              color: 'inherit',
                              fontWeight: 700,
                              fontSize: { xs: '0.52rem', sm: '0.7rem' },
                            }}
                          >
                            {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                              {' '}
                              น. · ห้อง {slot.classroom.name}
                            </Box>
                          </Typography>
                          {slot.location_name && (
                            <Typography
                              variant="caption"
                              noWrap
                              sx={{
                                color: 'inherit',
                                opacity: 0.82,
                                fontSize: { xs: '0.52rem', sm: '0.68rem' },
                              }}
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
        </>
      )}
    </Card>
  );
}
