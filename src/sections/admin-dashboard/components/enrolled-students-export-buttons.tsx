'use client';

import type { EnrolledStudentExportRow } from '../admin-dashboard-actions';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

import { RemixIcon } from 'src/components/remix-icon';

import { getEnrolledStudentsForExport } from '../admin-dashboard-actions';

// ----------------------------------------------------------------------

type ExportFormat = 'csv' | 'excel';
type ExportCell = string | number;
type ExportRecord = Record<string, ExportCell>;

const STATUS_LABEL: Record<string, string> = {
  studying: 'กำลังศึกษา',
  graduated: 'สำเร็จการศึกษา',
  transferred: 'ย้ายสถานศึกษา',
  withdrawn: 'ลาออก',
  dismissed: 'พ้นสภาพ',
};

const GENDER_LABEL: Record<string, string> = {
  male: 'ชาย',
  female: 'หญิง',
  other: 'อื่น ๆ',
  unspecified: 'ไม่ประสงค์ระบุ',
};

const EMPTY_GRADE = 'ไม่ระบุชั้นปี';

export function EnrolledStudentsExportButtons() {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState('');

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    setError('');

    try {
      const enrollments = await getEnrolledStudentsForExport();
      if (!enrollments.length) {
        setError('ยังไม่มีนักเรียนที่ลงทะเบียนเรียน');
        return;
      }

      const groups = groupByGrade(enrollments);
      const date = new Intl.DateTimeFormat('en-CA').format(new Date());
      const filename = `enrolled-students-${date}`;

      if (format === 'csv') exportGroupedCsv(groups, filename);
      else exportMultiSheetExcel(groups, filename);
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : 'ไม่สามารถส่งออกข้อมูลนักเรียนได้'
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <Box>
      <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap' }}>
        <Button
          color="inherit"
          variant="outlined"
          loading={exporting === 'csv'}
          disabled={exporting !== null}
          onClick={() => void handleExport('csv')}
          startIcon={<RemixIcon icon="solar:file-text-bold" />}
        >
          Export CSV
        </Button>
        <Button
          color="success"
          variant="outlined"
          loading={exporting === 'excel'}
          disabled={exporting !== null}
          onClick={() => void handleExport('excel')}
          startIcon={<RemixIcon icon="solar:chart-square-outline" />}
        >
          Export Excel
        </Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------

function groupByGrade(enrollments: EnrolledStudentExportRow[]) {
  const groups = new Map<string, EnrolledStudentExportRow[]>();

  for (const enrollment of enrollments) {
    const grade = enrollment.classroom.grade_level?.trim() || EMPTY_GRADE;
    const rows = groups.get(grade) ?? [];
    rows.push(enrollment);
    groups.set(grade, rows);
  }

  return [...groups.entries()]
    .sort(([gradeA], [gradeB]) =>
      gradeA.localeCompare(gradeB, 'th', { numeric: true, sensitivity: 'base' })
    )
    .map(([grade, rows]) => ({
      grade,
      rows: rows.slice().sort(
        (a, b) =>
          (a.classroom.academic_year?.year ?? '').localeCompare(
            b.classroom.academic_year?.year ?? '',
            'th',
            { numeric: true }
          ) ||
          a.classroom.name.localeCompare(b.classroom.name, 'th', { numeric: true }) ||
          compareStudentNumber(a.student_number, b.student_number) ||
          (a.student.student_code ?? '').localeCompare(b.student.student_code ?? '', 'th', {
            numeric: true,
          })
      ),
    }));
}

function compareStudentNumber(a: string | null, b: string | null) {
  const aNumber = Number(a);
  const bNumber = Number(b);
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;
  return (a ?? '').localeCompare(b ?? '', 'th', { numeric: true });
}

function toExportRecord(enrollment: EnrolledStudentExportRow): ExportRecord {
  const { student, classroom } = enrollment;
  const thaiName =
    `${student.name_prefix ?? ''}${student.first_name ?? ''} ${student.last_name ?? ''}`.trim();
  const englishName = `${student.first_name_en ?? ''} ${student.last_name_en ?? ''}`.trim();

  return {
    ปีการศึกษา: classroom.academic_year?.year ?? '',
    ชั้นปี: classroom.grade_level ?? '',
    ชั้นปีภาษาอังกฤษ: classroom.grade_level_en ?? '',
    ห้องเรียน: classroom.name,
    ห้องเรียนภาษาอังกฤษ: classroom.name_en ?? '',
    เลขที่: enrollment.student_number ?? '',
    รหัสนักเรียน: student.student_code ?? '',
    เลขประจำตัวประชาชน: student.national_id ?? '',
    'ชื่อ-นามสกุลภาษาไทย': thaiName,
    'ชื่อ-นามสกุลภาษาอังกฤษ': englishName,
    ชื่อเล่น: student.nickname ?? '',
    เพศ: student.gender ? (GENDER_LABEL[student.gender] ?? student.gender) : '',
    วันเดือนปีเกิด: formatDate(student.birth_date),
    อายุ: calculateAge(student.birth_date),
    สัญชาติ: student.nationality ?? '',
    เชื้อชาติ: student.ethnicity ?? '',
    ศาสนา: student.religion ?? '',
    อีเมล: student.email ?? '',
    ชื่อผู้ใช้งาน: student.username,
    สถานะนักเรียน: student.student_status
      ? (STATUS_LABEL[student.student_status] ?? student.student_status)
      : '',
    สถานะบัญชี: student.is_active ? 'ใช้งาน' : 'ปิดใช้งาน',
    วันที่ลงทะเบียน: formatDate(enrollment.created_at, true),
  };
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime && { hour: '2-digit', minute: '2-digit' }),
  }).format(date);
}

