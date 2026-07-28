'use client';

import type { SchedulePeriod } from './schedule-period-actions';
import type { ScheduleMode } from './schedule-settings-actions';

// ----------------------------------------------------------------------

export type ClassroomScheduleAssignment = {
  id: string;
  subject: { id: string; name: string; code: string | null } | null;
  teacher: { id: string; first_name: string | null; last_name: string | null } | null;
};

export type ClassroomScheduleSlot = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location_name: string | null;
  schedule_period_id: string | null;
  teacher_assignment_id: string;
};

export type ClassroomSchedule = {
  classroom: {
    id: string;
    name: string;
    grade_level: string | null;
    homeroom_teachers: {
      teacher: { id: string; first_name: string | null; last_name: string | null } | null;
    }[];
  };
  semester: { id: string; name: string; academic_year: { year: string } | null } | null;
  assignments: ClassroomScheduleAssignment[];
  schedules: ClassroomScheduleSlot[];
  periods: SchedulePeriod[];
  scheduleMode: ScheduleMode;
};

export async function getClassroomSchedule(
  classroomId: string,
  semesterId: string
): Promise<ClassroomSchedule> {
  const response = await fetch(
    `/api/classrooms/${classroomId}/schedule?semesterId=${semesterId}`,
    {}
  );
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to load classroom schedule');
  return json;
}

export type AddScheduleSlotParams = {
  teacherAssignmentId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  locationName?: string;
  schedulePeriodId?: string;
};

export async function addScheduleSlot(
  params: AddScheduleSlotParams
): Promise<ClassroomScheduleSlot> {
  const response = await fetch(`/api/teacher-assignments/${params.teacherAssignmentId}/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dayOfWeek: params.dayOfWeek,
      startTime: params.startTime,
      endTime: params.endTime,
      locationName: params.locationName,
      schedulePeriodId: params.schedulePeriodId,
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to add schedule slot');
  return json.schedule;
}

export async function deleteScheduleSlot(
  teacherAssignmentId: string,
  scheduleId: string
): Promise<void> {
  const response = await fetch(
    `/api/teacher-assignments/${teacherAssignmentId}/schedules/${scheduleId}`,
    { method: 'DELETE' }
  );
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to delete schedule slot');
}

export async function updateScheduleSlot(
  teacherAssignmentId: string,
  scheduleId: string,
  params: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    locationName?: string;
    schedulePeriodId?: string;
  }
): Promise<ClassroomScheduleSlot> {
  const response = await fetch(
    `/api/teacher-assignments/${teacherAssignmentId}/schedules/${scheduleId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }
  );
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to update schedule slot');
  return json.schedule;
}

// ----------------------------------------------------------------------

export type ScheduleApprovalStatus = {
  status: 'draft' | 'submitted' | 'approved' | 'canceled';
  submitted_at?: string | null;
  approved_at?: string | null;
  canceled_at?: string | null;
  submitter_signature_url?: string | null;
  submitter_signature_signed_at?: string | null;
};

export async function getScheduleApproval(
  classroomId: string,
  semesterId: string
): Promise<ScheduleApprovalStatus> {
  const response = await fetch(
    `/api/classrooms/${classroomId}/schedule-approval?semesterId=${semesterId}`
  );
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to load approval status');
  return json.approval;
}

export async function submitScheduleForApproval(
  classroomId: string,
  semesterId: string,
  signatureDataUrl: string
): Promise<ScheduleApprovalStatus> {
  const response = await fetch(`/api/classrooms/${classroomId}/schedule-approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ semesterId, action: 'submit', signatureDataUrl }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to submit schedule');
  return json.approval;
}

export async function cancelScheduleSubmission(
  classroomId: string,
  semesterId: string
): Promise<ScheduleApprovalStatus> {
  const response = await fetch(`/api/classrooms/${classroomId}/schedule-approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ semesterId, action: 'cancel' }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to cancel submission');
  return json.approval;
}
