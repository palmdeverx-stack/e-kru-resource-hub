'use client';

import type { SchoolDocumentTemplate } from '../document-catalog';
import type { ScoreReport } from 'src/sections/teacher-assignment/score-report-actions';
import type { GradeReviewSubmission } from 'src/sections/grade-review/grade-review-actions';

import {
  Font,
  Page,
  Text,
  View,
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

import { GradeResultDocument } from 'src/sections/grade-review/components/grade-result-pdf-dialog';

// ----------------------------------------------------------------------

Font.register({
  family: 'LINE Seed Sans TH',
  fonts: [
    { src: '/fonts/LINESeedSansTH-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/LINESeedSansTH-Bold.ttf', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'LINE Seed Sans TH', color: '#111827' },
  sample: { textAlign: 'center', color: '#9CA3AF', fontSize: 8 },
  title: { marginTop: 18, fontSize: 18, fontWeight: 700, textAlign: 'center' },
  school: { marginTop: 4, fontSize: 11, textAlign: 'center' },
  meta: {
    marginTop: 20,
    padding: 10,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    border: '1 solid #374151',
  },
  section: { marginTop: 14 },
  sectionTitle: { padding: 5, fontWeight: 700, backgroundColor: '#E5E7EB' },
  lines: { padding: 10, border: '1 solid #9CA3AF', borderTop: 0 },
  line: { marginBottom: 7, borderBottom: '1 dotted #9CA3AF' },
  signatures: {
    marginTop: 34,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  signature: { width: 210, textAlign: 'center' },
});

const SAMPLE_PP5_REPORT: ScoreReport = {
  teacherAssignmentId: 'sample',
  semesterId: 'sample-semester',
  schoolName: 'โรงเรียนตัวอย่าง',
  schoolLogoUrl: null,
  teacher: { firstName: 'ครู', lastName: 'ตัวอย่าง', username: 'teacher' },
  subject: { name: 'ภาษาไทย', code: 'ท101', credits: 1.5 },
  classroom: { id: 'sample-classroom', name: '1', gradeLevel: 'ป.6', academicYear: '2569' },
  semesterName: '1',
  assignments: [
    { id: 'work', title: 'งานระหว่างเรียน', category: 'assignment', fullScore: 30 },
    { id: 'quiz', title: 'แบบทดสอบ', category: 'quiz', fullScore: 10 },
    { id: 'midterm', title: 'กลางภาค', category: 'midterm', fullScore: 20 },
    { id: 'final', title: 'ปลายภาค', category: 'final', fullScore: 35 },
    { id: 'other', title: 'จิตพิสัย', category: 'other', fullScore: 5 },
  ],
  students: [
    ['65001', 'เด็กชายตัวอย่าง', 'หนึ่ง', [27, 9, 18, 32, 5]],
    ['65002', 'เด็กหญิงตัวอย่าง', 'สอง', [23, 8, 15, 27, 4]],
    ['65003', 'เด็กชายตัวอย่าง', 'สาม', [19, 7, 12, 22, 3]],
  ].map(([code, firstName, lastName, values], index) => ({
    id: String(index + 1),
    studentNumber: String(index + 1),
    studentCode: String(code),
    nationalId: null,
    username: String(code),
    firstName: String(firstName),
    lastName: String(lastName),
    nickname: null,
    specialResult: index === 2 ? ('ร' as const) : null,
    desirableAttributesLevel: index === 0 ? 3 : 2,
    readingThinkingWritingLevel: index === 2 ? 1 : 2,
    activityResult: index === 2 ? ('pending' as const) : ('pass' as const),
    scores: Object.fromEntries(
      ['work', 'quiz', 'midterm', 'final', 'other'].map((id, scoreIndex) => [
        id,
        { score: (values as number[])[scoreIndex], status: 'submitted' as const },
      ])
    ),
  })),
};

const SAMPLE_PP5_SUBMISSION: GradeReviewSubmission = {
  id: 'sample',
  status: 'approved',
  submitted_at: '2026-05-01T09:00:00.000Z',
  reviewed_at: '2026-05-02T09:00:00.000Z',
  approved_at: '2026-05-03T09:00:00.000Z',
  note: null,
  submitted_by: { first_name: 'ครู', last_name: 'ตัวอย่าง' },
  reviewed_by: { first_name: 'หัวหน้าวิชาการ', last_name: 'ตัวอย่าง' },
  approved_by: { first_name: 'ผู้อำนวยการ', last_name: 'ตัวอย่าง' },
};

function ExampleDocument({ template }: { template: SchoolDocumentTemplate }) {
  const landscape = template.paper === 'A4 แนวนอน';
  return (
    <Document title={`ตัวอย่าง-${template.code}-${template.name}`}>
      <Page size="A4" orientation={landscape ? 'landscape' : 'portrait'} style={styles.page}>
        <Text style={styles.sample}>ตัวอย่างเอกสาร — ข้อมูลสมมติสำหรับดูรูปแบบ</Text>
        <Text style={styles.title}>
          {template.code} {template.name}
        </Text>
        <Text style={styles.school}>โรงเรียนตัวอย่าง สำนักงานเขตพื้นที่การศึกษาตัวอย่าง</Text>
        <View style={styles.meta}>
          <Text>เลขที่เอกสาร DOC-2569-0001</Text>
          <Text>ปีการศึกษา 2569</Text>
          <Text>วันที่ออกเอกสาร 1 พฤษภาคม 2569</Text>
        </View>
        {template.sections.map((section, index) => (
          <View key={section} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>
              {index + 1}. {section}
            </Text>
            <View style={styles.lines}>
              <Text style={styles.line}>
                ข้อมูลตัวอย่าง
                ................................................................................................
              </Text>
              <Text style={styles.line}>
                รายละเอียด
                .......................................................................................................
              </Text>
              {index === 1 && (
                <Text style={styles.line}>
                  ข้อมูลเพิ่มเติม
                  ...................................................................................................
                </Text>
              )}
            </View>
          </View>
        ))}
        <View style={styles.signatures} wrap={false}>
          <Text style={styles.signature}>
            ลงชื่อ ........................................................{'\n'}
            (ผู้จัดทำเอกสาร){'\n'}เจ้าหน้าที่งานทะเบียน
          </Text>
          <Text style={styles.signature}>
            ลงชื่อ ........................................................{'\n'}
            (ผู้รับรองเอกสาร){'\n'}ผู้อำนวยการโรงเรียน
          </Text>
        </View>
      </Page>
    </Document>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  template: SchoolDocumentTemplate;
};

export default function DocumentExamplePdfDialog({ open, onClose, template }: Props) {
  const document =
    template.slug === 'pp5' ? (
      <GradeResultDocument report={SAMPLE_PP5_REPORT} submission={SAMPLE_PP5_SUBMISSION} />
    ) : (
      <ExampleDocument template={template} />
    );
  const landscape = template.paper === 'A4 แนวนอน';
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle>
        ตัวอย่าง PDF · {template.code} {template.name}
        <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
          {template.paper}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ p: 2, display: 'flex', justifyContent: 'center', bgcolor: 'grey.900' }}>
        <Box
          sx={{
            width: landscape ? 1 : { xs: 1, md: 'min(100%, 720px)' },
            aspectRatio: landscape ? '297 / 210' : '210 / 297',
            bgcolor: 'common.white',
          }}
        >
          <PDFViewer width="100%" height="100%" showToolbar={false}>
            {document}
          </PDFViewer>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ปิด
        </Button>
        <PDFDownloadLink
          document={document}
          fileName={`ตัวอย่าง-${template.code}-${template.name}.pdf`}
          style={{ textDecoration: 'none' }}
        >
          {({ loading }) => (
            <Button
              variant="contained"
              loading={loading}
              startIcon={<RemixIcon icon="solar:download-minimalistic-bold" />}
            >
              ดาวน์โหลดตัวอย่าง
            </Button>
          )}
        </PDFDownloadLink>
      </DialogActions>
    </Dialog>
  );
}