function calculateAge(birthDate: string | null) {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDifference = today.getMonth() - birth.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : '';
}

function downloadFile(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeSpreadsheetValue(value: ExportCell) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function escapeCsv(value: ExportCell) {
  return `"${sanitizeSpreadsheetValue(value).replaceAll('"', '""')}"`;
}

function exportGroupedCsv(
  groups: Array<{ grade: string; rows: EnrolledStudentExportRow[] }>,
  filename: string
) {
  const lines: string[] = [];

  groups.forEach(({ grade, rows }, groupIndex) => {
    const records = rows.map(toExportRecord);
    const headers = Object.keys(records[0]);
    if (groupIndex) lines.push('');
    lines.push([escapeCsv('ชั้นปี'), escapeCsv(grade)].join(','));
    lines.push(headers.map(escapeCsv).join(','));
    records.forEach((record) => {
      lines.push(headers.map((header) => escapeCsv(record[header])).join(','));
    });
  });

  downloadFile(
    `\uFEFF${lines.join('\r\n')}`,
    'text/csv;charset=utf-8',
    `${filename}-grouped-by-grade.csv`
  );
}

function escapeXml(value: ExportCell) {
  return sanitizeSpreadsheetValue(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function createSheetNames(grades: string[]) {
  const usedNames = new Set<string>();

  return grades.map((grade) => {
    const baseName = grade.replaceAll(/[\\/?*[\]:]/g, '-').slice(0, 31) || EMPTY_GRADE;
    let sheetName = baseName;
    let suffix = 2;
    while (usedNames.has(sheetName)) {
      const suffixText = `-${suffix}`;
      sheetName = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }
    usedNames.add(sheetName);
    return sheetName;
  });
}

function exportMultiSheetExcel(
  groups: Array<{ grade: string; rows: EnrolledStudentExportRow[] }>,
  filename: string
) {
  const sheetNames = createSheetNames(groups.map((group) => group.grade));
  const worksheets = groups
    .map(({ grade, rows }, index) => {
      const records = rows.map(toExportRecord);
      const headers = Object.keys(records[0]);
      const headerCells = headers
        .map(
          (header) =>
            `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`
        )
        .join('');
      const dataRows = records
        .map(
          (record) =>
            `<Row>${headers
              .map(
                (header) =>
                  `<Cell><Data ss:Type="String">${escapeXml(record[header])}</Data></Cell>`
              )
              .join('')}</Row>`
        )
        .join('');

      return `<Worksheet ss:Name="${escapeXml(sheetNames[index])}">
        <Table>
          <Row><Cell ss:StyleID="Title" ss:MergeAcross="${headers.length - 1}">
            <Data ss:Type="String">รายชื่อนักเรียนที่ลงทะเบียนแล้ว · ${escapeXml(grade)}</Data>
          </Cell></Row>
          <Row>${headerCells}</Row>
          ${dataRows}
        </Table>
        <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
          <FreezePanes/><FrozenNoSplit/><SplitHorizontal>2</SplitHorizontal>
          <TopRowBottomPane>2</TopRowBottomPane>
        </WorksheetOptions>
      </Worksheet>`;
    })
    .join('');

  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
    <?mso-application progid="Excel.Sheet"?>
    <Workbook
      xmlns="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
      <Styles>
        <Style ss:ID="Default" ss:Name="Normal">
          <Alignment ss:Vertical="Center"/>
          <Font ss:FontName="Arial" ss:Size="10"/>
        </Style>
        <Style ss:ID="Title">
          <Font ss:Bold="1" ss:Size="14"/>
          <Interior ss:Color="#DCEBFF" ss:Pattern="Solid"/>
        </Style>
        <Style ss:ID="Header">
          <Font ss:Bold="1"/>
          <Interior ss:Color="#EAF2FF" ss:Pattern="Solid"/>
          <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders>
        </Style>
      </Styles>
      ${worksheets}
    </Workbook>`;

  downloadFile(workbook, 'application/vnd.ms-excel;charset=utf-8', `${filename}-by-grade.xls`);
}
