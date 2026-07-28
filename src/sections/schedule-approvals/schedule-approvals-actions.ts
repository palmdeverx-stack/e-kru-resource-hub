'use client';

// ----------------------------------------------------------------------

export type ScheduleApprovalListStatus = 'submitted' | 'approved' | 'canceled';

export type ScheduleApproval = {
  id: string;
  status: ScheduleApprovalListStatus;
  submitted_at: string | null;
  approved_at: string | null;
  canceled_at: string | null;
  signature_url?: string | null;
  signature_signed_at?: string | null;
  submitter_signature_url?: string | null;
  submitter_signature_signed_at?: string | null;
  classroom: {
    id: string;
    name: string;
    grade_level: string | null;
    homeroom_teachers: {
      teacher: { id: string; first_name: string | null; last_name: string | null } | null;
    }[];
  } | null;
  semester: { id: string; name: string; academic_year: { year: string } | null } | null;
  submitted_by: {
    first_name: string | null;
    last_name: string | null;
    position_title?: string | null;
  } | null;
  approved_by: {
    first_name: string | null;
    last_name: string | null;
    position_title?: string | null;
  } | null;
  canceled_by: {
    first_name: string | null;
    last_name: string | null;
    position_title?: string | null;
  } | null;
};

export async function listScheduleApprovals(
  status: ScheduleApprovalListStatus
): Promise<ScheduleApproval[]> {
  const response = await fetch(`/api/schedule-approvals?status=${status}`);
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to load schedule approvals');
  return json.approvals;
}

export async function getScheduleApprovalDetail(id: string): Promise<ScheduleApproval> {
  const response = await fetch(`/api/schedule-approvals/${id}`);
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to load schedule approval');
  return json.approval;
}

export async function approveClassroomSchedule(
  classroomId: string,
  semesterId: string,
  signatureDataUrl: string
): Promise<void> {
  const response = await fetch(`/api/classrooms/${classroomId}/schedule-approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ semesterId, action: 'approve', signatureDataUrl }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to approve schedule');
}
