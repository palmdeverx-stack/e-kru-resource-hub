'use client';

import type { GradeReviewSubmission } from '../grade-review-actions';
import type { ScoreReport } from 'src/sections/teacher-assignment/score-report-actions';

import {
  Font,
  Page,
  Text,
  View,
  Image,
  Document,
  PDFViewer,
  StyleSheet,
  PDFDownloadLink,
} from '@react-pdf/renderer';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { RemixIcon } from 'src/components/remix-icon';

import { buildGradeResultRows } from '../grade-result-utils';

// ----------------------------------------------------------------------

Font.register({
  family: 'LINE Seed Sans TH',
  fonts: [
    { src: '/fonts/LINESeedSansTH-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/LINESeedSansTH-Bold.ttf', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: 'LINE Seed Sans TH', color: '#111827' },
  coverPage: { padding: 46, fontSize: 10, fontFamily: 'LINE Seed Sans TH', color: '#111827' },
  coverLogo: { width: 72, height: 72, alignSelf: 'center', objectFit: 'contain' },
  coverTitle: { marginTop: 8, fontSize: 15, fontWeight: 700, textAlign: 'center' },
  coverFields: { marginTop: 24 },
  coverFieldRow: { marginBottom: 7, display: 'flex', flexDirection: 'row', alignItems: 'flex-end' },
  coverField: {
    minHeight: 17,
    paddingHorizontal: 4,
    marginHorizontal: 3,
    borderBottom: '1 solid #111827',
  },
  coverSectionTitle: { marginTop: 16, marginBottom: 4, fontWeight: 700 },
  coverTable: { borderTop: '1 solid #111827', borderLeft: '1 solid #111827' },
  coverTableRow: { display: 'flex', flexDirection: 'row' },
  coverTableCell: {
    minHeight: 24,
    padding: 3,
    justifyContent: 'center',
    textAlign: 'center',
    borderRight: '1 solid #111827',
    borderBottom: '1 solid #111827',
  },
  coverApprovalRow: { marginTop: 7, display: 'flex', flexDirection: 'row', alignItems: 'center' },
  coverSignatureLine: { width: 150, marginHorizontal: 5, borderBottom: '1 solid #111827' },
  title: { fontSize: 16, fontWeight: 700, textAlign: 'center' },
  subtitle: { marginTop: 2, fontSize: 9, textAlign: 'center' },
  info: { marginTop: 10, display: 'flex', flexDirection: 'row', justifyContent: 'space-between' },
  table: { marginTop: 10, borderTop: '1 solid #111827', borderLeft: '1 solid #111827' },
  row: { display: 'flex', flexDirection: 'row' },
  header: { backgroundColor: '#E5E7EB', fontWeight: 700 },
  cell: {
    padding: 3,
    minHeight: 22,
    justifyContent: 'center',
    borderRight: '1 solid #111827',
    borderBottom: '1 solid #111827',
  },
  number: { width: 28, textAlign: 'center' },
  code: { width: 62 },
  name: { flex: 1 },
  score: { width: 52, textAlign: 'center' },
  total: { width: 58, textAlign: 'center' },
  grade: { width: 42, textAlign: 'center' },
  signatures: {
    marginTop: 20,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  signature: { width: 220, alignItems: 'center' },
  signatureSpace: { height: 42 },
  signatureLine: { width: 180, borderTop: '1 solid #111827' },
  signatureText: { marginTop: 4, textAlign: 'center' },
});

function teacherName(report: ScoreReport) {
  return (
    `${report.teacher.firstName ?? ''} ${report.teacher.lastName ?? ''}`.trim() ||
    report.teacher.username ||
    '-'
  );
}

function personName(person: { first_name: string | null; last_name: string | null } | null) {
  return `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim() || '-';
}

export function GradeResultDocument({
  report,
  submission,
}: {
  report: ScoreReport;
  submission: GradeReviewSubmission;
}) {
  const rows = buildGradeResultRows(report);
  const gradeLevels = ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0'];
  const gradeCounts = Object.fromEntries(
    gradeLevels.map((grade) => [grade, rows.filter((row) => row.grade === grade).length])
  );
  const specialResults = ['ร', 'มส', 'มผ'] as const;
  const specialCounts = Object.fromEntries(
    specialResults.map((result) => [
      result,
      rows.filter((row) => row.student.specialResult === result).length,
    ])
  );
  const desirableCounts = [3, 2, 1, 0].map(
    (level) =>
      rows.filter((row) => row.student.desirableAttributesLevel === level).length
  );
  const readingCounts = [3, 2, 1, 0].map(
    (level) =>
      rows.filter((row) => row.student.readingThinkingWritingLevel === level).length
  );
  const activityCounts = ['pass', 'fail', 'pending'].map(
    (result) => rows.filter((row) => row.student.activityResult === result).length
  );
  const schoolLogo = report.schoolLogoUrl || '/logo/logo-single.png';
  return (
    <Document title={`ปพ.5-${report.subject.code ?? report.subject.name}`}>
      <Page size="A4" orientation="portrait" style={styles.coverPage}>
        <Image src={schoolLogo} style={styles.coverLogo} />
        <Text style={styles.coverTitle}>แบบบันทึกผลการเรียนประจำรายวิชา</Text>

        <View style={styles.coverFields}>
          <View style={styles.coverFieldRow}>
            <Text>โรงเรียน</Text>
            <Text style={[styles.coverField, { flex: 1 }]}>{report.schoolName}</Text>
          </View>
          <View style={styles.coverFieldRow}>
            <Text>อำเภอ / เขต</Text>
            <Text style={[styles.coverField, { flex: 1 }]} />
            <Text>จังหวัด</Text>
            <Text style={[styles.coverField, { flex: 1 }]} />
          </View>
          <View style={styles.coverFieldRow}>
            <Text>ชั้นเรียนศึกษา</Text>
            <Text style={[styles.coverField, { width: 74 }]}>
              {report.classroom.gradeLevel ?? '-'}
            </Text>
            <Text>ห้อง</Text>
            <Text style={[styles.coverField, { width: 70 }]}>{report.classroom.name}</Text>
            <Text>ภาคเรียน</Text>
            <Text style={[styles.coverField, { width: 44 }]}>{report.semesterName}</Text>
            <Text>ปีการศึกษา</Text>
            <Text style={[styles.coverField, { flex: 1 }]}>
              {report.classroom.academicYear}
            </Text>
          </View>
          <View style={styles.coverFieldRow}>
            <Text>รายวิชา</Text>
            <Text style={[styles.coverField, { flex: 1 }]}>{report.subject.name}</Text>
            <Text>รหัสวิชา</Text>
            <Text style={[styles.coverField, { width: 110 }]}>
              {report.subject.code ?? '-'}
            </Text>
          </View>
          <View style={styles.coverFieldRow}>
            <Text>หน่วยกิต</Text>
            <Text style={[styles.coverField, { width: 80 }]}>
              {report.subject.credits || '-'}
            </Text>
            <Text>เวลาเรียน</Text>
            <Text style={[styles.coverField, { width: 80 }]} />
            <Text>ชั่วโมง/สัปดาห์</Text>
          </View>
          <View style={styles.coverFieldRow}>
            <Text>ครูผู้สอน</Text>
            <Text style={[styles.coverField, { flex: 1 }]}>{teacherName(report)}</Text>
          </View>
          <View style={styles.coverFieldRow}>
            <Text>ครูที่ปรึกษา</Text>
            <Text style={[styles.coverField, { flex: 1 }]} />
          </View>
        </View>

        <Text style={styles.coverSectionTitle}>สรุปผลการประเมิน</Text>
        <View style={styles.coverTable}>
          <View style={styles.coverTableRow}>
            <View style={[styles.coverTableCell, { width: 82 }]}><Text>จำนวนนักเรียน</Text></View>
            {gradeLevels.map((grade) => (
              <View key={grade} style={[styles.coverTableCell, { flex: 1 }]}>
                <Text>{grade}</Text>
              </View>
            ))}
            {specialResults.map((result) => (
              <View key={result} style={[styles.coverTableCell, { width: 30 }]}>
                <Text>{result}</Text>
              </View>
            ))}
          </View>
          <View style={styles.coverTableRow}>
            <View style={[styles.coverTableCell, { width: 82 }]}><Text>{rows.length} คน</Text></View>
            {gradeLevels.map((grade) => (
              <View key={grade} style={[styles.coverTableCell, { flex: 1 }]}>
                <Text>{gradeCounts[grade]}</Text>
              </View>
            ))}
            {specialResults.map((result) => (
              <View key={result} style={[styles.coverTableCell, { width: 30 }]}>
                <Text>{specialCounts[result]}</Text>
              </View>
            ))}
          </View>
          <View style={styles.coverTableRow}>
            <View style={[styles.coverTableCell, { width: 82 }]}><Text>คิดเป็นร้อยละ</Text></View>
            {gradeLevels.map((grade) => (
              <View key={grade} style={[styles.coverTableCell, { flex: 1 }]}>
                <Text>{rows.length ? ((gradeCounts[grade] / rows.length) * 100).toFixed(1) : '0'}</Text>
              </View>
            ))}
            {specialResults.map((result) => (
              <View key={result} style={[styles.coverTableCell, { width: 30 }]}>
                <Text>
                  {rows.length ? ((specialCounts[result] / rows.length) * 100).toFixed(1) : '0'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.coverSectionTitle}>ผลการประเมินคุณลักษณะอันพึงประสงค์</Text>
        <View style={styles.coverTable}>
          <View style={styles.coverTableRow}>
            {['3=ดีเยี่ยม', '2=ดี', '1=ผ่าน', '0=ไม่ผ่าน'].map((label) => (
              <View key={label} style={[styles.coverTableCell, { flex: 1 }]}><Text>{label}</Text></View>
            ))}
          </View>
          <View style={styles.coverTableRow}>
            {desirableCounts.map((value, index) => (
              <View key={index} style={[styles.coverTableCell, { flex: 1 }]}><Text>{value}</Text></View>
            ))}
          </View>
        </View>

        <Text style={styles.coverSectionTitle}>ผลการประเมินการอ่าน คิดวิเคราะห์และเขียน</Text>
        <View style={styles.coverTable}>
          <View style={styles.coverTableRow}>
            {['3=ดีเยี่ยม', '2=ดี', '1=ผ่าน', '0=ไม่ผ่าน'].map((label) => (
              <View key={label} style={[styles.coverTableCell, { flex: 1 }]}><Text>{label}</Text></View>
            ))}
          </View>
          <View style={styles.coverTableRow}>
            {readingCounts.map((value, index) => (
              <View key={index} style={[styles.coverTableCell, { flex: 1 }]}><Text>{value}</Text></View>
            ))}
          </View>
        </View>

        <Text style={styles.coverSectionTitle}>ผลกิจกรรมพัฒนาผู้เรียน</Text>
        <View style={styles.coverTable}>
          <View style={styles.coverTableRow}>
            {['ผ่าน', 'ไม่ผ่าน', 'รอประเมิน'].map((label) => (
              <View key={label} style={[styles.coverTableCell, { flex: 1 }]}><Text>{label}</Text></View>
            ))}
          </View>
          <View style={styles.coverTableRow}>
            {activityCounts.map((value, index) => (
              <View key={index} style={[styles.coverTableCell, { flex: 1 }]}><Text>{value}</Text></View>
            ))}
          </View>
        </View>

        <Text style={styles.coverSectionTitle}>การอนุมัติผลการเรียน</Text>
        {[
          ['○ อนุมัติ   ○ ไม่อนุมัติ', teacherName(report), 'ครูผู้สอน'],
          ['○ อนุมัติ   ○ ไม่อนุมัติ', '-', 'หัวหน้ากลุ่มสาระการเรียนรู้'],
          ['○ อนุมัติ   ○ ไม่อนุมัติ', '-', 'หัวหน้างานทะเบียนวัดผล'],
          ['เรียนเสนอเพื่อโปรดพิจารณา', personName(submission.approved_by), 'รองผู้อำนวยการฝ่ายวิชาการ'],
        ].map(([choice, name, role]) => (
          <View key={role} style={styles.coverApprovalRow}>
            <Text style={{ width: 150 }}>{choice}</Text>
            <Text>ลงชื่อ</Text>
            <View style={styles.coverSignatureLine} />
            <Text style={{ flex: 1 }}>({name})  {role}</Text>
          </View>
        ))}
        <View style={[styles.coverApprovalRow, { marginTop: 22, justifyContent: 'center' }]}>
          <Text>○ อนุมัติ   ○ ไม่อนุมัติ</Text>
          <View style={[styles.coverSignatureLine, { marginLeft: 28 }]} />
        </View>
        <Text style={{ marginTop: 5, textAlign: 'center' }}>
          ({personName(submission.approved_by)}){'\n'}ผู้อำนวยการโรงเรียน
        </Text>
      </Page>

      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.5)</Text>
        <Text style={styles.subtitle}>{report.schoolName}</Text>
        <View style={styles.info}>
          <Text>
            รายวิชา {report.subject.code ? `${report.subject.code} ` : ''}{report.subject.name}
          </Text>
          <Text>ชั้น {report.classroom.name}</Text>
          <Text>
            ภาคเรียนที่ {report.semesterName} ปีการศึกษา {report.classroom.academicYear}
          </Text>
          <Text>ครูผู้สอน {teacherName(report)}</Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.header]}>
            <View style={[styles.cell, styles.number]}><Text>เลขที่</Text></View>
            <View style={[styles.cell, styles.code]}><Text>รหัสนักเรียน</Text></View>
            <View style={[styles.cell, styles.name]}><Text>ชื่อ-นามสกุล</Text></View>
            <View style={[styles.cell, styles.score]}><Text>งาน</Text></View>
            <View style={[styles.cell, styles.score]}><Text>แบบทดสอบ</Text></View>
            <View style={[styles.cell, styles.score]}><Text>กลางภาค</Text></View>
            <View style={[styles.cell, styles.score]}><Text>ปลายภาค</Text></View>
            <View style={[styles.cell, styles.score]}><Text>อื่น ๆ</Text></View>
            <View style={[styles.cell, styles.total]}><Text>รวม/100</Text></View>
            <View style={[styles.cell, styles.grade]}><Text>ผลการเรียน</Text></View>
          </View>
          {rows.map((row, index) => (
            <View key={row.student.id} style={styles.row} wrap={false}>
              <View style={[styles.cell, styles.number]}><Text>{row.student.studentNumber ?? index + 1}</Text></View>
              <View style={[styles.cell, styles.code]}><Text>{row.student.studentCode ?? '-'}</Text></View>
              <View style={[styles.cell, styles.name]}>
                <Text>
                  {`${row.student.firstName ?? ''} ${row.student.lastName ?? ''}`.trim() ||
                    row.student.username}
                </Text>
              </View>
              <View style={[styles.cell, styles.score]}><Text>{row.categoryScores.assignment.toFixed(2)}</Text></View>
              <View style={[styles.cell, styles.score]}><Text>{row.categoryScores.quiz.toFixed(2)}</Text></View>
              <View style={[styles.cell, styles.score]}><Text>{row.categoryScores.midterm.toFixed(2)}</Text></View>
              <View style={[styles.cell, styles.score]}><Text>{row.categoryScores.final.toFixed(2)}</Text></View>
              <View style={[styles.cell, styles.score]}><Text>{row.categoryScores.other.toFixed(2)}</Text></View>
              <View style={[styles.cell, styles.total]}><Text>{row.normalized.toFixed(2)}</Text></View>
              <View style={[styles.cell, styles.grade]}><Text>{row.grade}</Text></View>
            </View>
          ))}
        </View>

        <View style={styles.signatures} wrap={false}>
          <View style={styles.signature}>
            <View style={styles.signatureSpace} />
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>({teacherName(report)})</Text>
            <Text>ครูผู้สอน</Text>
          </View>
          <View style={styles.signature}>
            <View style={styles.signatureSpace} />
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>({personName(submission.approved_by)})</Text>
            <Text>ผู้ตรวจสอบ/ผู้อนุมัติ</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  report: ScoreReport;
  submission: GradeReviewSubmission;
};

export default function GradeResultPdfDialog({ open, onClose, report, submission }: Props) {
  const document = <GradeResultDocument report={report} submission={submission} />;
  const fileName = `ปพ5-${report.subject.code ?? report.subject.name}-${report.classroom.name}.pdf`;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle>
        พรีวิวใบ ปพ.5
        <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
          ปก A4 แนวตั้ง · ตารางคะแนน A4 แนวนอน
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ p: 2, bgcolor: 'grey.900' }}>
        <Box sx={{ width: 1, aspectRatio: '297 / 210', bgcolor: 'common.white' }}>
          <PDFViewer width="100%" height="100%" showToolbar={false}>
            {document}
          </PDFViewer>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>ปิด</Button>
        <PDFDownloadLink document={document} fileName={fileName} style={{ textDecoration: 'none' }}>
          {({ loading }) => (
            <Button
              variant="contained"
              loading={loading}
              startIcon={<RemixIcon icon="solar:download-minimalistic-bold" />}
            >
              ดาวน์โหลด PDF
            </Button>
          )}
        </PDFDownloadLink>
      </DialogActions>
    </Dialog>
  );
}
