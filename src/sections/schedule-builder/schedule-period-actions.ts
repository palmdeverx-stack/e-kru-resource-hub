'use client';

// ----------------------------------------------------------------------

export type SchedulePeriod = {
  id: string;
  semester_id: string;
  period_number: number | null;
  name: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
};

export type SchedulePeriodInput = {
  semesterId: string;
  periodNumber: number | null;
  name: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
};

async function parseResponse(response: Response) {
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to manage schedule periods');
  return json;
}

export async function listSchedulePeriods(semesterId: string): Promise<SchedulePeriod[]> {
  const response = await fetch(`/api/schedule-periods?semesterId=${semesterId}`);
  const json = await parseResponse(response);
  return json.periods;
}

export async function createSchedulePeriod(params: SchedulePeriodInput): Promise<SchedulePeriod> {
  const response = await fetch('/api/schedule-periods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await parseResponse(response);
  return json.period;
}

export async function updateSchedulePeriod(
  id: string,
  params: SchedulePeriodInput
): Promise<SchedulePeriod> {
  const response = await fetch(`/api/schedule-periods/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await parseResponse(response);
  return json.period;
}

export async function deleteSchedulePeriod(id: string): Promise<void> {
  const response = await fetch(`/api/schedule-periods/${id}`, { method: 'DELETE' });
  await parseResponse(response);
}
