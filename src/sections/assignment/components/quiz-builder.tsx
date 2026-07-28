'use client';

import dayjs from 'dayjs';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { RemixIcon } from 'src/components/remix-icon';

// ----------------------------------------------------------------------

export type QuizQuestionDraft = {
  id: string;
  prompt: string;
  points: number;
  selectionMode: 'single' | 'multiple';
  correctOptionIndexes: number[];
  options: string[];
};

type Props = {
  questions: QuizQuestionDraft[];
  timeLimitMinutes: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showScoreAfterSubmit: boolean;
  disabled?: boolean;
  onQuestionsChange: (questions: QuizQuestionDraft[]) => void;
  onTimeLimitChange: (value: string) => void;
  onShuffleQuestionsChange: (value: boolean) => void;
  onShuffleOptionsChange: (value: boolean) => void;
  onShowScoreAfterSubmitChange: (value: boolean) => void;
};

export function createQuizQuestion(): QuizQuestionDraft {
  return {
    id: crypto.randomUUID(),
    prompt: '',
    points: 1,
    selectionMode: 'single',
    correctOptionIndexes: [0],
    options: ['', '', '', ''],
  };
}

export function QuizBuilder({
  questions,
  timeLimitMinutes,
  shuffleQuestions,
  shuffleOptions,
  showScoreAfterSubmit,
  disabled,
  onQuestionsChange,
  onTimeLimitChange,
  onShuffleQuestionsChange,
  onShuffleOptionsChange,
  onShowScoreAfterSubmitChange,
}: Props) {
  const totalScore = questions.reduce((total, question) => total + Number(question.points || 0), 0);

  const updateQuestion = (index: number, patch: Partial<QuizQuestionDraft>) => {
    onQuestionsChange(
      questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question
      )
    );
  };

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          gap: 2,
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="h6">คำถามและคำตอบ</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            กำหนดแต่ละข้อให้เลือกคำตอบเดียวหรือหลายคำตอบ ระบบจะตรวจและบันทึกคะแนนให้อัตโนมัติ
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: 1.5,
              color: 'primary.dark',
              bgcolor: 'primary.lighter',
              typography: 'subtitle2',
            }}
          >
            {questions.length} ข้อ
          </Box>
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: 1.5,
              color: 'success.dark',
              bgcolor: 'success.lighter',
              typography: 'subtitle2',
            }}
          >
            รวม {totalScore} คะแนน
          </Box>
        </Stack>
      </Box>

      <Stack spacing={2}>
        {questions.map((question, questionIndex) => (
          <Card
            key={question.id}
            variant="outlined"
            sx={{ p: { xs: 2, sm: 2.5 }, boxShadow: 'none' }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    width: 34,
                    height: 34,
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
                <TextField
                  fullWidth
                  required
                  value={question.prompt}
                  label={`คำถามข้อที่ ${questionIndex + 1}`}
                  placeholder="พิมพ์คำถาม"
                  multiline
                  minRows={2}
                  disabled={disabled}
                  onChange={(event) =>
                    updateQuestion(questionIndex, { prompt: event.target.value })
                  }
                />
                <TextField
                  required
                  value={question.points}
                  label="คะแนน"
                  type="number"
                  disabled={disabled}
                  onChange={(event) =>
                    updateQuestion(questionIndex, { points: Number(event.target.value) })
                  }
                  slotProps={{ htmlInput: { min: 0.5, step: 0.5 } }}
                  sx={{ width: 105, flexShrink: 0 }}
                />
                <IconButton
                  color="error"
                  disabled={disabled || questions.length === 1}
                  aria-label={`ลบคำถามข้อที่ ${questionIndex + 1}`}
                  onClick={() =>
                    onQuestionsChange(questions.filter((_, index) => index !== questionIndex))
                  }
                >
                  <RemixIcon icon="solar:trash-bin-trash-bold" />
                </IconButton>
              </Stack>

              <Box sx={{ pl: { sm: 6.25 } }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                  justifyContent="space-between"
                  sx={{ mb: 1 }}
                >
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    ตัวเลือกคำตอบ · ทำเครื่องหมายคำตอบที่ถูก
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={question.selectionMode}
                    disabled={disabled}
                    aria-label="รูปแบบการเลือกคำตอบ"
                    onChange={(_, value: QuizQuestionDraft['selectionMode'] | null) => {
                      if (!value) return;
                      updateQuestion(questionIndex, {
                        selectionMode: value,
                        correctOptionIndexes:
                          value === 'single'
                            ? [question.correctOptionIndexes[0] ?? 0]
                            : question.correctOptionIndexes,
                      });
                    }}
                  >
                    <ToggleButton value="single">เลือกคำตอบเดียว</ToggleButton>
                    <ToggleButton value="multiple">เลือกได้หลายคำตอบ</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
                <Stack spacing={1}>
                  {question.options.map((option, optionIndex) => {
                    const checked = question.correctOptionIndexes.includes(optionIndex);
                    return (
                      <Stack key={`${question.id}-${optionIndex}`} direction="row" spacing={1}>
                        {question.selectionMode === 'multiple' ? (
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            inputProps={{ 'aria-label': `คำตอบที่ถูก ตัวเลือก ${optionIndex + 1}` }}
                            onChange={() =>
                              updateQuestion(questionIndex, {
                                correctOptionIndexes: checked
                                  ? question.correctOptionIndexes.filter(
                                      (index) => index !== optionIndex
                                    )
                                  : [...question.correctOptionIndexes, optionIndex].sort(
                                      (a, b) => a - b
                                    ),
                              })
                            }
                          />
                        ) : (
                          <Radio
                            checked={checked}
                            disabled={disabled}
                            value={optionIndex}
                            name={`correct-${question.id}`}
                            inputProps={{ 'aria-label': `คำตอบที่ถูก ตัวเลือก ${optionIndex + 1}` }}
                            onChange={() =>
                              updateQuestion(questionIndex, {
                                correctOptionIndexes: [optionIndex],
                              })
                            }
                          />
                        )}
                        <TextField
                          fullWidth
                          required
                          size="small"
                          value={option}
                          disabled={disabled}
                          placeholder={`ตัวเลือก ${optionIndex + 1}`}
                          onChange={(event) =>
                            updateQuestion(questionIndex, {
                              options: question.options.map((current, index) =>
                                index === optionIndex ? event.target.value : current
                              ),
                            })
                          }
                        />
                        <Box>
                          <IconButton
                            size="small"
                            disabled={disabled || question.options.length <= 2}
                            aria-label={`ลบตัวเลือก ${optionIndex + 1}`}
                            onClick={() => {
                              const nextOptions = question.options.filter(
                                (_, index) => index !== optionIndex
                              );
                              const nextCorrect = question.correctOptionIndexes
                                .filter((index) => index !== optionIndex)
                                .map((index) => (index > optionIndex ? index - 1 : index));
                              updateQuestion(questionIndex, {
                                options: nextOptions,
                                correctOptionIndexes:
                                  question.selectionMode === 'single' && !nextCorrect.length
                                    ? [0]
                                    : nextCorrect,
                              });
                            }}
                          >
                            <RemixIcon icon="mingcute:close-line" />
                          </IconButton>
                        </Box>
                      </Stack>
                    );
                  })}
                </Stack>
                <Button
                  size="small"
                  color="inherit"
                  disabled={disabled || question.options.length >= 8}
                  startIcon={<RemixIcon icon="mingcute:add-line" />}
                  onClick={() =>
                    updateQuestion(questionIndex, { options: [...question.options, ''] })
                  }
                  sx={{ mt: 1 }}
                >
                  เพิ่มตัวเลือก
                </Button>
              </Box>
            </Stack>
          </Card>
        ))}
      </Stack>

      <Button
        variant="outlined"
        size="large"
        disabled={disabled || questions.length >= 100}
        startIcon={<RemixIcon icon="solar:add-circle-bold" />}
        onClick={() => onQuestionsChange([...questions, createQuizQuestion()])}
        sx={{ alignSelf: 'flex-start' }}
      >
        เพิ่มคำถาม
      </Button>

      <Divider />

      <Box>
        <Typography variant="subtitle1">การทำแบบทดสอบ</Typography>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          นักเรียนแต่ละคนทำได้ 1 ครั้ง และคำตอบจะถูกส่งเมื่อกดยืนยัน
        </Typography>
        <Box
          sx={{
            gap: 2,
            display: 'grid',
            alignItems: 'start',
            gridTemplateColumns: { xs: '1fr', sm: '220px 1fr' },
          }}
        >
          <TimePicker
            ampm={false}
            views={['hours', 'minutes']}
            format="HH:mm"
            label="เวลาทำ (ชั่วโมง:นาที)"
            value={
              timeLimitMinutes
                ? dayjs().startOf('day').add(Number(timeLimitMinutes), 'minute')
                : null
            }
            disabled={disabled}
            minTime={dayjs().startOf('day').minute(1)}
            maxTime={dayjs().startOf('day').hour(5)}
            onChange={(value) => {
              if (!value) {
                onTimeLimitChange('');
                return;
              }
              if (value.isValid()) {
                onTimeLimitChange(String(value.hour() * 60 + value.minute()));
              }
            }}
            slotProps={{
              textField: {
                fullWidth: true,
                helperText: 'สูงสุด 05:00 ชั่วโมง · ล้างค่าเพื่อไม่จำกัดเวลา',
              },
              field: { clearable: true },
            }}
          />
          <Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={shuffleQuestions}
                  disabled={disabled}
                  onChange={(event) => onShuffleQuestionsChange(event.target.checked)}
                />
              }
              label="สุ่มลำดับคำถามตอนแสดงให้นักเรียน"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={shuffleOptions}
                  disabled={disabled}
                  onChange={(event) => onShuffleOptionsChange(event.target.checked)}
                />
              }
              label="สุ่มลำดับตัวเลือกคำตอบตอนแสดงให้นักเรียน"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showScoreAfterSubmit}
                  disabled={disabled}
                  onChange={(event) => onShowScoreAfterSubmitChange(event.target.checked)}
                />
              }
              label="แสดงคะแนนทันทีหลังส่งคำตอบ"
            />
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
