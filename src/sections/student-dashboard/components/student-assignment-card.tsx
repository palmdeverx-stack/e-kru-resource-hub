'use client';

import type { SubmissionStatus, StudentAssignmentItem } from '../student-dashboard-actions';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';

import { isSubmitted } from '../view/student-dashboard-shared';

// ----------------------------------------------------------------------

const STATUS_CONFIG = {
  submitted: { label: 'ส่งแล้ว', color: 'success' as const },
  late: { label: 'ส่งล่าช้า', color: 'warning' as const },
  not_submitted: { label: 'ยังไม่ส่ง', color: 'error' as const },
  absent: { label: 'ขาดเรียน', color: 'error' as const },
  sick_leave: { label: 'ลาป่วย', color: 'info' as const },
  pending_review: { label: 'รอตรวจ', color: 'warning' as const },
} satisfies Record<
  SubmissionStatus,
  { label: string; color: 'success' | 'warning' | 'error' | 'info' }
>;

type Props = { assignment: StudentAssignmentItem; generatedAt: string };

export function StudentAssignmentCard({ assignment, generatedAt }: Props) {
  const status = STATUS_CONFIG[assignment.status];
  const isQuiz = assignment.category === 'quiz';
  const overdue =
    !!assignment.due_at &&
    new Date(assignment.due_at).getTime() < new Date(generatedAt).getTime() &&
    !isSubmitted(assignment.status);

  return (
    <Card
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.5 },
        gap: 2,
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        flexDirection: { xs: 'column', sm: 'row' },
        borderRadius: 2,
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          display: 'grid',
          flexShrink: 0,
          borderRadius: 1.5,
          placeItems: 'center',
          color: isQuiz ? 'secondary.dark' : 'primary.main',
          bgcolor: isQuiz ? 'secondary.lighter' : 'primary.lighter',
        }}
      >
        <RemixIcon
          icon={isQuiz ? 'solar:bill-list-bold-duotone' : 'solar:notes-bold-duotone'}
          width={26}
        />
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <Typography variant="subtitle1">{assignment.title}</Typography>
          <Label variant="soft" color={isQuiz ? 'secondary' : 'primary'}>
            {isQuiz ? 'แบบทดสอบ' : 'งาน'}
          </Label>
          <Label variant="soft" color={status.color}>
            {status.label}
          </Label>
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {assignment.subject.code && `${assignment.subject.code} · `}
          {assignment.subject.name}
        </Typography>
        {assignment.due_at && (
          <Typography
            variant="caption"
            sx={{
              gap: 0.5,
              mt: 0.75,
              display: 'flex',
              alignItems: 'center',
              color: overdue ? 'error.main' : 'text.secondary',
              fontWeight: overdue ? 700 : 500,
            }}
          >
            <RemixIcon icon="solar:clock-circle-bold" width={16} />
            {overdue ? 'เลยกำหนดส่ง' : 'กำหนดส่ง'} {formatDeadline(assignment.due_at)}
          </Typography>
        )}
        {assignment.description && (
          <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-line' }}>
            {assignment.description}
          </Typography>
        )}
        {!!assignment.attachments.length && (
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
            {assignment.attachments.map((file) => (
              <Link
                key={file.id}
                href={file.file_url}
                target="_blank"
                rel="noopener noreferrer"
                underline="none"
                sx={{
                  gap: 0.5,
                  px: 1,
                  py: 0.5,
                  display: 'inline-flex',
                  borderRadius: 1,
                  alignItems: 'center',
                  typography: 'caption',
                  color: 'primary.main',
                  bgcolor: 'primary.lighter',
                }}
              >
                <RemixIcon
                  icon={
                    file.mime_type.startsWith('image/')
                      ? 'solar:gallery-wide-bold'
                      : 'solar:file-text-bold'
                  }
                  width={16}
                />
                {file.file_name}
              </Link>
            ))}
          </Stack>
        )}
        {assignment.feedback && (
          <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
            ความคิดเห็นจากครู: {assignment.feedback}
          </Typography>
        )}
      </Box>

      <Box sx={{ minWidth: 112, textAlign: { sm: 'right' } }}>
        <Typography variant="h6">
          {assignment.score === null ? '–' : assignment.score}
          <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
            {' '}
            / {assignment.full_score}
          </Typography>
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          คะแนน
        </Typography>
        {assignment.is_interactive_quiz && (
          <Button
            component={RouterLink}
            href={paths.student.quiz(assignment.id)}
            size="small"
            variant={isSubmitted(assignment.status) ? 'outlined' : 'contained'}
            startIcon={
              <RemixIcon
                icon={
                  isSubmitted(assignment.status) ? 'solar:eye-bold' : 'solar:play-circle-bold'
                }
              />
            }
            sx={{ mt: 1, whiteSpace: 'nowrap' }}
          >
            {isSubmitted(assignment.status) ? 'ดูผล' : 'ทำแบบทดสอบ'}
          </Button>
        )}
      </Box>
    </Card>
  );
}

function formatDeadline(value: string) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  );
}
