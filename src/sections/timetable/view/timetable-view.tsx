'use client';

import type { TimetableSlot } from '../timetable-actions';

import { useMemo } from 'react';
import { varAlpha } from 'minimal-shared/utils';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';

import { getScheduleMode } from 'src/sections/schedule-builder/schedule-settings-actions';

import { getTimetable } from '../timetable-actions';

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

export function TimetableView() {
  const { data: scheduleMode = 'hour' } = useQuery({
    queryKey: ['schedule-mode'],
    queryFn: getScheduleMode,
  });
  const {
    data: schedules = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['teacher-timetable'],
    queryFn: getTimetable,
  });

  const timetable = useMemo(() => {
    const slotsByDay = new Map<number, TimetableSlot[]>();

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
    const teachingDays = new Set(schedules.map((slot) => slot.day_of_week)).size;
    const weeklyMinutes = schedules.reduce(
      (total, slot) => total + timeToMinutes(slot.end_time) - timeToMinutes(slot.start_time),
      0
    );
    const visibleDays = DAYS.filter(
      (day) => day.value <= 5 || schedules.some((slot) => slot.day_of_week === day.value)
    );
    const terms = Array.from(
      new Set(
        schedules.map((slot) => {
          const year = slot.teacher_assignment.classroom?.academic_years?.year;
          const semester = slot.teacher_assignment.semester?.name;
          return [semester, year && `ปีการศึกษา ${year}`].filter(Boolean).join(' · ');
        })
      )
    ).filter(Boolean);

    return {
      terms,
      slotsByDay,
      visibleDays,
      timeLabels,
      startMinute,
      totalHours,
      teachingDays,
      weeklyHours: weeklyMinutes / 60,
    };
  }, [schedules]);

  const today = new Date().getDay() || 7;

  return (
    <Container maxWidth={false} sx={{ px: { xs: 1.5, sm: 3 }, pb: { xs: 3, sm: 5 } }}>
      <Box
        sx={{
          p: { xs: 1.5, sm: 2.5, md: 4 },
          mb: { xs: 2, sm: 3 },
          gap: { xs: 2, sm: 3 },
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: { xs: 2.5, sm: 3 },
          color: 'common.white',
          background: (theme) =>
            `linear-gradient(135deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.main} 62%, ${theme.vars.palette.primary.light} 100%)`,
        }}
      >
        <Box>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: { xs: 0.5, sm: 1 } }}>
            <RemixIcon icon="solar:calendar-date-bold" width={24} />
            <Typography
              component="h1"
              variant="h3"
              sx={{ fontSize: { xs: '1.4rem', sm: '2rem', md: '2.5rem' } }}
            >
              ตารางสอนของฉัน
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            sx={(theme) => ({
              color: varAlpha(theme.vars.palette.common.whiteChannel, 0.78),
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
            })}
          >
            ดูคาบสอนรายสัปดาห์และกดที่รายวิชาเพื่อดูรายละเอียด
          </Typography>
          {!!timetable.terms.length && (
            <Stack
              direction="row"
              spacing={0.75}
              useFlexGap
              flexWrap="wrap"
              sx={{ mt: { xs: 1, sm: 2 } }}
            >
              {timetable.terms.map((term) => (
                <Chip
                  key={term}
                  label={`ภาคเรียนที่ ${term}`}
                  size="small"
                  sx={(theme) => ({
                    color: 'common.white',
                    bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
                  })}
                />
              ))}
            </Stack>
          )}
        </Box>

        {!isLoading && !!schedules.length && (
          <Stack
            direction="row"
            spacing={{ xs: 0.75, sm: 1.5 }}
            sx={{ width: { xs: 1, sm: 'auto' } }}
          >
            <SummaryStat label="คาบ/สัปดาห์" value={schedules.length} />
            <SummaryStat label="วันสอน" value={timetable.teachingDays} />
            <SummaryStat
              label="ชั่วโมง/สัปดาห์"
              value={
                Number.isInteger(timetable.weeklyHours)
                  ? timetable.weeklyHours
                  : timetable.weeklyHours.toFixed(1)
              }
            />
          </Stack>
        )}
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
          ไม่สามารถโหลดตารางสอนได้
        </Alert>
      )}

      {isLoading && <TimetableSkeleton />}

      {!isLoading && !schedules.length && !isError && (
        <Alert
          severity="info"
          icon={<RemixIcon icon="solar:calendar-date-bold" />}
          sx={{ py: 2, borderRadius: 2 }}
        >
          ยังไม่มีการกำหนดตารางเวลาสอน — ไปที่หน้ารายวิชาที่สอนเพื่อเพิ่มคาบสอน
        </Alert>
      )}

      {!isLoading && !!schedules.length && (
        <Box sx={{ gap: 1.25, display: { xs: 'flex', sm: 'none' }, flexDirection: 'column' }}>
          <Box sx={{ px: 0.25, display: 'flex', alignItems: 'flex-end' }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                ตารางรายสัปดาห์
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {schedules.length} คาบ · กดเพื่อดูรายละเอียด
              </Typography>
            </Box>
            <Chip
              size="small"
              variant="soft"
              color="primary"
              icon={<RemixIcon icon="solar:clock-circle-bold" />}
              label={`${formatMinutes(timetable.startMinute)}–${formatMinutes(
                timetable.startMinute + timetable.totalHours * 60
              )}`}
            />
          </Box>

          {timetable.visibleDays
            .filter((day) => (timetable.slotsByDay.get(day.value) ?? []).length > 0)
            .map((day) => {
              const daySlots = [...(timetable.slotsByDay.get(day.value) ?? [])].sort((a, b) =>
                a.start_time.localeCompare(b.start_time)
              );
              const isToday = day.value === today;

              return (
                <Card
                  key={day.value}
                  variant="outlined"
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    borderColor: isToday ? 'primary.main' : 'divider',
                    bgcolor: isToday ? 'primary.lighter' : 'background.paper',
                  }}
                >
                  <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                    <Typography
                      variant="subtitle1"
                      sx={{ flex: 1, color: isToday ? 'primary.darker' : 'text.primary' }}
                    >
                      {day.label}
                    </Typography>
                    {isToday && <Chip size="small" color="primary" variant="soft" label="วันนี้" />}
                    <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                      {daySlots.length} คาบ
                    </Typography>
                  </Box>

                  <Box sx={{ gap: 0.75, display: 'flex', flexDirection: 'column' }}>
                    {daySlots.map((slot) => {
                      const color = getSlotColor(slot.teacher_assignment.id);
                      const subject = slot.teacher_assignment.subject;
                      const classroom = slot.teacher_assignment.classroom;

                      return (
                        <Box
                          key={slot.id}
                          component={RouterLink}
                          href={paths.teacher.assignmentDetail(slot.teacher_assignment.id)}
                          sx={{
                            p: 1,
                            gap: 1,
                            display: 'grid',
                            color: 'text.primary',
                            border: '1px solid',
                            borderRadius: 1.5,
                            alignItems: 'center',
                            textDecoration: 'none',
                            bgcolor: 'background.paper',
                            borderColor: `${color}.light`,
                            gridTemplateColumns: '72px minmax(0, 1fr) 24px',
                            '&:active': { bgcolor: `${color}.lighter` },
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
                            <Typography variant="subtitle2" sx={{ fontSize: '0.78rem' }}>
                              {slot.start_time.slice(0, 5)}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ display: 'block', color: 'inherit', fontSize: '0.65rem' }}
                            >
                              {slot.end_time.slice(0, 5)}
                            </Typography>
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" noWrap>
                              {scheduleMode === 'period' && slot.schedule_period?.period_number
                                ? `คาบ ${slot.schedule_period.period_number} · `
                                : ''}
                              {subject?.name ?? 'ไม่ระบุรายวิชา'}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ display: 'block', color: 'text.secondary' }}
                              noWrap
                            >
                              {subject?.code && `${subject.code} · `}ห้อง {classroom?.name ?? '-'}
                              {slot.location_name && ` · สอนที่ ${slot.location_name}`}
                            </Typography>
                          </Box>
                          <RemixIcon
                            icon="eva:arrow-ios-forward-fill"
                            width={20}
                            sx={{ color: 'text.disabled' }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </Card>
              );
            })}
        </Box>
      )}

      {!isLoading && !!schedules.length && (
        <Card
          variant="outlined"
          sx={{ display: { xs: 'none', sm: 'block' }, overflow: 'hidden', borderRadius: 3 }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ px: 2.5, py: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
          >
            <Box>
              <Typography variant="h6">ตารางรายสัปดาห์</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                เวลา {formatMinutes(timetable.startMinute)}–
                {formatMinutes(timetable.startMinute + timetable.totalHours * 60)} น.
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              กดที่รายวิชาเพื่อดูรายละเอียด
            </Typography>
          </Stack>

          <Box
            role="grid"
            aria-label="ตารางสอนรายสัปดาห์"
            sx={{ width: 1, overflow: 'hidden', borderTop: '1px solid', borderColor: 'divider' }}
          >
            <Box sx={{ width: 1 }}>
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
                    left: 0,
                    zIndex: 3,
                    px: 2,
                    display: 'flex',
                    position: 'sticky',
                    alignItems: 'center',
                    bgcolor: 'background.neutral',
                    borderRight: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{ fontSize: { xs: '0.68rem', sm: '0.82rem' } }}
                  >
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
                      gridTemplateColumns: {
                        xs: '64px minmax(0, 1fr)',
                        sm: '104px minmax(0, 1fr)',
                      },
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 0 },
                    }}
                  >
                    <Box
                      role="rowheader"
                      sx={{
                        left: 0,
                        zIndex: 2,
                        px: { xs: 1, sm: 2 },
                        display: 'flex',
                        position: 'sticky',
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
                          ไม่มีคาบสอน
                        </Typography>
                      )}

                      {daySlots.map((slot) => {
                        const start = timeToMinutes(slot.start_time);
                        const end = timeToMinutes(slot.end_time);
                        const left =
                          ((start - timetable.startMinute) / (timetable.totalHours * 60)) * 100;
                        const width = ((end - start) / (timetable.totalHours * 60)) * 100;
                        const color = getSlotColor(slot.teacher_assignment.id);
                        const subject = slot.teacher_assignment.subject;
                        const classroom = slot.teacher_assignment.classroom;
                        const title = `${subject?.name ?? 'ไม่ระบุรายวิชา'} เวลา ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)} น. ห้อง ${classroom?.name ?? '-'}`;

                        return (
                          <Card
                            key={slot.id}
                            title={title}
                            component={RouterLink}
                            href={paths.teacher.assignmentDetail(slot.teacher_assignment.id)}
                            aria-label={`ดูรายละเอียด ${title}`}
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
                              textDecoration: 'none',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              bgcolor: `${color}.lighter`,
                              border: '1px solid',
                              borderColor: `${color}.light`,
                              boxShadow: (theme) => theme.shadows[2],
                              transition: (theme) =>
                                theme.transitions.create(['transform', 'box-shadow']),
                              '&:hover': {
                                zIndex: 1,
                                transform: 'translateY(-2px)',
                                boxShadow: (theme) => theme.shadows[8],
                              },
                              '&:focus-visible': {
                                outline: '3px solid',
                                outlineColor: `${color}.light`,
                                outlineOffset: 2,
                              },
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
                              {subject?.name ?? 'ไม่ระบุรายวิชา'}
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
                              {subject?.code && `${subject.code} · `}ห้อง {classroom?.name ?? '-'}
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
                                น.
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
                                สอนที่ {slot.location_name}
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
      )}
    </Container>
  );
}

// ----------------------------------------------------------------------

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Box
      sx={{
        px: { xs: 0.75, sm: 2 },
        py: { xs: 0.75, sm: 1.25 },
        flex: { xs: 1, sm: 'initial' },
        minWidth: { xs: 0, sm: 104 },
        textAlign: 'center',
        borderRadius: 2,
        bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.14),
        border: (theme) => `1px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.18)}`,
      }}
    >
      <Typography variant="h5" sx={{ fontSize: { xs: '1rem', sm: '1.5rem' } }}>
        {value}
      </Typography>
      <Typography
        variant="caption"
        sx={(theme) => ({
          color: varAlpha(theme.vars.palette.common.whiteChannel, 0.72),
          fontSize: { xs: '0.62rem', sm: '0.75rem' },
        })}
      >
        {label}
      </Typography>
    </Box>
  );
}

function TimetableSkeleton() {
  return (
    <>
      <Box sx={{ gap: 1, display: { xs: 'flex', sm: 'none' }, flexDirection: 'column' }}>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={150} sx={{ borderRadius: 2 }} />
        ))}
      </Box>
      <Card variant="outlined" sx={{ p: 3, display: { xs: 'none', sm: 'block' }, borderRadius: 3 }}>
        <Skeleton width={180} height={32} />
        <Skeleton sx={{ mt: 2 }} height={58} />
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} sx={{ mt: 0.5 }} height={ROW_HEIGHT} />
        ))}
      </Card>
    </>
  );
}
