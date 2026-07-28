'use client';

// ----------------------------------------------------------------------

export type MyDepartmentTeacher = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url?: string | null;
};

export type MyDepartmentMember = {
  id: string;
  role_in_department: 'head' | 'member';
  teacher: MyDepartmentTeacher;
};

export type MyDepartment = {
  department: { id: string; name: string; description: string | null } | null;
  roleInDepartment: 'head' | 'member' | null;
  members: MyDepartmentMember[];
};

export type DepartmentAnnouncement = {
  id: string;
  title: string;
  content: string;
  priority: string;
  created_at: string;
  author: { first_name: string | null; last_name: string | null } | null;
};

export async function getMyDepartment(): Promise<MyDepartment> {
  const response = await fetch('/api/teacher/department', {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to load department');
  return json;
}

export async function listDepartmentAnnouncements(): Promise<DepartmentAnnouncement[]> {
  const response = await fetch('/api/teacher/department/announcements', {});
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to load announcements');
  return json.announcements;
}

export async function createDepartmentAnnouncement(params: {
  title: string;
  content: string;
}): Promise<DepartmentAnnouncement> {
  const response = await fetch('/api/teacher/department/announcements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'Failed to create announcement');
  return json.announcement;
}
