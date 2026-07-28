'use client';

// ----------------------------------------------------------------------

export type StudentQrData = {
  id: string;
  payload: string;
  student: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    student_code: string | null;
  };
};

export async function issueStudentQr(
  studentId: string,
  regenerate = false
): Promise<StudentQrData> {
  const response = await fetch(`/api/teacher/students/${studentId}/qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regenerate }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? 'ไม่สามารถออก QR นักเรียนได้');
  return json.qr;
}
