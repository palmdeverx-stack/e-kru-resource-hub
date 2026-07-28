'use client';

import type { RemixIconName } from 'src/components/remix-icon/icon-map';

import { useRef, useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Radio from '@mui/material/Radio';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';

import {
  getStudentQuiz,
  type QuizResult,
  startStudentQuiz,
  submitStudentQuiz,
} from '../student-quiz-actions';

// ----------------------------------------------------------------------

type Props = { assignmentId: string };

export function StudentQuizView({ assignmentId }: Props) {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const autoSubmitted = useRef(false);

  const quizQuery = useQuery({
    queryKey: ['student-quiz', assignmentId],
    queryFn: () => getStudentQuiz(assignmentId),
  });
  const quiz = quizQuery.data;

  const startMutation = useMutation({
    mutationFn: () => startStudentQuiz(assignmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['student-quiz', assignmentId] }),
  });
  const submitMutation = useMutation({
    mutationFn: () => submitStudentQuiz(assignmentId, quiz!.attempt!.id, answers),
    onSuccess: async (submittedResult) => {
      setResult(submittedResult);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['student-quiz', assignmentId] }),
        queryClient.invalidateQueries({ queryKey: ['student-dashboard'] }),
      ]);
    },
  });

  const remainingSeconds = useMemo(() => {
    if (!quiz?.attempt || !quiz.settings.time_limit_minutes) return null;
    const end =
      new Date(quiz.attempt.started_at).getTime() + quiz.settings.time_limit_minutes * 60_000;
    return Math.max(0, Math.ceil((end - now) / 1000));
  }, [now, quiz]);
  const hasActiveTimer = quiz?.attempt?.status === 'in_progress' && remainingSeconds !== null;

  useEffect(() => {
    if (!hasActiveTimer) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasActiveTimer]);

  useEffect(() => {
    if (
      remainingSeconds === 0 &&
      quiz?.attempt?.status === 'in_progress' &&
      !submitMutation.isPending &&
      !autoSubmitted.current
    ) {
      autoSubmitted.current = true;
      submitMutation.mutate();
    }
  }, [quiz?.attempt?.status, remainingSeconds, submitMutation]);

  if (quizQuery.isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <LinearProgress sx={{ mb: 3 }} />
        <Typography color="text.secondary">กำลังโหลดแบบทดสอบ...</Typography>
      </Container>
    );
  }

  if (quizQuery.isError || !quiz) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={() => quizQuery.refetch()}>
              ลองใหม่
            </Button>
          }
        >
          {quizQuery.error?.message ?? 'ไม่พบแบบทดสอบ'}
        </Alert>
      </Container>
    );
  }

  const answeredCount = Object.values(answers).filter((optionIds) => optionIds.length > 0).length;
  const submitted = quiz.attempt?.status === 'submitted' || !!result;
  const displayedScore = result?.score ?? quiz.attempt?.score;
  const displayedMaxScore = result?.maxScore ?? quiz.attempt?.max_score;
  const showScore = result?.showScore ?? quiz.settings.show_score_after_submit;

  return (
    <Container maxWidth="lg" sx={{ pb: 6 }}>
      <Button
        component={RouterLink}
        href={paths.student.assignments}
        color="inherit"
        startIcon={<RemixIcon icon="solar:reply-bold" />}
        sx={{ mb: 2 }}
      >
        กลับไปรายการงาน
      </Button>

      <Card
        sx={{
          p: { xs: 2.5, sm: 4 },
          mb: 3,
          color: 'common.white',
          background: 'linear-gradient(135deg, #155EEF 0%, #0040C1 100%)',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'center' }}>
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
            <RemixIcon icon="solar:bill-list-bold-duotone" width={34} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline" sx={{ opacity: 0.8 }}>
              {quiz.subject.code && `${quiz.subject.code} · `}
              {quiz.subject.name} · {quiz.classroom.name}
            </Typography>
            <Typography component="h1" variant="h3">
              {quiz.title}
            </Typography>
            {quiz.description && (
              <Typography sx={{ mt: 0.75, opacity: 0.82 }}>{quiz.description}</Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Label color="info" sx={{ bgcolor: 'common.white', color: 'primary.dark' }}>
              {quiz.full_score} คะแนน
            </Label>
            <Label color="info" sx={{ bgcolor: 'common.white', color: 'primary.dark' }}>
              {quiz.settings.time_limit_minutes
                ? `${quiz.settings.time_limit_minutes} นาที`
                : 'ไม่จำกัดเวลา'}
            </Label>
          </Stack>
        </Stack>
      </Card>

      {submitted ? (
        <Card variant="outlined" sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              mx: 'auto',
              mb: 2,
              display: 'grid',
              borderRadius: '50%',
              placeItems: 'center',
              color: 'success.main',
              bgcolor: 'success.lighter',
            }}
          >
            <RemixIcon icon="solar:check-circle-bold" width={42} />
          </Box>
          <Typography variant="h4">ส่งแบบทดสอบเรียบร้อยแล้ว</Typography>
          {showScore && displayedScore !== null && displayedScore !== undefined ? (
            <>
              <Typography variant="h2" sx={{ mt: 2, color: 'primary.main' }}>
                {displayedScore}
                <Typography component="span" variant="h5" color="text.secondary">
                  {' '}
                  / {displayedMaxScore}
                </Typography>
              </Typography>
              <Typography color="text.secondary">คะแนนถูกบันทึกในรายวิชาแล้ว</Typography>
            </>
          ) : (
            <Alert severity="success" sx={{ mt: 3, textAlign: 'left' }}>
              ครูผู้สอนตั้งค่าไม่แสดงคะแนนทันที สามารถตรวจสอบคะแนนได้เมื่อครูประกาศผล
            </Alert>
          )}
          <Button
            component={RouterLink}
            href={paths.student.assignments}
            variant="contained"
            sx={{ mt: 3 }}
          >
            กลับไปรายการงาน
          </Button>
        </Card>
      ) : !quiz.attempt ? (
        <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Typography variant="h5">ก่อนเริ่มทำแบบทดสอบ</Typography>
          <Stack spacing={1.5} sx={{ my: 3 }}>
            <InfoRow
              icon="solar:list-bold"
              text={`${quiz.questions.length} ข้อ รวม ${quiz.full_score} คะแนน`}
            />
            <InfoRow
              icon="solar:clock-circle-bold"
              text={
                quiz.settings.time_limit_minutes
                  ? `มีเวลาทำ ${quiz.settings.time_limit_minutes} นาทีหลังจากกดเริ่ม`
                  : 'แบบทดสอบนี้ไม่จำกัดเวลา'
              }
            />
            <InfoRow
              icon="solar:lock-password-outline"
              text="ทำได้ 1 ครั้ง กรุณาตรวจคำตอบก่อนกดส่ง"
            />
            {quiz.due_at && (
              <InfoRow
                icon="solar:calendar-date-bold"
                text={`ส่งได้ถึง ${new Intl.DateTimeFormat('th-TH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(quiz.due_at))}`}
              />
            )}
          </Stack>
          {(startMutation.error || submitMutation.error) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {startMutation.error?.message ?? submitMutation.error?.message}
            </Alert>
          )}
          <Button
            fullWidth
            size="large"
            variant="contained"
            loading={startMutation.isPending}
            startIcon={<RemixIcon icon="solar:play-circle-bold" />}
            onClick={() => startMutation.mutate()}
          >
            เริ่มทำแบบทดสอบ
          </Button>
        </Card>
      ) : (
        <Stack spacing={2.5}>
          <Card
            variant="outlined"
            sx={{
              p: 2,
              top: 80,
              zIndex: 5,
              position: 'sticky',
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2">
                  ตอบแล้ว {answeredCount} จาก {quiz.questions.length} ข้อ
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(answeredCount / quiz.questions.length) * 100}
                  sx={{ mt: 1, height: 7, borderRadius: 1 }}
                />
              </Box>
              {remainingSeconds !== null && (
                <Label
                  color={remainingSeconds <= 60 ? 'error' : 'warning'}
                  startIcon={<RemixIcon icon="solar:clock-circle-bold" />}
                  sx={{ fontSize: 15, px: 1.5, py: 2 }}
                >
                  {formatTimer(remainingSeconds)}
                </Label>
              )}
            </Stack>
          </Card>

          {quiz.questions.map((question, questionIndex) => (
            <Card key={question.id} variant="outlined" sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
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
                    typography: 'subtitle2',
                  }}
                >
                  {questionIndex + 1}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Typography variant="h6">{question.prompt}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {question.points} คะแนน
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {question.selection_mode === 'multiple'
                      ? 'เลือกได้หลายคำตอบ'
                      : 'เลือกคำตอบเดียว'}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Stack spacing={1}>
                    {question.options.map((option, optionIndex) => {
                      const selectedOptionIds = answers[question.id] ?? [];
                      const checked = selectedOptionIds.includes(option.id);
                      return (
                        <Box
                          component="label"
                          key={option.id}
                          sx={{
                            px: 1.5,
                            py: 0.75,
                            display: 'flex',
                            cursor: 'pointer',
                            borderRadius: 1.5,
                            alignItems: 'center',
                            border: '1px solid',
                            borderColor: checked ? 'primary.main' : 'divider',
                            bgcolor: checked ? 'primary.lighter' : 'transparent',
                          }}
                        >
                          <FormControlLabel
                            value={option.id}
                            control={
                              question.selection_mode === 'multiple' ? (
                                <Checkbox checked={checked} />
                              ) : (
                                <Radio checked={checked} />
                              )
                            }
                            label={`${String.fromCharCode(65 + optionIndex)}. ${option.label}`}
                            onChange={() => {
                              setAnswers((current) => {
                                if (question.selection_mode === 'single') {
                                  return { ...current, [question.id]: [option.id] };
                                }
                                const currentIds = current[question.id] ?? [];
                                return {
                                  ...current,
                                  [question.id]: checked
                                    ? currentIds.filter((id) => id !== option.id)
                                    : [...currentIds, option.id],
                                };
                              });
                            }}
                            sx={{ m: 0, width: 1 }}
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              </Stack>
            </Card>
          ))}

          {submitMutation.error && <Alert severity="error">{submitMutation.error.message}</Alert>}
          <Card variant="outlined" sx={{ p: 2.5 }}>
            <Button
              fullWidth
              size="large"
              variant="contained"
              color="success"
              loading={submitMutation.isPending}
              disabled={answeredCount !== quiz.questions.length || remainingSeconds === 0}
              startIcon={<RemixIcon icon="custom:send-fill" />}
              onClick={() => submitMutation.mutate()}
            >
              ยืนยันและส่งคำตอบ
            </Button>
            {answeredCount !== quiz.questions.length && (
              <Typography
                variant="caption"
                sx={{ mt: 1, display: 'block', textAlign: 'center', color: 'text.secondary' }}
              >
                กรุณาตอบให้ครบอีก {quiz.questions.length - answeredCount} ข้อ
              </Typography>
            )}
          </Card>
        </Stack>
      )}
    </Container>
  );
}

function InfoRow({ icon, text }: { icon: RemixIconName; text: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <RemixIcon icon={icon} width={22} sx={{ color: 'primary.main' }} />
      <Typography>{text}</Typography>
    </Stack>
  );
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}
