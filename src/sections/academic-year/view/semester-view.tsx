'use client';

import type { Semester } from '../academic-year-actions';

import * as z from 'zod';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { Box, Stack } from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from 'src/auth/hooks';

import {
  listSemesters,
  createSemester,
  deleteSemester,
  updateSemester,
  listAcademicYears,
} from '../academic-year-actions';

// ----------------------------------------------------------------------

const SemesterSchema = z
  .object({
    name: z.string().trim().min(1, { error: 'กรุณากรอกชื่อภาคเรียน!' }),
    startDate: z.string().min(1, { error: 'กรุณาเลือกวันที่เริ่มต้น!' }),
    endDate: z.string().min(1, { error: 'กรุณาเลือกวันที่สิ้นสุด!' }),
    isActive: z.boolean(),
    gradeSubmissionDeadline: z.string(),
    gradeReminderDays: z.number(),
    gradeReminderNotifyInApp: z.boolean(),
    gradeReminderNotifyLine: z.boolean(),
  })
  .refine(
    (data) =>
      !data.startDate ||
      !data.endDate ||
      dayjs(data.endDate).isAfter(data.startDate) ||
      dayjs(data.endDate).isSame(data.startDate, 'day'),
    { path: ['endDate'], error: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น!' }
  )
  .refine((data) => !data.gradeSubmissionDeadline || data.gradeReminderDays >= 1, {
    path: ['gradeReminderDays'],
    error: 'กรุณาระบุจำนวนวันที่เตือนอย่างน้อย 1 วัน!',
  });

type SemesterSchemaType = z.infer<typeof SemesterSchema>;

const DEFAULT_VALUES: SemesterSchemaType = {
  name: '',
  startDate: '',
  endDate: '',
  isActive: true,
  gradeSubmissionDeadline: '',
  gradeReminderDays: 3,
  gradeReminderNotifyInApp: true,
  gradeReminderNotifyLine: true,
};

type Props = {
  academicYearId: string;
};

export function SemesterView({ academicYearId }: Props) {
  const { user } = useAuthContext();
  const isTeacher = user?.role === 'teacher';
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [deletingSemester, setDeletingSemester] = useState<Semester | null>(null);

  const {
    data: semesters = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['semesters', academicYearId],
    queryFn: () => listSemesters(academicYearId),
  });
  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: listAcademicYears,
  });
  const academicYear = academicYears.find((year) => year.id === academicYearId);

  const methods = useForm<SemesterSchemaType>({
    resolver: zodResolver(SemesterSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { handleSubmit, reset, control } = methods;
  const gradeSubmissionDeadline = useWatch({ control, name: 'gradeSubmissionDeadline' });

  const saveMutation = useMutation({
    mutationFn: (data: SemesterSchemaType) => {
      const params = {
        name: data.name.trim(),
        startDate: dayjs(data.startDate).format('YYYY-MM-DD'),
        endDate: dayjs(data.endDate).format('YYYY-MM-DD'),
        isActive: data.isActive,
        gradeSubmissionDeadline: data.gradeSubmissionDeadline
          ? dayjs(data.gradeSubmissionDeadline).format('YYYY-MM-DD')
          : undefined,
        gradeReminderDays: data.gradeSubmissionDeadline ? data.gradeReminderDays : undefined,
        gradeReminderNotifyInApp: data.gradeReminderNotifyInApp,
        gradeReminderNotifyLine: data.gradeReminderNotifyLine,
      };

      return editingSemester
        ? updateSemester(editingSemester.id, params)
        : createSemester({ academicYearId, ...params });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['semesters', academicYearId] });
      setDialogOpen(false);
      setEditingSemester(null);
      reset(DEFAULT_VALUES);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSemester,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['semesters', academicYearId] });
      setDeletingSemester(null);
    },
  });

  const openCreateDialog = () => {
    setEditingSemester(null);
    reset(DEFAULT_VALUES);
    saveMutation.reset();
    setDialogOpen(true);
  };

  const openEditDialog = (semester: Semester) => {
    setEditingSemester(semester);
    reset({
      name: semester.name,
      startDate: semester.start_date ?? '',
      endDate: semester.end_date ?? '',
      isActive: semester.is_active,
      gradeSubmissionDeadline: semester.grade_submission_deadline ?? '',
      gradeReminderDays: semester.grade_reminder_days ?? 3,
      gradeReminderNotifyInApp: semester.grade_reminder_notify_in_app,
      gradeReminderNotifyLine: semester.grade_reminder_notify_line,
    });
    saveMutation.reset();
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saveMutation.isPending) return;
    setDialogOpen(false);
    setEditingSemester(null);
    reset(DEFAULT_VALUES);
    saveMutation.reset();
  };

  const onSubmit = handleSubmit((data) => saveMutation.mutate(data));

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Box
        sx={{
          mb: 4,
          gap: 2,
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Button
            component={RouterLink}
            href={
              isTeacher ? paths.teacher.departmentAcademicYear.root : paths.admin.academicYear.root
            }
            color="inherit"
            size="small"
            startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
            sx={{ mb: 1.5, color: 'text.secondary' }}
          >
            กลับไปหน้าปีการศึกษา
          </Button>
          <Typography component="h1" variant="h3">
            ภาคเรียน
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            จัดการช่วงเวลาและสถานะของแต่ละภาคเรียน
          </Typography>
        </Box>

        <Button
          variant="contained"
          onClick={openCreateDialog}
          startIcon={<RemixIcon icon="mingcute:add-line" />}
        >
          เพิ่มภาคเรียน
        </Button>
      </Box>

      <Card
        variant="outlined"
        sx={{
          mb: 3,
          p: { xs: 2.5, sm: 3 },
          color: 'primary.darker',
          bgcolor: 'primary.lighter',
          borderColor: 'primary.light',
        }}
      >
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              flexShrink: 0,
              display: 'grid',
              borderRadius: 2,
              color: 'common.white',
              placeItems: 'center',
              bgcolor: 'primary.main',
            }}
          >
            <RemixIcon icon="solar:calendar-date-bold" width={28} />
          </Box>
          <Box>
            <Typography variant="overline" sx={{ opacity: 0.72 }}>
              ปีการศึกษา
            </Typography>
            <Typography variant="h5">{academicYear?.year ?? 'กำลังโหลด...'}</Typography>
            {academicYear?.start_date && academicYear.end_date && (
              <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.76 }}>
                {formatThaiDate(academicYear.start_date)} – {formatThaiDate(academicYear.end_date)}
              </Typography>
            )}
          </Box>
        </Box>
      </Card>

      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
          sx={{ mb: 3 }}
        >
          ไม่สามารถโหลดรายการภาคเรียนได้
        </Alert>
      )}

      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        }}
      >
        <SummaryCard
          icon="solar:calendar-date-bold"
          label="ภาคเรียนทั้งหมด"
          value={semesters.length}
        />
        <SummaryCard
          icon="solar:check-circle-bold"
          label="กำลังใช้งาน"
          value={semesters.filter((semester) => semester.is_active).length}
        />
        <SummaryCard
          icon="solar:clock-circle-bold"
          label="กำหนดช่วงเวลาแล้ว"
          value={semesters.filter((semester) => semester.start_date && semester.end_date).length}
        />
      </Box>

      <Card variant="outlined">
        <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography component="h2" variant="h6">
            รายการภาคเรียน
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
            {isLoading ? 'กำลังโหลด...' : `${semesters.length} รายการ`}
          </Typography>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ชื่อภาคเรียน</TableCell>
                <TableCell>ช่วงเวลา</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">การจัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4}>กำลังโหลด...</TableCell>
                </TableRow>
              )}
              {!isLoading && !semesters.length && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                  >
                    ยังไม่มีภาคเรียน กด “เพิ่มภาคเรียน” เพื่อเริ่มต้น
                  </TableCell>
                </TableRow>
              )}
              {semesters.map((semester) => (
                <TableRow key={semester.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{semester.name}</Typography>
                  </TableCell>
                  <TableCell>
                    {semester.start_date && semester.end_date ? (
                      <Box>
                        <Typography variant="body2">
                          {formatThaiDate(semester.start_date)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          ถึง {formatThaiDate(semester.end_date)}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                        ยังไม่กำหนด
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="soft"
                      color={semester.is_active ? 'success' : 'default'}
                      label={semester.is_active ? 'กำลังใช้งาน' : 'ไม่ได้ใช้งาน'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="แก้ไข">
                      <IconButton
                        size="small"
                        onClick={() => openEditDialog(semester)}
                        aria-label={`แก้ไข ${semester.name}`}
                      >
                        <RemixIcon icon="solar:pen-bold" width={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ลบ">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          deleteMutation.reset();
                          setDeletingSemester(semester);
                        }}
                        aria-label={`ลบ ${semester.name}`}
                      >
                        <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <Form methods={methods} onSubmit={onSubmit}>
          <DialogTitle sx={{ pb: 1 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
            >
              <Box>
                <Typography component="h2" variant="h6">
                  {editingSemester ? 'แก้ไขภาคเรียน' : 'เพิ่มภาคเรียน'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                  กำหนดชื่อ ช่วงเวลา และสถานะของภาคเรียน
                </Typography>
              </Box>
              <IconButton
                onClick={closeDialog}
                disabled={saveMutation.isPending}
                aria-label="ปิดหน้าต่าง"
              >
                <RemixIcon icon="mingcute:close-line" />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ pt: 2 }}>
            <Stack sx={{ py: 2 }}>
              {saveMutation.error && (
                <Alert severity="error" sx={{ mb: 2.5 }}>
                  {saveMutation.error.message}
                </Alert>
              )}

              <Field.Text
                name="name"
                label="ชื่อภาคเรียน *"
                placeholder="เช่น ภาคเรียนที่ 1"
                helperText="ชื่อที่ครูและนักเรียนจะเห็นในระบบ"
                autoFocus
              />

              <Box
                sx={{
                  gap: 2,
                  mt: 2.5,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                }}
              >
                <Field.DatePicker
                  name="startDate"
                  label="วันที่เริ่มต้น *"
                  format="DD/MM/YYYY"
                  minDate={academicYear?.start_date ? dayjs(academicYear.start_date) : undefined}
                  maxDate={academicYear?.end_date ? dayjs(academicYear.end_date) : undefined}
                  slotProps={{ textField: { fullWidth: true, helperText: 'วันเปิดภาคเรียน' } }}
                />
                <Field.DatePicker
                  name="endDate"
                  label="วันที่สิ้นสุด *"
                  format="DD/MM/YYYY"
                  minDate={academicYear?.start_date ? dayjs(academicYear.start_date) : undefined}
                  maxDate={academicYear?.end_date ? dayjs(academicYear.end_date) : undefined}
                  slotProps={{ textField: { fullWidth: true, helperText: 'วันปิดภาคเรียน' } }}
                />
              </Box>

              <Box
                sx={{
                  gap: 2,
                  mt: 2.5,
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: gradeSubmissionDeadline ? 'repeat(2, 1fr)' : '1fr',
                  },
                }}
              >
                <Field.DatePicker
                  name="gradeSubmissionDeadline"
                  label="กำหนดส่งผลการเรียน"
                  format="DD/MM/YYYY"
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      helperText: 'ไม่บังคับ — เว้นว่างไว้หากยังไม่ต้องการเตือนครู',
                    },
                  }}
                />
                {gradeSubmissionDeadline && (
                  <Field.Text
                    name="gradeReminderDays"
                    label="เตือนล่วงหน้ากี่วัน *"
                    type="number"
                    helperText="นับรวมวันครบกำหนด เช่น 3 = เตือนติดต่อกัน 3 วันก่อนถึงวันครบกำหนด"
                    slotProps={{ htmlInput: { min: 1, max: 30, step: 1 } }}
                  />
                )}
              </Box>

              {gradeSubmissionDeadline && (
                <Box
                  sx={{
                    mt: 2.5,
                    p: 2,
                    gap: 1.5,
                    display: 'flex',
                    borderRadius: 1.5,
                    flexDirection: 'column',
                    bgcolor: 'background.neutral',
                  }}
                >
                  <Typography variant="subtitle2">ช่องทางการแจ้งเตือน</Typography>
                  <Field.Switch
                    name="gradeReminderNotifyInApp"
                    label="แจ้งเตือนในระบบ"
                    helperText="ขึ้นกระดิ่งแจ้งเตือนในระบบของครู"
                  />
                  <Field.Switch
                    name="gradeReminderNotifyLine"
                    label="แจ้งเตือนผ่าน LINE"
                    helperText="ส่งเฉพาะครูที่เชื่อมบัญชี LINE แล้ว"
                  />
                </Box>
              )}

              {editingSemester && (
                <Field.Switch
                  name="isActive"
                  label="เปิดใช้งานภาคเรียนนี้"
                  helperText="ภาคเรียนที่ปิดใช้งานจะยังคงอยู่ แต่แสดงสถานะไม่ได้ใช้งาน"
                  sx={{ mt: 2.5 }}
                />
              )}
            </Stack>
          </DialogContent>

          <DialogActions>
            <Button color="inherit" onClick={closeDialog} disabled={saveMutation.isPending}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="contained" loading={saveMutation.isPending}>
              {editingSemester ? 'บันทึกการแก้ไข' : 'เพิ่มภาคเรียน'}
            </Button>
          </DialogActions>
        </Form>
      </Dialog>

      <Dialog
        open={!!deletingSemester}
        onClose={() => !deleteMutation.isPending && setDeletingSemester(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการลบภาคเรียน</DialogTitle>
        <DialogContent>
          {deleteMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteMutation.error.message}
            </Alert>
          )}
          <Typography variant="body2">
            ต้องการลบ <strong>{deletingSemester?.name}</strong> ใช่หรือไม่?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            การมอบหมายครู งาน และคะแนนที่เชื่อมโยงกับภาคเรียนนี้อาจถูกลบตามไปด้วย
            และไม่สามารถย้อนกลับได้
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => setDeletingSemester(null)}
            disabled={deleteMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={deleteMutation.isPending}
            onClick={() => deletingSemester && deleteMutation.mutate(deletingSemester.id)}
          >
            ลบภาคเรียน
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

// ----------------------------------------------------------------------

type SummaryCardProps = {
  icon: 'solar:calendar-date-bold' | 'solar:check-circle-bold' | 'solar:clock-circle-bold';
  label: string;
  value: number;
};

function SummaryCard({ icon, label, value }: SummaryCardProps) {
  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            display: 'grid',
            borderRadius: 1.5,
            color: 'primary.main',
            placeItems: 'center',
            bgcolor: 'background.neutral',
          }}
        >
          <RemixIcon icon={icon} width={25} />
        </Box>
        <Box>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {label}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}

function formatThaiDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}
