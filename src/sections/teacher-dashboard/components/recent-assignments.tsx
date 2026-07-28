'use client';

import type { TeacherDashboardRecentAssignments } from '../teacher-dashboard-actions';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import {
  RiTaskLine,
  RiMore2Line,
  RiMedalLine,
  RiDraftLine,
  RiTrophyLine,
  RiBookletLine,
  RiQuestionnaireLine,
} from 'src/components/remix-icon';

// ----------------------------------------------------------------------

type Props = {
  assignments: TeacherDashboardRecentAssignments['recent_assignments'] | undefined;
  isLoading: boolean;
};

const categoryConfig = {
  assignment: {
    label: 'งาน',
    icon: RiDraftLine,
    color: 'primary.main',
    bgcolor: 'primary.lighter',
  },
  quiz: {
    label: 'แบบทดสอบ',
    icon: RiQuestionnaireLine,
    color: 'info.main',
    bgcolor: 'info.lighter',
  },
  midterm: {
    label: 'สอบกลางภาค',
    icon: RiBookletLine,
    color: 'warning.dark',
    bgcolor: 'warning.lighter',
  },
  final: {
    label: 'สอบปลายภาค',
    icon: RiTrophyLine,
    color: 'error.main',
    bgcolor: 'error.lighter',
  },
  other: {
    label: 'อื่นๆ',
    icon: RiMedalLine,
    color: 'secondary.main',
    bgcolor: 'secondary.lighter',
  },
} as const;

export function RecentAssignments({ assignments, isLoading }: Props) {
  return (
    <Card variant="outlined" sx={{ p: { xs: 1.25, sm: 3 }, borderRadius: 2.5 }}>
      <Box sx={{ mb: { xs: 1.25, sm: 2.5 }, display: 'flex', alignItems: 'center' }}>
        <Avatar
          variant="rounded"
          sx={{
            mr: { xs: 0.75, sm: 1.5 },
            width: { xs: 34, sm: 40 },
            height: { xs: 34, sm: 40 },
            color: 'primary.main',
            bgcolor: 'primary.lighter',
          }}
        >
          <RiTaskLine size={21} />
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            component="h2"
            variant="h6"
            sx={{ fontSize: { xs: '0.95rem', sm: '1.125rem' } }}
          >
            งานที่มอบหมายล่าสุด
          </Typography>
          <Typography
            variant="body2"
            sx={{
              overflow: 'hidden',
              color: 'text.secondary',
              fontSize: { xs: '0.7rem', sm: '0.875rem' },
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            ติดตามการส่งงานและสถานะการตรวจคะแนน
          </Typography>
        </Box>
        <Button component={RouterLink} href={paths.teacher.assignments} size="small">
          ดูทั้งหมด
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ gap: { xs: 0.75, sm: 1.5 }, display: 'flex', flexDirection: 'column' }}>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} variant="rounded" height={72} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
      ) : assignments?.length ? (
        <Box sx={{ gap: { xs: 0.75, sm: 1.5 }, display: 'flex', flexDirection: 'column' }}>
          {assignments.map((assignment) => {
            const submittedPercent = assignment.student_count
              ? Math.min((assignment.submitted_count / assignment.student_count) * 100, 100)
              : 0;
            const category = categoryConfig[assignment.category];
            const CategoryIcon = category.icon;

            return (
              <Box
                key={assignment.id}
                sx={{
                  gap: { xs: 1, sm: 1.5 },
                  p: { xs: 1, sm: 1.25 },
                  display: 'grid',
                  borderRadius: 2,
                  alignItems: 'center',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  gridTemplateColumns: {
                    xs: '42px minmax(0, 1fr) auto 32px',
                    sm: '46px minmax(0, 1fr) 160px auto auto 36px',
                  },
                }}
              >
                <Avatar
                  variant="rounded"
                  sx={{
                    width: { xs: 42, sm: 46 },
                    height: { xs: 42, sm: 46 },
                    color: category.color,
                    bgcolor: category.bgcolor,
                  }}
                >
                  <CategoryIcon size={23} />
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>
                    {assignment.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', color: 'text.secondary' }}
                    noWrap
                  >
                    {category.label} · {assignment.subject?.name ?? 'ไม่ระบุรายวิชา'} · ห้อง{' '}
                    {assignment.classroom?.name ?? '-'}
                  </Typography>
                </Box>
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      ส่งแล้ว
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {assignment.submitted_count}/{assignment.student_count}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={submittedPercent}
                    color={submittedPercent >= 100 ? 'success' : 'primary'}
                    sx={{ height: { xs: 5, sm: 7 }, borderRadius: 7 }}
                  />
                </Box>
                <Box
                  sx={{
                    gap: 0.5,
                    minWidth: '50px',
                    display: 'flex',
                    color: 'warning.dark',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <RiTrophyLine size={18} />
                  <Typography variant="subtitle2">{assignment.full_score}</Typography>
                </Box>
                <Button
                  component={RouterLink}
                  href={paths.teacher.gradebook(assignment.id)}
                  size="small"
                  variant="contained"
                  color="warning"
                  sx={{
                    display: { xs: 'none', sm: 'inline-flex' },
                    color: 'warning.darker',
                    justifySelf: { xs: 'end', sm: 'auto' },
                    whiteSpace: 'nowrap',
                  }}
                >
                  ตรวจงาน
                </Button>
                <IconButton
                  component={RouterLink}
                  href={paths.teacher.gradebook(assignment.id)}
                  size="small"
                  aria-label={`เปิดงาน ${assignment.title}`}
                  sx={{ justifySelf: 'end' }}
                >
                  <RiMore2Line size={20} />
                </IconButton>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box sx={{ py: { xs: 3.5, sm: 5 }, textAlign: 'center' }}>
          <Box sx={{ mb: 1, color: 'text.disabled' }}>
            <RiTaskLine size={42} />
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            ยังไม่มีงานที่มอบหมายในรายวิชาของคุณ
          </Typography>
        </Box>
      )}
    </Card>
  );
}
