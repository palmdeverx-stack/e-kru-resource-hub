'use client';

import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { varAlpha } from 'minimal-shared/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { Upload } from 'src/components/upload';
import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { getRoster } from 'src/sections/teacher-assignment/teacher-assignment-actions';

import { useAuthContext } from 'src/auth/hooks';

import { createAssignment, ASSIGNMENT_CATEGORY_META } from '../assignment-actions';

// ----------------------------------------------------------------------

export const AssignmentCreateSchema = z.object({
  title: z.string().trim().min(1, { error: 'กรุณากรอกชื่องาน' }).max(200),
  description: z.string().trim().max(5000, { error: 'รายละเอียดต้องไม่เกิน 5,000 ตัวอักษร' }),
  fullScore: z
    .string()
    .min(1, { error: 'กรุณากรอกคะแนนเต็ม' })
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) > 0, {
      error: 'คะแนนเต็มต้องมากกว่า 0',
    }),
  dueAt: z
    .string()
    .nullable()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
      error: 'วันและเวลาครบกำหนดส่งไม่ถูกต้อง',
    })
    .refine((value) => !value || new Date(value).getTime() > Date.now(), {
      error: 'กรุณาเลือกวันและเวลาในอนาคต',
    }),
});

const FILE_ACCEPT = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/zip': ['.zip'],
};
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 8;

type Props = {
  teacherAssignmentId: string;
  returnTab?: string;
};

