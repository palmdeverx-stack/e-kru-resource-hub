'use client';

import type { SchedulePeriod } from '../schedule-period-actions';
import type {
  ClassroomScheduleSlot,
  ClassroomScheduleAssignment,
} from '../schedule-builder-actions';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

const DAYS = [
  { value: 1, label: 'วันจันทร์' },
  { value: 2, label: 'วันอังคาร' },
  { value: 3, label: 'วันพุธ' },
  { value: 4, label: 'วันพฤหัสบดี' },
  { value: 5, label: 'วันศุกร์' },
  { value: 6, label: 'วันเสาร์' },
  { value: 7, label: 'วันอาทิตย์' },
];

const COLORS = ['primary', 'secondary', 'error', 'info', 'success', 'warning'] as const;

function slotColor(id: string) {
  const hash = [...id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

type Props = {
  schedules: ClassroomScheduleSlot[];
  assignments: ClassroomScheduleAssignment[];
  periods: SchedulePeriod[];
  onSlotClick?: (slot: ClassroomScheduleSlot) => void;
};

export function PeriodScheduleGrid({ schedules, assignments, periods, onSlotClick }: Props) {
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const visibleDays = DAYS.filter(
    (day) => day.value <= 5 || schedules.some((slot) => slot.day_of_week === day.value)
  );
  const sortedPeriods = [...periods].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const columns = `100px ${sortedPeriods
    .map((period) => (period.is_break ? '72px' : 'minmax(145px, 1fr)'))
    .join(' ')}`;

  return (
    <Card variant="outlined" sx={{ overflow: 'hidden', borderRadius: 3 }}>
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ minWidth: 100 + sortedPeriods.length * 145 }}>
          <Box
            sx={{
              display: 'grid',
              bgcolor: 'background.neutral',
              gridTemplateColumns: columns,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ p: 1.5, display: 'grid', placeItems: 'center' }}>
              <Typography variant="subtitle2">วัน / คาบ</Typography>
            </Box>
            {sortedPeriods.map((period) => (
              <Box
                key={period.id}
                sx={{
                  p: 1,
                  textAlign: 'center',
                  borderLeft: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="subtitle2">
                  {period.is_break ? period.name : `คาบ ${period.period_number}`}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {period.start_time.slice(0, 5)}–{period.end_time.slice(0, 5)}
                </Typography>
              </Box>
            ))}
          </Box>

          {visibleDays.map((day) => (
            <Box
              key={day.value}
              sx={{
                minHeight: 112,
                display: 'grid',
                gridTemplateColumns: columns,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 0 },
              }}
            >
              <Box sx={{ p: 1.5, display: 'grid', placeItems: 'center' }}>
                <Typography variant="subtitle2">{day.label}</Typography>
              </Box>
              {sortedPeriods.map((period) => {
                const slot = schedules.find(
                  (item) =>
                    item.day_of_week === day.value &&
                    (item.schedule_period_id === period.id ||
                      (!item.schedule_period_id &&
                        item.start_time.slice(0, 5) === period.start_time.slice(0, 5) &&
                        item.end_time.slice(0, 5) === period.end_time.slice(0, 5)))
                );
                const assignment = slot
                  ? assignmentById.get(slot.teacher_assignment_id)
                  : undefined;
                const teacherName =
                  `${assignment?.teacher?.first_name ?? ''} ${assignment?.teacher?.last_name ?? ''}`.trim();
                const color = slot ? slotColor(slot.teacher_assignment_id) : 'primary';

                return (
                  <Box
                    key={period.id}
                    sx={{
                      p: 0.75,
                      minWidth: 0,
                      display: 'flex',
                      borderLeft: '1px solid',
                      borderColor: 'divider',
                      bgcolor: period.is_break ? 'background.neutral' : undefined,
                    }}
                  >
                    {period.is_break ? (
                      <Typography
                        variant="caption"
                        sx={{ m: 'auto', color: 'text.secondary', textAlign: 'center' }}
                      >
                        {period.name}
                      </Typography>
                    ) : slot ? (
                      <Card
                        onClick={onSlotClick ? () => onSlotClick(slot) : undefined}
                        sx={{
                          p: 1,
                          width: 1,
                          cursor: onSlotClick ? 'pointer' : 'default',
                          color: `${color}.darker`,
                          bgcolor: `${color}.lighter`,
                          border: '1px solid',
                          borderColor: `${color}.light`,
                        }}
                      >
                        <Typography variant="subtitle2" noWrap sx={{ color: 'inherit' }}>
                          {assignment?.subject?.name ?? 'ไม่ระบุวิชา'}
                        </Typography>
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{ display: 'block', color: 'inherit' }}
                        >
                          ครู{teacherName || '-'}
                        </Typography>
                        {slot.location_name && (
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{ display: 'block', color: 'inherit', opacity: 0.82 }}
                          >
                            {slot.location_name}
                          </Typography>
                        )}
                      </Card>
                    ) : (
                      <Typography variant="caption" sx={{ m: 'auto', color: 'text.disabled' }}>
                        -
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>
    </Card>
  );
}
