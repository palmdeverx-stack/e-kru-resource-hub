'use client';

import type { ScheduleApproval } from '../schedule-approvals-actions';
import type { SchedulePeriod } from '../../schedule-builder/schedule-period-actions';
import type { ScheduleMode } from '../../schedule-builder/schedule-settings-actions';
import type {
  ClassroomScheduleSlot,
  ClassroomScheduleAssignment,
} from '../../schedule-builder/schedule-builder-actions';

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

// ----------------------------------------------------------------------

Font.register({
  family: 'LINE Seed Sans TH',
  fonts: [
    { src: '/fonts/LINESeedSansTH-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/LINESeedSansTH-Bold.ttf', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 9,
    color: '#172B4D',
    fontFamily: 'LINE Seed Sans TH',
  },
  title: { fontSize: 18, fontWeight: 700, textAlign: 'center' },
  subtitle: { marginTop: 3, fontSize: 10, textAlign: 'center', color: '#637381' },
  details: {
    marginTop: 16,
    padding: 10,
    gap: 4,
    display: 'flex',
    flexDirection: 'row',
    borderRadius: 4,
    backgroundColor: '#F4F6F8',
  },
  detail: { width: '25%' },
  detailLabel: { fontSize: 7, color: '#637381' },
  detailValue: { marginTop: 2, fontSize: 9, fontWeight: 700 },
  table: { marginTop: 14, borderTop: '1 solid #DFE3E8', borderLeft: '1 solid #DFE3E8' },
  row: { display: 'flex', flexDirection: 'row' },
  dayCell: {
    width: 78,
    padding: 6,
    fontWeight: 700,
    backgroundColor: '#F4F6F8',
    borderRight: '1 solid #DFE3E8',
    borderBottom: '1 solid #DFE3E8',
  },
  subjectsCell: {
    flex: 1,
    minHeight: 38,
    padding: 5,
    gap: 4,
    display: 'flex',
    flexDirection: 'row',
    borderRight: '1 solid #DFE3E8',
    borderBottom: '1 solid #DFE3E8',
  },
  subject: {
    padding: 5,
    borderRadius: 3,
    backgroundColor: '#EAF2FF',
  },
  subjectName: { fontSize: 8, fontWeight: 700 },
  subjectMeta: { marginTop: 1, fontSize: 7, color: '#45617D' },
  approvals: {
    marginTop: 18,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  approval: {
    width: 260,
    alignItems: 'center',
  },
  signature: { width: 150, height: 54, objectFit: 'contain' },
  signatureSpace: { width: 150, height: 54 },
  signatureLine: { width: 180, marginTop: 3, borderTop: '1 solid #637381' },
  approver: { marginTop: 4, fontWeight: 700 },
  approvedAt: { marginTop: 2, fontSize: 7, color: '#637381' },
});

const DAYS = [
  { value: 1, label: 'วันจันทร์' },
  { value: 2, label: 'วันอังคาร' },
  { value: 3, label: 'วันพุธ' },
  { value: 4, label: 'วันพฤหัสบดี' },
  { value: 5, label: 'วันศุกร์' },
  { value: 6, label: 'วันเสาร์' },
  { value: 7, label: 'วันอาทิตย์' },
];

const A4_PORTRAIT_RATIO = '210 / 297';

function fullName(person: { first_name: string | null; last_name: string | null } | null) {
  return `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim() || '-';
}

function ScheduleApprovalPdf({
  approval,
  schedules,
  assignments,
  periods,
  scheduleMode,
  signature,
  approverName,
}: {
  approval: ScheduleApproval;
  schedules: ClassroomScheduleSlot[];
  assignments: ClassroomScheduleAssignment[];
  periods: SchedulePeriod[];
  scheduleMode: ScheduleMode;
  signature: string;
  approverName: string;
}) {
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const periodById = new Map(periods.map((period) => [period.id, period]));
  const visibleDays = DAYS.filter(
    (day) => day.value <= 5 || schedules.some((slot) => slot.day_of_week === day.value)
  );
  const signedAt = approval.signature_signed_at ?? approval.approved_at;

  return (
    <Document title={`ตารางเรียน ${approval.classroom?.name ?? ''}`}>
      <Page size="A4" orientation="portrait" style={styles.page} wrap={false}>
        <Text style={styles.title}>ตารางเรียนประจำสัปดาห์</Text>
        <Text style={styles.subtitle}>
          ชั้น {approval.classroom?.grade_level ?? '-'} {approval.classroom?.name ?? ''}
        </Text>

        <View style={styles.details}>
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>ปีการศึกษา</Text>
            <Text style={styles.detailValue}>
              {approval.semester?.academic_year?.year ?? '-'}
            </Text>
          </View>
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>ภาคเรียน</Text>
            <Text style={styles.detailValue}>{approval.semester?.name ?? '-'}</Text>
          </View>
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>ผู้ส่งตรวจ</Text>
            <Text style={styles.detailValue}>{fullName(approval.submitted_by)}</Text>
          </View>
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>จำนวนคาบ</Text>
            <Text style={styles.detailValue}>{schedules.length} คาบ</Text>
          </View>
        </View>

        <View style={styles.table}>
          {visibleDays.map((day) => {
            const slots = schedules
              .filter((slot) => slot.day_of_week === day.value)
              .sort((a, b) => a.start_time.localeCompare(b.start_time));

            return (
              <View key={day.value} style={styles.row}>
                <Text style={styles.dayCell}>{day.label}</Text>
                <View style={styles.subjectsCell}>
                  {slots.length ? (
                    slots.map((slot) => {
                      const assignment = assignmentById.get(slot.teacher_assignment_id);
                      const period = scheduleMode === 'period' && slot.schedule_period_id
                        ? periodById.get(slot.schedule_period_id)
                        : scheduleMode === 'period'
                          ? periods.find(
                            (item) =>
                              item.start_time.slice(0, 5) === slot.start_time.slice(0, 5) &&
                              item.end_time.slice(0, 5) === slot.end_time.slice(0, 5)
                            )
                          : undefined;
                      return (
                        <View key={slot.id} style={styles.subject}>
                          <Text style={styles.subjectName}>
                            {period?.period_number ? `คาบ ${period.period_number} · ` : ''}
                            {assignment?.subject?.name ?? 'ไม่ระบุวิชา'}
                          </Text>
                          <Text style={styles.subjectMeta}>
                            {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} น.
                          </Text>
                          <Text style={styles.subjectMeta}>
                            ครู{fullName(assignment?.teacher ?? null)}
                          </Text>
                          {slot.location_name && (
                            <Text style={styles.subjectMeta}>สถานที่ {slot.location_name}</Text>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.subjectMeta}>ไม่มีคาบเรียน</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.approvals}>
          <View style={styles.approval}>
            {approval.submitter_signature_url ? (
              <Image src={approval.submitter_signature_url} style={styles.signature} />
            ) : (
              <View style={styles.signatureSpace} />
            )}
            <View style={styles.signatureLine} />
            <Text style={styles.approver}>({fullName(approval.submitted_by)})</Text>
            <Text>{approval.submitted_by?.position_title || 'ผู้จัดทำตารางเรียน'}</Text>
            <Text style={styles.approvedAt}>
              {approval.submitter_signature_signed_at
                ? `ลงนามวันที่ ${new Intl.DateTimeFormat('th-TH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(approval.submitter_signature_signed_at))}`
                : 'ยังไม่มีลายเซ็นผู้จัดทำ'}
            </Text>
          </View>

          <View style={styles.approval}>
            {signature ? (
              <Image src={signature} style={styles.signature} />
            ) : (
              <View style={styles.signatureSpace} />
            )}
            <View style={styles.signatureLine} />
            <Text style={styles.approver}>({approverName})</Text>
            <Text>{approval.approved_by?.position_title || 'ผู้อำนวยการโรงเรียน'}</Text>
            <Text style={styles.approvedAt}>
              {signedAt
                ? `ลงนามวันที่ ${new Intl.DateTimeFormat('th-TH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(signedAt))}`
                : 'รอผู้อำนวยการลงนาม'}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  approval: ScheduleApproval;
  schedules: ClassroomScheduleSlot[];
  assignments: ClassroomScheduleAssignment[];
  periods: SchedulePeriod[];
  scheduleMode: ScheduleMode;
  signature: string;
  approverName: string;
};

export default function ScheduleApprovalPdfDialog({
  open,
  onClose,
  approval,
  schedules,
  assignments,
  periods,
  scheduleMode,
  signature,
  approverName,
}: Props) {
  const document = (
    <ScheduleApprovalPdf
      approval={approval}
      schedules={schedules}
      assignments={assignments}
      periods={periods}
      scheduleMode={scheduleMode}
      signature={signature}
      approverName={approverName}
    />
  );
  const fileName = `ตารางเรียน-${approval.classroom?.grade_level ?? ''}-${approval.classroom?.name ?? ''}.pdf`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      slotProps={{
        paper: {
          sx: {
            height: { xs: '100%', md: 'calc(100vh - 32px)' },
            m: { xs: 0, md: 2 },
          },
        },
      }}
    >
      <DialogTitle>
        พรีวิวเอกสาร PDF
        <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
          A4 แนวตั้ง · 210 × 297 มม.
        </Typography>
      </DialogTitle>
      <DialogContent
        sx={{
          p: { xs: 1, md: 2 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.900',
        }}
      >
        <Box
          sx={{
            width: {
              xs: 1,
              md: 'min(100%, calc((100vh - 180px) * 0.7070707))',
            },
            maxHeight: 1,
            aspectRatio: A4_PORTRAIT_RATIO,
            overflow: 'hidden',
            bgcolor: 'common.white',
            boxShadow: 24,
          }}
        >
          <PDFViewer
            width="100%"
            height="100%"
            showToolbar={false}
          >
            {document}
          </PDFViewer>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ปิด
        </Button>
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
