'use client';

import * as z from 'zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { varAlpha } from 'minimal-shared/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
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

import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { getRoster } from 'src/sections/teacher-assignment/teacher-assignment-actions';

import { useAuthContext } from 'src/auth/hooks';

import { createAssignment } from '../assignment-actions';
import {
  QuizBuilder,
  createQuizQuestion,
  type QuizQuestionDraft,
} from '../components/quiz-builder';

// ----------------------------------------------------------------------

const QuizCreateSchema = z.object({
  title: z.string().trim().min(1, { error: 'กรุณากรอกชื่อแบบทดสอบ' }).max(200),
  description: z.string().trim().max(5000, { error: 'คำชี้แจงต้องไม่เกิน 5,000 ตัวอักษร' }),
  dueAt: z
    .string()
    .nullable()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
      error: 'วันและเวลาปิดรับคำตอบไม่ถูกต้อง',
    })
    .refine((value) => !value || new Date(value).getTime() > Date.now(), {
      error: 'กรุณาเลือกวันและเวลาในอนาคต',
    }),
});

type FormValues = z.infer<typeof QuizCreateSchema>;

type Props = {
  teacherAssignmentId: string;
  returnTab?: string;
};

export function QuizCreateView({ teacherAssignmentId, returnTab }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const isTeacher = user?.role === 'teacher';
  const [questions, setQuestions] = useState<QuizQuestionDraft[]>([createQuizQuestion()]);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [showScoreAfterSubmit, setShowScoreAfterSubmit] = useState(true);
  const [builderError, setBuilderError] = useState('');

  const detailPath = isTeacher
    ? paths.teacher.assignmentDetail(teacherAssignmentId)
    : paths.admin.teacherAssignment.detail(teacherAssignmentId);
  const successPath = returnTab ? `${detailPath}?tab=${returnTab}` : detailPath;

  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ['roster', teacherAssignmentId],
    queryFn: () => getRoster(teacherAssignmentId),
  });

  const methods = useForm<FormValues>({
    resolver: zodResolver(QuizCreateSchema),
    defaultValues: { title: '', description: '', dueAt: null },
  });

  const totalScore = useMemo(
    () => questions.reduce((total, question) => total + Number(question.points || 0), 0),
    [questions]
  );

  const validateQuestions = () => {
    if (!questions.length) {
      setBuilderError('กรุณาเพิ่มคำถามอย่างน้อย 1 ข้อ');
      return false;
    }
    if (
      questions.some(
        (question) =>
          !question.prompt.trim() ||
          !Number.isFinite(question.points) ||
          question.points <= 0 ||
          question.options.length < 2 ||
          question.options.some((option) => !option.trim()) ||
          !question.correctOptionIndexes.length ||
          (question.selectionMode === 'single' && question.correctOptionIndexes.length !== 1) ||
          new Set(question.correctOptionIndexes).size !== question.correctOptionIndexes.length ||
          question.correctOptionIndexes.some(
            (index) => index < 0 || index >= question.options.length
          )
      )
    ) {
      setBuilderError('กรุณากรอกคำถาม ตัวเลือก คำตอบที่ถูก และคะแนนให้ครบทุกข้อ');
      return false;
    }
    const limit = timeLimitMinutes ? Number(timeLimitMinutes) : null;
    if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 300)) {
      setBuilderError('เวลาทำแบบทดสอบต้องอยู่ระหว่าง 1–300 นาที');
      return false;
    }
    setBuilderError('');
    return true;
  };

  const createMutation = useMutation({
    mutationFn: (data: FormValues) =>
      createAssignment(teacherAssignmentId, {
        title: data.title.trim(),
        description: data.description.trim() || undefined,
        fullScore: totalScore,
        dueAt: data.dueAt,
        category: 'quiz',
        quiz: {
          questions: questions.map((question) => ({
            prompt: question.prompt.trim(),
            points: Number(question.points),
            options: question.options.map((option) => option.trim()),
            selectionMode: question.selectionMode,
            correctOptionIndexes: question.correctOptionIndexes,
          })),
          timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
          shuffleQuestions,
          shuffleOptions,
          showScoreAfterSubmit,
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['assignments', teacherAssignmentId] }),
        queryClient.invalidateQueries({ queryKey: ['student-dashboard'] }),
      ]);
      router.push(successPath);
    },
  });

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
          p: { xs: 2.5, sm: 4 },
          color: 'common.white',
          overflow: 'hidden',
          position: 'relative',
          background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 55%, #2563EB 100%)',
          '&::before': {
            top: -120,
            right: -60,
            width: 280,
            height: 280,
            content: '""',
            borderRadius: '50%',
            position: 'absolute',
            bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.1),
          },
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2.5}
          alignItems={{ sm: 'center' }}
          sx={{ zIndex: 1, position: 'relative' }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              display: 'grid',
              flexShrink: 0,
              borderRadius: 2,
              placeItems: 'center',
              bgcolor: 'rgba(255,255,255,0.16)',
            }}
          >
            <RemixIcon icon="solar:bill-list-bold-duotone" width={36} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline" sx={{ opacity: 0.8 }}>
              แบบทดสอบออนไลน์
            </Typography>
            <Typography component="h1" variant="h3">
              สร้างแบบทดสอบ
            </Typography>
            <Typography sx={{ mt: 0.5, opacity: 0.8 }}>
              สร้างคำถาม กำหนดคำตอบที่ถูก คะแนน และเวลาทำ ระบบตรวจคะแนนให้อัตโนมัติ
            </Typography>
          </Box>
          <Box
            sx={{
              px: 2,
              py: 1.25,
              minWidth: 130,
              borderRadius: 2,
              textAlign: 'center',
              bgcolor: 'rgba(255,255,255,0.14)',
            }}
          >
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              คะแนนเต็มรวม
            </Typography>
            <Typography variant="h4">{totalScore}</Typography>
          </Box>
        </Stack>
      </Card>

      {(createMutation.error || builderError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {createMutation.error?.message ?? builderError}
        </Alert>
      )}

      <Form
        methods={methods}
        onSubmit={methods.handleSubmit((data) => {
          if (validateQuestions()) createMutation.mutate(data);
        })}
      >
        <Box
          sx={{
            gap: 3,
            display: 'grid',
            alignItems: 'start',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 310px' },
          }}
        >
          <Stack spacing={3}>
            <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
              <Stack spacing={3.5}>
                <Box>
                  <Typography component="h2" variant="h5">
                    1. ข้อมูลแบบทดสอบ
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                    ตั้งชื่อ คำชี้แจง และเวลาปิดรับคำตอบ
                  </Typography>
                </Box>
                <Box
                  sx={{
                    gap: 2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' },
                  }}
                >
                  <Field.Text
                    name="title"
                    label="ชื่อแบบทดสอบ *"
                    placeholder="เช่น แบบทดสอบบทที่ 1"
                    autoFocus
                  />
                  <Field.DateTimePicker
                    name="dueAt"
                    label="วันและเวลาปิดรับคำตอบ"
                    disablePast
                    ampm={false}
                    slotProps={{
                      textField: { helperText: 'ไม่บังคับ สามารถเว้นว่างได้' },
                    }}
                  />
                </Box>
                <Field.Text
                  name="description"
                  label="คำชี้แจง"
                  placeholder="อธิบายเนื้อหา เงื่อนไข หรือสิ่งที่นักเรียนควรเตรียม"
                  multiline
                  minRows={2}
                />
                <Divider />
                <Box>
                  <Typography component="h2" variant="h5">
                    2. สร้างคำถามและตัวเลือก
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                    เพิ่มคำถาม เลือกคำตอบที่ถูก และกำหนดคะแนนของแต่ละข้อ
                  </Typography>
                </Box>
                <QuizBuilder
                  questions={questions}
                  timeLimitMinutes={timeLimitMinutes}
                  shuffleQuestions={shuffleQuestions}
                  shuffleOptions={shuffleOptions}
                  showScoreAfterSubmit={showScoreAfterSubmit}
                  disabled={createMutation.isPending}
                  onQuestionsChange={(value) => {
                    setQuestions(value);
                    setBuilderError('');
                  }}
                  onTimeLimitChange={(value) => {
                    setTimeLimitMinutes(value);
                    setBuilderError('');
                  }}
                  onShuffleQuestionsChange={setShuffleQuestions}
                  onShuffleOptionsChange={setShuffleOptions}
                  onShowScoreAfterSubmitChange={setShowScoreAfterSubmit}
                />
              </Stack>
            </Card>

            <Card variant="outlined" sx={{ p: 2.5 }}>
              <Stack
                direction={{ xs: 'column-reverse', sm: 'row' }}
                spacing={1.5}
                justifyContent="flex-end"
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
                  size="large"
                  variant="contained"
                  loading={createMutation.isPending}
                  startIcon={<RemixIcon icon="solar:check-circle-bold" />}
                  sx={{ minWidth: 210 }}
                >
                  สร้างและเปิดให้นักเรียนทำ
                </Button>
              </Stack>
            </Card>
          </Stack>

          <Stack spacing={2.5} sx={{ position: { lg: 'sticky' }, top: { lg: 90 } }}>
            <Card variant="outlined" sx={{ p: 3 }}>
              <Typography component="h2" variant="h6">
                สรุปแบบทดสอบ
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={1.75}>
                <SummaryRow
                  icon="solar:list-bold"
                  label="จำนวนคำถาม"
                  value={`${questions.length} ข้อ`}
                />
                <SummaryRow
                  icon="solar:cup-star-bold"
                  label="คะแนนเต็ม"
                  value={`${totalScore} คะแนน`}
                />
                <SummaryRow
                  icon="solar:clock-circle-bold"
                  label="เวลาทำ"
                  value={timeLimitMinutes ? `${timeLimitMinutes} นาที` : 'ไม่จำกัด'}
                />
                <SummaryRow
                  icon="solar:users-group-rounded-bold"
                  label="ห้องเรียน"
                  value={roster?.classroomName ?? '-'}
                />
              </Stack>
            </Card>

            <Card variant="outlined" sx={{ p: 3 }}>
              <Typography component="h2" variant="h6">
                รายวิชา
              </Typography>
              <Divider sx={{ my: 2 }} />
              {rosterLoading ? (
                <Stack spacing={1.25}>
                  <Skeleton height={26} />
                  <Skeleton height={26} />
                  <Skeleton height={26} />
                </Stack>
              ) : (
                <Stack spacing={1}>
                  <Typography variant="subtitle2">
                    {roster?.subjectCode && `${roster.subjectCode} · `}
                    {roster?.subjectName ?? '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ครูผู้สอน: {teacherName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {roster?.semesterName ?? '-'} · {roster?.academicYear ?? '-'}
                  </Typography>
                </Stack>
              )}
            </Card>

            <Alert severity="info" icon={<RemixIcon icon="solar:shield-check-bold" />}>
              คำตอบที่ถูกจะไม่ถูกส่งไปยังนักเรียนก่อนทำแบบทดสอบ
            </Alert>
          </Stack>
        </Box>
      </Form>
    </Container>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon:
    | 'solar:list-bold'
    | 'solar:cup-star-bold'
    | 'solar:clock-circle-bold'
    | 'solar:users-group-rounded-bold';
  label: string;
  value: string;
}) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box
        sx={{
          width: 36,
          height: 36,
          display: 'grid',
          flexShrink: 0,
          borderRadius: 1,
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: 'primary.lighter',
        }}
      >
        <RemixIcon icon={icon} width={19} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="subtitle2" noWrap>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}
