'use client';

import type { ScoreReport } from '../../score-report-actions';

import { useState } from 'react';

import Menu from '@mui/material/Menu';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';

import { toast } from 'src/components/snackbar';
import { RemixIcon } from 'src/components/remix-icon';

import { getScoreReport } from '../../score-report-actions';

// ----------------------------------------------------------------------

const CATEGORY_LABEL = {
  assignment: 'งาน',
  quiz: 'แบบทดสอบ',
  midterm: 'กลางภาค',
  final: 'ปลายภาค',
  other: 'อื่นๆ',
} as const;

type Props = {
  teacherAssignmentId: string;
  compactOnMobile?: boolean;
};

export function ScoreReportExportButton({ teacherAssignmentId, compactOnMobile = false }: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);

  const handleExport = async (format: 'csv' | 'excel') => {
    setAnchorEl(null);
    setExporting(format);
    try {
      const report = await getScoreReport(teacherAssignmentId);
      const filename = safeFilename(
        `คะแนน-${report.subject.code || report.subject.name}-${report.classroom.name}`
      );
      if (format === 'csv') exportCsv(report, filename);
      else exportExcel(report, filename);
      toast.success(`ส่งออกไฟล์ ${format === 'csv' ? 'CSV' : 'Excel'} เรียบร้อยแล้ว`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถส่งออกรายงานคะแนนได้');
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <Button
        color="inherit"
        variant="outlined"
        loading={exporting !== null}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        startIcon={<RemixIcon icon="solar:download-bold" />}
        sx={{
          minWidth: { xs: compactOnMobile ? 0 : 64, sm: 64 },
          px: { xs: compactOnMobile ? 1 : 2, sm: 2 },
          flexShrink: 0,
          '& .MuiButton-startIcon': { mr: { xs: compactOnMobile ? 0 : 1, sm: 1 } },
          '& .desktop-label': { display: { xs: 'none', sm: 'inline' } },
        }}
        aria-label="ส่งออกคะแนน"
      >
        <span className={compactOnMobile ? 'desktop-label' : undefined}>ส่งออกคะแนน</span>
      </Button>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => handleExport('csv')}>
          <ListItemIcon>
            <RemixIcon icon="solar:file-text-bold" />
          </ListItemIcon>
          CSV (.csv)
        </MenuItem>
        <MenuItem onClick={() => handleExport('excel')}>
          <ListItemIcon>
            <RemixIcon icon="solar:file-bold-duotone" />
          </ListItemIcon>
          Excel (.xls)
        </MenuItem>
      </Menu>
    </>
  );
}

type ExportRow = Record<string, string | number>;

function reportRows(report: ScoreReport): { headers: string[]; rows: ExportRow[] } {
  const assignmentHeaders = report.assignments.map(
    (assignment, index) =>
      `${index + 1}. [${CATEGORY_LABEL[assignment.category]}] ${assignment.title} (เต็ม ${assignment.fullScore})`
  );
  const totalFullScore = report.assignments.reduce(
    (total, assignment) => total + assignment.fullScore,
    0
  );
  const headers = [
    'รหัสวิชา',
    'วิชา',
    'ชั้นเรียน',
    'ปีการศึกษา',
    'ภาคเรียน',
    'เลขที่',
    'รหัสนักเรียน',
    'ชื่อผู้ใช้',
    'ชื่อ-นามสกุล',
    'ชื่อเล่น',
    ...assignmentHeaders,
    'คะแนนรวม',
    'คะแนนเต็มรวม',
    'ร้อยละ',
  ];
  const rows = report.students.map((student) => {
    const assignmentScores = report.assignments.map(
      (assignment) => student.scores[assignment.id]?.score ?? ''
    );
    const totalScore = report.assignments.reduce(
      (total, assignment) => total + (student.scores[assignment.id]?.score ?? 0),
      0
    );
    const percentage = totalFullScore
      ? Number(((totalScore / totalFullScore) * 100).toFixed(2))
      : 0;
    const name = `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || student.username;

    return Object.fromEntries(
      headers.map((header, index) => [
        header,
        [
          report.subject.code ?? '',
          report.subject.name,
          report.classroom.name,
          report.classroom.academicYear ?? '',
          report.semesterName ?? '',
          student.studentNumber ?? '',
          student.studentCode ?? '',
          student.username,
          name,
          student.nickname ?? '',
          ...assignmentScores,
          totalScore,
          totalFullScore,
          percentage,
        ][index],
      ])
    );
  });

  return { headers, rows };
}

function downloadFile(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function exportCsv(report: ScoreReport, filename: string) {
  const { headers, rows } = reportRows(report);
  const content = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
  ].join('\r\n');
  downloadFile(`\uFEFF${content}`, 'text/csv;charset=utf-8', `${filename}.csv`);
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function exportExcel(report: ScoreReport, filename: string) {
  const { headers, rows } = reportRows(report);
  const title = `${report.subject.code ? `${report.subject.code} ` : ''}${report.subject.name}`;
  const table = `
    <table>
      <tr><th colspan="${headers.length}">${escapeHtml(title)}</th></tr>
      <tr><td colspan="${headers.length}">ชั้น ${escapeHtml(report.classroom.name)} · ภาคเรียน ${escapeHtml(report.semesterName ?? '-')} · ปีการศึกษา ${escapeHtml(report.classroom.academicYear ?? '-')}</td></tr>
      <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
      ${rows
        .map(
          (row) =>
            `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join('')}</tr>`
        )
        .join('')}
    </table>`;
  const workbook = `\uFEFF<html xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="UTF-8"></head><body>${table}</body></html>`;
  downloadFile(workbook, 'application/vnd.ms-excel;charset=utf-8', `${filename}.xls`);
}

function safeFilename(value: string) {
  return value
    .replaceAll(/[\\/:*?"<>|]/g, '-')
    .replaceAll(/\s+/g, ' ')
    .trim();
}
