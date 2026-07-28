export type TeachingScheduleTime = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

const WEEKDAY_NUMBER: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function teachingTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function getBangkokScheduleTime(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
    timeZone: 'Asia/Bangkok',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    dayOfWeek: WEEKDAY_NUMBER[values.weekday] ?? 0,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

export function getTeachingScheduleStatus(schedules: TeachingScheduleTime[], date: Date) {
  const current = getBangkokScheduleTime(date);
  const todaySchedules = schedules
    .filter((schedule) => schedule.day_of_week === current.dayOfWeek)
    .sort(
      (first, second) =>
        teachingTimeToMinutes(first.start_time) - teachingTimeToMinutes(second.start_time)
    );
  const active = todaySchedules.find(
    (schedule) =>
      current.minutes >= teachingTimeToMinutes(schedule.start_time) &&
      current.minutes < teachingTimeToMinutes(schedule.end_time)
  );
  const next = todaySchedules.find(
    (schedule) => teachingTimeToMinutes(schedule.start_time) > current.minutes
  );

  return { active, next, hasScheduleToday: todaySchedules.length > 0 };
}
