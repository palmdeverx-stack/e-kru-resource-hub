import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import {
  loadStudentGradeReport,
  renderStudentGradeReportPdf,
} from 'src/lib/student-grade-report';

// ----------------------------------------------------------------------

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ token: string }> };

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
    return NextResponse.json({ message: 'ลิงก์เอกสารไม่ถูกต้อง' }, { status: 404 });
  }

  const { data: share } = await supabaseAdmin
    .from('grade_report_share_tokens')
    .select(
      `id, school_id, student_id, expires_at, revoked_at, download_count,
       batch:grade_result_delivery_batches!inner(classroom_id, semester_id)`
    )
    .eq('token_hash', tokenHash(token))
    .maybeSingle();
  if (!share || share.revoked_at || share.expires_at <= new Date().toISOString()) {
    return NextResponse.json(
      { message: 'ลิงก์ใบแจ้งผลการเรียนหมดอายุหรือถูกยกเลิกแล้ว' },
      { status: 410 }
    );
  }

  const batch = Array.isArray(share.batch) ? share.batch[0] : share.batch;
  if (!batch) {
    return NextResponse.json({ message: 'ไม่พบข้อมูลผลการเรียน' }, { status: 404 });
  }

  const report = await loadStudentGradeReport({
    schoolId: share.school_id,
    classroomId: batch.classroom_id,
    semesterId: batch.semester_id,
    studentId: share.student_id,
  });
  if (!report) {
    return NextResponse.json({ message: 'ไม่พบผลการเรียนที่รับรองแล้ว' }, { status: 404 });
  }

  try {
    const pdf = await renderStudentGradeReportPdf(report);
    await supabaseAdmin
      .from('grade_report_share_tokens')
      .update({
        last_accessed_at: new Date().toISOString(),
        download_count: share.download_count + 1,
      })
      .eq('id', share.id);

    const safeStudentCode = (report.studentCode ?? 'student').replace(/[^A-Za-z0-9_-]/g, '');
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="grade-report-${safeStudentCode || 'student'}.pdf"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ message: 'ไม่สามารถสร้างไฟล์ PDF ได้' }, { status: 500 });
  }
}
