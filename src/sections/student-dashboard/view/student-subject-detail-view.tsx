'use client';

import { useMemo } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';

import { StudentAssignmentList } from '../components/student-assignment-list';
import {
  displayName,
  isSubmitted,
  SectionHeading,
  StudentPageState,
  useStudentSubjectsDashboard,
} from './student-dashboard-shared';

// ----------------------------------------------------------------------

type Props = {
  teacherAssignmentId: string;
};

export function StudentSubjectDetailView({ teacherAssignmentId }: Props) {
  const { data, isLoading, isError, refetch } = useStudentSubjectsDashboard();
  const item = data?.subjects.find((subject) => subject.id === teacherAssignmentId);

  const learningItems = useMemo(
    () =>
      item?.assignments
        .filter(
          (assignment) =>
            assignment.category === 'assignment' ||
            (assignment.category === 'quiz' && assignment.is_interactive_quiz)
        )
        .map((assignment) => ({ ...assignment, subject: item.subject })) ?? [],
    [item]
  );

  if (isLoading || isError || !data) {
    return <StudentPageState isLoading={isLoading} isError={isError || !data} onRetry={refetch} />;
  }

  if (!item) {
    return (
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Button
          component={RouterLink}
          href={paths.student.subjects}
          color="inherit"
          startIcon={<RemixIcon icon="solar:reply-bold" />}
          sx={{ mb: 2 }}
        >
          กลับหน้าวิชาเรียน
        </Button>
        <Alert severity="warning">ไม่พบรายวิชานี้ หรือคุณไม่มีสิทธิ์เข้าถึง</Alert>
      </Container>
    );
  }

  const teacherName = displayName(item.teacher);
  const quizzes = learningItems.filter((assignment) => assignment.category === 'quiz').length;
  const submitted = learningItems.filter((assignment) => isSubmitted(assignment.status)).length;

  return (
    <Container component="main" maxWidth="lg" sx={{ pb: 5 }}>
      <Button
        component={RouterLink}
        href={paths.student.subjects}
        color="inherit"
        startIcon={<RemixIcon icon="solar:reply-bold" />}
        sx={{ mb: 2 }}
      >
        กลับหน้าวิชาเรียน
      </Button>

      <Card
        sx={{
          mb: { xs: 3, md: 4 },
          minHeight: { xs: 250, md: 300 },
          color: 'common.white',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          borderRadius: { xs: 2.5, md: 4 },
          background: item.subject.image_url
            ? (theme) =>
                `linear-gradient(90deg, ${varAlpha(theme.vars.palette.primary.darkerChannel, 0.94)} 0%, ${varAlpha(theme.vars.palette.primary.darkerChannel, 0.58)} 70%, ${varAlpha(theme.vars.palette.primary.darkerChannel, 0.28)} 100%), url(${item.subject.image_url}) center/cover`
            : (theme) =>
                `linear-gradient(135deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.main} 72%, ${theme.vars.palette.primary.light} 100%)`,
        }}
      >
        <Box sx={{ zIndex: 1, width: 1, p: { xs: 3, sm: 4, md: 5 }, position: 'relative' }}>
          <Label color="info" sx={{ mb: 1.5, bgcolor: 'common.white', color: 'primary.dark' }}>
            {item.subject.code || 'รายวิชา'}
          </Label>
          <Typography component="h1" variant="h2" sx={{ maxWidth: 760 }}>
            {item.subject.name}
          </Typography>
          {item.subject.description && (
            <Typography sx={{ mt: 1, maxWidth: 720, opacity: 0.82 }}>
              {item.subject.description}
            </Typography>
          )}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1.5, sm: 3 }}
            sx={{ mt: 3 }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Avatar
                src={item.teacher.avatar_url ?? undefined}
                alt={teacherName}
                sx={{ bgcolor: 'primary.lighter', color: 'primary.darker' }}
              >
                {teacherName.charAt(0)}
              </Avatar>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  ครูผู้สอน
                </Typography>
                <Typography variant="subtitle2">{teacherName}</Typography>
              </Box>
            </Stack>
            <SubjectInfo
              icon="solar:calendar-date-bold"
              text={`${item.semester.name} · ห้อง ${item.classroom.name}`}
            />
            <SubjectInfo
              icon="solar:notebook-bold-duotone"
              text={`${item.subject.credits ?? 0} หน่วยกิต`}
            />
          </Stack>
        </Box>
      </Card>

      <Box
        sx={{
          gap: 1.5,
          mb: 4,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        <SubjectStat label="งานและแบบทดสอบ" value={learningItems.length} />
        <SubjectStat label="แบบทดสอบ" value={quizzes} />
        <SubjectStat label="ส่งแล้ว" value={submitted} />
      </Box>

      <SectionHeading
        icon="solar:list-bold"
        title="งานและแบบทดสอบในวิชานี้"
        subtitle="ดูรายละเอียดงานและกดเข้าทำแบบทดสอบได้จากรายการด้านล่าง"
      />
      <StudentAssignmentList assignments={learningItems} generatedAt={data.generated_at} />
    </Container>
  );
}

function SubjectInfo({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof RemixIcon>['icon'];
  text: string;
}) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <RemixIcon icon={icon} width={20} />
      <Typography variant="body2">{text}</Typography>
    </Stack>
  );
}

function SubjectStat({ label, value }: { label: string; value: number }) {
  return (
    <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, textAlign: 'center' }}>
      <Typography variant="h4" color="primary.main">
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Card>
  );
}
