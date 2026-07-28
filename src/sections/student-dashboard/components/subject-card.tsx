'use client';

import type { StudentSubject } from '../student-dashboard-actions';

import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';

import { displayName, isSubmitted } from '../view/student-dashboard-shared';

// ----------------------------------------------------------------------

type Props = { item: StudentSubject };

export function SubjectCard({ item }: Props) {
  const teacherName = displayName(item.teacher);
  const workAssignments = item.assignments.filter(
    (assignment) => assignment.category === 'assignment'
  );
  const submitted = workAssignments.filter((assignment) => isSubmitted(assignment.status)).length;

  return (
    <Card
      component={RouterLink}
      href={paths.student.subjectDetails(item.id)}
      aria-label={`ดูรายละเอียดวิชา ${item.subject.name}`}
      variant="outlined"
      sx={{
        height: 1,
        color: 'inherit',
        overflow: 'hidden',
        position: 'relative',
        textDecoration: 'none',
        borderRadius: { xs: 2.5, sm: 3 },
        transition: (theme) =>
          theme.transitions.create(['transform', 'box-shadow', 'border-color']),
        '&:hover': {
          transform: 'translateY(-4px)',
          borderColor: 'primary.main',
          boxShadow: (theme) => theme.vars.customShadows.z8,
        },
        '&:focus-visible': {
          outline: '3px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          height: { xs: 104, sm: 120 },
          position: 'relative',
          bgcolor: 'primary.lighter',
          background: item.subject.image_url
            ? (theme) =>
                `linear-gradient(0deg, ${varAlpha(theme.vars.palette.primary.darkerChannel, 0.36)}, ${varAlpha(theme.vars.palette.primary.darkerChannel, 0.04)}), url(${item.subject.image_url}) center/cover`
            : (theme) =>
                `linear-gradient(135deg, ${theme.vars.palette.primary.lighter} 0%, ${theme.vars.palette.primary.light} 100%)`,
        }}
      >
        {!item.subject.image_url && (
          <RemixIcon
            icon="solar:notebook-bold-duotone"
            width={56}
            sx={{
              right: 20,
              bottom: 16,
              position: 'absolute',
              color: 'primary.main',
              opacity: 0.7,
            }}
          />
        )}
        <Chip
          size="small"
          label={item.subject.code || 'รายวิชา'}
          sx={{ top: 14, left: 14, position: 'absolute', bgcolor: 'background.paper' }}
        />
      </Box>

      <Avatar
        key={item.teacher.avatar_url ?? item.teacher.id}
        src={item.teacher.avatar_url ?? undefined}
        alt={teacherName}
        sx={{
          width: { xs: 64, sm: 76 },
          height: { xs: 64, sm: 76 },
          color: 'primary.darker',
          bgcolor: 'primary.lighter',
          border: '2px solid',
          borderColor: 'background.paper',
          position: 'absolute',
          right: { xs: 14, sm: 20 },
          top: { xs: 72, sm: 84 },
          boxShadow: (theme) => theme.vars.customShadows.z4,
        }}
      >
        {teacherName.charAt(0)}
      </Avatar>

      <Box sx={{ p: { xs: 2, sm: 2.25 } }}>
        <Typography
          variant="h6"
          sx={{
            mb: 0.5,
            minHeight: { sm: 56 },
            pr: { xs: 8.5, sm: 9.5 },
            fontSize: { xs: '1rem', sm: '1.125rem' },
            lineHeight: 1.4,
            overflowWrap: 'anywhere',
          }}
        >
          {item.subject.name}
        </Typography>

        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 1.25, mb: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
              ครูผู้สอน
            </Typography>
            <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
              {teacherName}
            </Typography>
          </Box>
        </Stack>

        <Typography
          variant="caption"
          sx={{ display: 'block', color: 'text.secondary', overflowWrap: 'anywhere' }}
        >
          {item.semester.name} · ห้อง {item.classroom.name} · {item.subject.credits ?? 0} หน่วยกิต
        </Typography>

        <Divider sx={{ my: 1.75 }} />
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            การส่งงาน
          </Typography>
          <Typography variant="subtitle2">
            {submitted}/{workAssignments.length} งาน
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={workAssignments.length ? (submitted / workAssignments.length) * 100 : 0}
          sx={{ mt: 1, height: 6, borderRadius: 4 }}
        />
      </Box>
    </Card>
  );
}
