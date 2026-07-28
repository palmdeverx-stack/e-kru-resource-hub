'use client';

// ----------------------------------------------------------------------

export type AnnouncementType = 'general' | 'holiday' | 'exam';
export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export type TeacherAnnouncement = {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  priority: AnnouncementPriority;
  announcement_type: AnnouncementType;
  is_published: boolean;
  published_at: string;
  expires_at: string | null;
  event_start: string | null;
  event_end: string | null;
  created_at: string;
  targets: Array<{
    classroom_id: string;
    classroom: { id: string; name: string; grade_level: string | null } | null;
  }>;
};

export type TeacherClassroom = { id: string; name: string; grade_level: string | null };

export type AnnouncementPayload = {
  title: string;
  content: string;
  announcementType: AnnouncementType;
  priority: AnnouncementPriority;
  classroomIds: string[];
  eventStart: string;
  eventEnd: string;
  expiresAt: string;
  sendLine: boolean;
};

export async function getTeacherAnnouncements(): Promise<{
  announcements: TeacherAnnouncement[];
  classrooms: TeacherClassroom[];
}> {
  const response = await fetch('/api/teacher/announcements', {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลดประกาศได้');
  return json;
}

function announcementFormData(
  payload: AnnouncementPayload,
  image?: File | null,
  removeImage = false
) {
  const formData = new FormData();
  formData.set('title', payload.title);
  formData.set('content', payload.content);
  formData.set('announcementType', payload.announcementType);
  formData.set('priority', payload.priority);
  formData.set('classroomIds', JSON.stringify(payload.classroomIds));
  formData.set('eventStart', payload.eventStart);
  formData.set('eventEnd', payload.eventEnd);
  formData.set('expiresAt', payload.expiresAt);
  formData.set('sendLine', String(payload.sendLine));
  formData.set('removeImage', String(removeImage));
  if (image) formData.set('image', image);
  return formData;
}

export async function createTeacherAnnouncement(payload: AnnouncementPayload, image?: File | null) {
  const response = await fetch('/api/teacher/announcements', {
    method: 'POST',
    body: announcementFormData(payload, image),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถสร้างประกาศได้');
  return json;
}

export async function updateTeacherAnnouncement(
  id: string,
  payload: AnnouncementPayload,
  image?: File | null,
  removeImage = false
) {
  const response = await fetch(`/api/teacher/announcements/${id}`, {
    method: 'PATCH',
    body: announcementFormData(payload, image, removeImage),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถแก้ไขประกาศได้');
  return json;
}

export async function deleteTeacherAnnouncement(id: string) {
  const response = await fetch(`/api/teacher/announcements/${id}`, {
    method: 'DELETE',
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถลบประกาศได้');
}
