'use client';

// ----------------------------------------------------------------------

export type MyStudentQr = {
  id: string;
  payload: string;
  student: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    student_code: string | null;
    avatar_url: string | null;
  };
};

export async function getMyStudentQr(): Promise<MyStudentQr> {
  const response = await fetch('/api/student/qr', { method: 'POST' });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถโหลด QR ได้');
  return json.qr;
}
