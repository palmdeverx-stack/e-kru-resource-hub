'use client';

// ----------------------------------------------------------------------

export type ScheduleMode = 'hour' | 'period';

export async function getScheduleMode(): Promise<ScheduleMode> {
  const response = await fetch('/api/schedule-settings');
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to load schedule mode');
  return json.scheduleMode;
}

export async function updateScheduleMode(scheduleMode: ScheduleMode): Promise<ScheduleMode> {
  const response = await fetch('/api/schedule-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduleMode }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to update schedule mode');
  return json.scheduleMode;
}
