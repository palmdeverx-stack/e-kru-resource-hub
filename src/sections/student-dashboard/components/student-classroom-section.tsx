'use client';

import type {
  StudentPerson,
  StudentClassroom,
  StudentClassMember,
} from '../student-dashboard-actions';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';

import { RemixIcon } from 'src/components/remix-icon';

import { EmptyCard, displayName, SectionHeading } from '../view/student-dashboard-shared';

// ----------------------------------------------------------------------

type Props = {
  classroom?: StudentClassroom;
  members: StudentClassMember[];
  teachers: StudentPerson[];
};

export function StudentClassroomSection({ classroom, members, teachers }: Props) {
  if (!classroom) return null;

  return (
    <Box component="section" aria-label="ข้อมูลห้องเรียนของฉัน">
      <SectionHeading
        icon="solar:users-group-rounded-bold"
        title="ห้องเรียนของฉัน"
        subtitle={`ห้อง ${classroom.name}${classroom.grade_level ? ` · ระดับชั้น ${classroom.grade_level}` : ''}${classroom.academic_year?.year ? ` · ปีการศึกษา ${classroom.academic_year.year}` : ''}`}
      />

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' },
        }}
      >
        <Card variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
          <Box sx={{ gap: 1, display: 'flex', alignItems: 'center', mb: 2 }}>
            <RemixIcon icon="solar:user-id-bold" sx={{ color: 'primary.main' }} />
            <Typography variant="h6">ครูที่ปรึกษา</Typography>
          </Box>
          {teachers.length ? (
            <Stack spacing={1.5}>
              {teachers.map((teacher) => {
                const name = displayName(teacher);
                return (
                  <Box
                    key={teacher.id}
                    sx={{
                      gap: 1.25,
                      p: 1.5,
                      display: 'flex',
                      borderRadius: 2,
                      alignItems: 'center',
                      bgcolor: 'primary.lighter',
                    }}
                  >
                    <Avatar
                      src={teacher.avatar_url ?? undefined}
                      alt={name}
                      sx={{ width: 46, height: 46, bgcolor: 'primary.main' }}
                    >
                      {name.charAt(0)}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
                        {name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        ครูประจำชั้น
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <EmptyCard text="ยังไม่ได้กำหนดครูที่ปรึกษา" compact />
          )}
        </Card>

        <Card variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
          <Box
            sx={{
              gap: 1,
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="h6">เพื่อนร่วมชั้น</Typography>
            <Chip
              size="small"
              color="primary"
              variant="soft"
              label={`สมาชิก ${members.length} คน`}
            />
          </Box>
          {members.length ? (
            <Box
              component="ul"
              sx={{
                p: 0,
                m: 0,
                gap: 1,
                display: 'grid',
                listStyle: 'none',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {members.map((member) => {
                const name = displayName(member.student);
                return (
                  <Box
                    component="li"
                    key={member.student.id}
                    sx={{
                      gap: 1.25,
                      p: 1.25,
                      display: 'flex',
                      borderRadius: 2,
                      alignItems: 'center',
                      bgcolor: member.is_current_student ? 'primary.lighter' : 'background.neutral',
                      border: '1px solid',
                      borderColor: member.is_current_student ? 'primary.light' : 'transparent',
                    }}
                  >
                    <Avatar
                      src={member.student.avatar_url ?? undefined}
                      alt={name}
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: 'background.paper',
                        color: 'primary.main',
                      }}
                    >
                      {name.charAt(0)}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle2" noWrap>
                        {name}
                        {member.is_current_student ? ' (คุณ)' : ''}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        เลขที่ {member.student_number ?? '-'}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <EmptyCard text="ยังไม่มีรายชื่อเพื่อนในห้อง" compact />
          )}
        </Card>
      </Box>
    </Box>
  );
}