export function AssignmentCreateView({ teacherAssignmentId, returnTab }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const isTeacher = user?.role === 'teacher';
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');

  const resolvedCategory = 'assignment';
  const meta = ASSIGNMENT_CATEGORY_META[resolvedCategory];

  const detailPath = isTeacher
    ? paths.teacher.assignmentDetail(teacherAssignmentId)
    : paths.admin.teacherAssignment.detail(teacherAssignmentId);
  const successPath = returnTab ? `${detailPath}?tab=${returnTab}` : detailPath;

  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ['roster', teacherAssignmentId],
    queryFn: () => getRoster(teacherAssignmentId),
  });

  const methods = useForm({
    resolver: zodResolver(AssignmentCreateSchema),
    defaultValues: { title: meta.defaultTitle, description: '', fullScore: '100', dueAt: null },
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string;
      description: string;
      fullScore: string;
      dueAt: string | null;
    }) =>
      createAssignment(teacherAssignmentId, {
        title: data.title.trim(),
        description: data.description.trim() || undefined,
        fullScore: Number(data.fullScore),
        dueAt: data.dueAt,
        category: resolvedCategory,
        files,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['assignments', teacherAssignmentId] });
      await queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      router.push(successPath);
    },
  });

  const addFiles = (acceptedFiles: File[]) => {
    setFileError('');
    const uniqueFiles = acceptedFiles.filter(
      (file) => !files.some((current) => current.name === file.name && current.size === file.size)
    );
    const nextFiles = [...files, ...uniqueFiles];
    if (nextFiles.length > MAX_FILES) {
      setFileError(`แนบไฟล์ได้สูงสุด ${MAX_FILES} ไฟล์`);
      setFiles(nextFiles.slice(0, MAX_FILES));
      return;
    }
    setFiles(nextFiles);
  };

  const teacherName = roster?.teacher
    ? `${roster.teacher.first_name ?? ''} ${roster.teacher.last_name ?? ''}`.trim() ||
      roster.teacher.username
    : '-';
  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Button
        component={RouterLink}
        href={successPath}
        color="inherit"
        startIcon={<RemixIcon icon="solar:reply-bold" />}
        sx={{ mb: 2 }}
      >
        กลับหน้ารายวิชา
      </Button>

      <Card
        sx={{
          mb: 3,
          p: { xs: 3 },
          color: 'common.white',
          overflow: 'hidden',
          position: 'relative',
          background: (theme) =>
            `linear-gradient(135deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.main} 70%, ${theme.vars.palette.primary.light} 100%)`,
          '&::after': {
            right: -80,
            bottom: -150,
            width: 240,
            height: 240,
            content: '""',
            borderRadius: '50%',
            position: 'absolute',
            bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.1),
          },
        }}
      >
        <Box
          sx={{ zIndex: 1, gap: 2, display: 'flex', position: 'relative', alignItems: 'center' }}
        >
          <Box
            sx={(theme) => ({
              width: 60,
              height: 60,
              display: 'grid',
              flexShrink: 0,
              borderRadius: 2,
              placeItems: 'center',
              bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
            })}
          >
            <RemixIcon icon="solar:notes-bold-duotone" width={34} />
          </Box>
          <Box>
            <Typography variant="overline" sx={{ opacity: 0.78 }}>
              {meta.sectionTitle}
            </Typography>
            <Typography component="h1" variant="h3">
              {meta.createHeading}
            </Typography>
            <Typography sx={{ mt: 0.5, opacity: 0.78 }}>
              กำหนดรายละเอียด คะแนน และเอกสารที่นักเรียนต้องใช้
            </Typography>
          </Box>
        </Box>
      </Card>

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' },
        }}
      >
        <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Box sx={{ mb: 3 }}>
            <Typography component="h2" variant="h5">
              รายละเอียดงาน
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              ช่องที่มีเครื่องหมาย * จำเป็นต้องกรอก
            </Typography>
          </Box>

          {(createMutation.error || fileError) && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {createMutation.error?.message ?? fileError}
            </Alert>
          )}

          <Form
            methods={methods}
            onSubmit={methods.handleSubmit((data) => createMutation.mutate(data))}
          >
            <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
              <Field.Text
                name="title"
                label="ชื่อรายการ *"
                placeholder="เช่น แบบฝึกหัดบทที่ 1"
                helperText="ใช้ชื่อสั้น กระชับ และบอกสิ่งที่นักเรียนต้องทำ"
                autoFocus
              />
              <Field.Text
                name="description"
                label="คำชี้แจง"
                placeholder="อธิบายขั้นตอน สิ่งที่ต้องส่ง หรือเกณฑ์การให้คะแนน"
                helperText="ไม่บังคับ แต่ช่วยให้นักเรียนเข้าใจงานได้ชัดเจนขึ้น"
                multiline
                minRows={5}
              />
              <Box
                sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}
              >
                <Field.Text
                  name="fullScore"
                  label="คะแนนเต็ม *"
                  type="number"
                  helperText="กรอกจำนวนคะแนนที่มากกว่า 0"
                  slotProps={{ htmlInput: { min: 1, step: 0.5 } }}
                />
                <Field.DateTimePicker
                  name="dueAt"
                  label="วันและเวลาครบกำหนดส่ง"
                  disablePast
                  ampm={false}
                  slotProps={{
                    textField: { helperText: 'ไม่บังคับ เว้นว่างได้หากไม่มีกำหนดส่ง' },
                  }}
                />
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1">ไฟล์และรูปภาพประกอบ</Typography>
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                  แนบเอกสาร ใบงาน หรือรูปตัวอย่างให้นักเรียนดาวน์โหลดได้
                </Typography>
                <Upload
                  multiple
                  value={files}
                  accept={FILE_ACCEPT}
                  maxSize={MAX_FILE_SIZE}
                  disabled={createMutation.isPending}
                  onDrop={addFiles}
                  onRemove={(file) => {
                    setFileError('');
                    setFiles((current) => current.filter((item) => item !== file));
                  }}
                  placeholder={
                    <Box sx={{ py: 3, textAlign: 'center' }}>
                      <RemixIcon
                        icon="eva:cloud-upload-fill"
                        width={48}
                        sx={{ color: 'primary.main' }}
                      />
                      <Typography variant="subtitle1" sx={{ mt: 1 }}>
                        ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        รูปภาพ, PDF, Word, Excel, PowerPoint หรือ ZIP
                      </Typography>
                    </Box>
                  }
                  helperText={`แนบได้สูงสุด ${MAX_FILES} ไฟล์ ไฟล์ละไม่เกิน 10MB`}
                  sx={{ minHeight: 190 }}
                />
                {!!files.length && (
                  <Button
                    size="small"
                    color="inherit"
                    startIcon={<RemixIcon icon="solar:trash-bin-trash-bold" />}
                    onClick={() => {
                      setFiles([]);
                      setFileError('');
                    }}
                    sx={{ mt: 1 }}
                  >
                    ลบไฟล์ทั้งหมด
                  </Button>
                )}
              </Box>

              <Box
                sx={{
                  gap: 1.5,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  flexDirection: { xs: 'column-reverse', sm: 'row' },
                }}
              >
                <Button
                  component={RouterLink}
                  href={successPath}
                  color="inherit"
                  size="large"
                  disabled={createMutation.isPending}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  loading={createMutation.isPending}
                  startIcon={<RemixIcon icon="solar:check-circle-bold" />}
                  sx={{ minWidth: 180 }}
                >
                  {meta.createHeading}
                </Button>
              </Box>
            </Box>
          </Form>
        </Card>

        <Stack spacing={2.5}>
          <Card variant="outlined" sx={{ p: 3 }}>
            <Typography component="h2" variant="h6">
              รายวิชาและผู้เรียน
            </Typography>
            <Divider sx={{ my: 2 }} />
            {rosterLoading ? (
              <Stack spacing={1.5}>
                <Skeleton height={28} />
                <Skeleton height={28} />
                <Skeleton height={28} />
              </Stack>
            ) : (
              <Stack spacing={1.75}>
                <ContextRow
                  icon="solar:notebook-bold-duotone"
                  label="รายวิชา"
                  value={`${roster?.subjectCode ? `${roster.subjectCode} · ` : ''}${roster?.subjectName ?? '-'}`}
                />
                <ContextRow
                  icon="solar:users-group-rounded-bold"
                  label="ห้องเรียน"
                  value={roster?.classroomName ?? '-'}
                />
                <ContextRow icon="solar:user-rounded-bold" label="ครูผู้สอน" value={teacherName} />
                <ContextRow
                  icon="solar:calendar-date-bold"
                  label="ภาคเรียน"
                  value={`${roster?.semesterName ?? '-'} · ${roster?.academicYear ?? '-'}`}
                />
              </Stack>
            )}
          </Card>

          <Alert severity="info" icon={<RemixIcon icon="solar:info-circle-bold" />}>
            หลังสร้างงาน ระบบจะเพิ่มงานให้นักเรียนทุกคนในห้องนี้โดยอัตโนมัติ
          </Alert>

          {!!files.length && (
            <Chip
              icon={<RemixIcon icon="solar:file-text-bold" />}
              label={`เลือกแล้ว ${files.length} ไฟล์`}
              color="primary"
              variant="soft"
              sx={{ alignSelf: 'flex-start' }}
            />
          )}
        </Stack>
      </Box>
    </Container>
  );
}

function ContextRow({
  icon,
  label,
  value,
}: {
  icon:
    | 'solar:notebook-bold-duotone'
    | 'solar:users-group-rounded-bold'
    | 'solar:user-rounded-bold'
    | 'solar:calendar-date-bold';
  label: string;
  value: string;
}) {
  return (
    <Box sx={{ gap: 1.25, display: 'flex', alignItems: 'flex-start' }}>
      <RemixIcon icon={icon} width={21} sx={{ mt: 0.25, color: 'primary.main' }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}
