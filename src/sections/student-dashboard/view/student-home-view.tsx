'use client';

import type { StudentHomeDashboard } from '../student-dashboard-actions';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';

import {
  HeroStat,
  EmptyCard,
  HeroStats,
  displayName,
  SectionHeading,
  StudentPageState,
  StudentPageScaffold,
  getCurrentEnrollment,
  useStudentHomeDashboard,
} from './student-dashboard-shared';

// ----------------------------------------------------------------------

export function StudentHomeView() {
  const { data, isLoading, isError, refetch } = useStudentHomeDashboard();

  if (isLoading || isError || !data) {
    return <StudentPageState isLoading={isLoading} isError={isError || !data} onRetry={refetch} />;
  }

  const currentEnrollment = getCurrentEnrollment(data);
  const currentRank = data.ranking.find(
    (row) => row.is_current_student && row.full_score > 0
  )?.rank;

  return (
    <StudentPageScaffold
      data={data}
      section="home"
      stats={
        <HeroStats>
          <HeroStat icon="solar:cup-star-bold" label="อันดับของฉัน" value={currentRank ?? '–'} />
          <HeroStat
            icon="solar:users-group-rounded-bold"
            label="เพื่อนในห้อง"
            value={data.class_members.filter((member) => !member.is_current_student).length}
          />
          <HeroStat
            icon="solar:bell-bing-bold"
            label="ประกาศใหม่"
            value={data.announcements.length}
          />
        </HeroStats>
      }
    >
      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(360px, 1.5fr)' },
        }}
      >
        <RankingSection
          ranking={data.ranking}
          subjectRankings={data.subject_rankings}
          classroomName={currentEnrollment?.classroom.name}
        />
        <AnnouncementsSection announcements={data.announcements} />
      </Box>
    </StudentPageScaffold>
  );
}

// ----------------------------------------------------------------------

function RankingSection({
  ranking,
  subjectRankings,
  classroomName,
}: {
  ranking: StudentHomeDashboard['ranking'];
  subjectRankings: StudentHomeDashboard['subject_rankings'];
  classroomName?: string;
}) {
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjectRankings[0]?.id ?? '');
  const selectedSubject =
    subjectRankings.find((item) => item.id === selectedSubjectId) ?? subjectRankings[0];

  return (
    <Stack spacing={3}>
      <Card
        component="section"
        aria-label="อันดับรวมทุกวิชา"
        variant="outlined"
        sx={{
          p: { xs: 2, md: 2.75 },
          overflow: 'hidden',
          borderRadius: 3,
          borderTop: '4px solid',
          borderTopColor: 'warning.main',
          boxShadow: (theme) => theme.shadows[4],
        }}
      >
        <SectionHeading
          compact
          icon="solar:cup-star-bold"
          title="อันดับรวมทุกวิชา"
          subtitle={classroomName ? `คะแนนรวมของห้อง ${classroomName}` : 'คะแนนรวมของห้องเรียน'}
        />
        <RankingList
          ranking={ranking}
          emptyText="ยังไม่มีคะแนนสำหรับคำนวณอันดับรวม"
          note="คำนวณจากงานทั้งหมดของทุกวิชา · งานที่ยังไม่มีคะแนนนับเป็น 0 คะแนน"
        />
      </Card>

      <Card
        component="section"
        aria-label="อันดับแยกตามรายวิชา"
        variant="outlined"
        sx={{
          p: { xs: 2, md: 2.75 },
          overflow: 'hidden',
          borderRadius: 3,
          borderTop: '4px solid',
          borderTopColor: 'primary.main',
          boxShadow: (theme) => theme.shadows[4],
        }}
      >
        <SectionHeading
          compact
          icon="solar:notebook-bold-duotone"
          title="อันดับรายวิชา"
          subtitle="เลือกวิชาเพื่อดูอันดับเฉพาะรายวิชา"
        />

        {!!subjectRankings.length && (
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
            {subjectRankings.map((item) => (
              <Chip
                clickable
                key={item.id}
                label={item.subject.code || item.subject.name}
                title={`${item.subject.name} · ${item.semester.name}`}
                color={selectedSubject?.id === item.id ? 'primary' : 'default'}
                variant={selectedSubject?.id === item.id ? 'filled' : 'outlined'}
                onClick={() => setSelectedSubjectId(item.id)}
                aria-pressed={selectedSubject?.id === item.id}
                aria-label={`ดูอันดับวิชา ${item.subject.name}`}
                sx={{
                  height: 40,
                  px: 0.75,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  borderRadius: 1.5,
                  '&:focus-visible': {
                    outline: '3px solid',
                    outlineColor: 'primary.light',
                    outlineOffset: 2,
                  },
                }}
              />
            ))}
          </Stack>
        )}

        {selectedSubject ? (
          <>
            <Box sx={{ mb: 1.5 }}>
              <Typography component="h3" variant="subtitle1">
                {selectedSubject.subject.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {selectedSubject.semester.name}
              </Typography>
            </Box>
            <RankingList
              ranking={selectedSubject.ranking}
              emptyText="วิชานี้ยังไม่มีงานสำหรับคำนวณอันดับ"
              note={`คำนวณจากงานทั้งหมดในวิชา ${selectedSubject.subject.name} · งานที่ยังไม่มีคะแนนนับเป็น 0 คะแนน`}
            />
          </>
        ) : (
          <EmptyCard text="ยังไม่มีรายวิชาสำหรับแสดงอันดับ" compact />
        )}
      </Card>
    </Stack>
  );
}

function RankingList({
  ranking,
  emptyText,
  note,
}: {
  ranking: StudentHomeDashboard['ranking'];
  emptyText: string;
  note: string;
}) {
  const visibleRanking = ranking.slice(0, 5);
  const currentStudent = ranking.find((row) => row.is_current_student);
  const hasScoreItems = ranking.some((row) => row.full_score > 0);
  const medalColors = ['warning.main', 'grey.500', 'secondary.dark'];

  if (!ranking.length || !hasScoreItems) return <EmptyCard text={emptyText} compact />;

  return (
    <>
      <Stack component="ol" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {visibleRanking.map((row, index) => (
          <Box
            component="li"
            key={row.student.id}
            aria-label={`อันดับ ${row.rank} ${displayName(row.student)} คะแนน ${row.percentage.toFixed(1)} เปอร์เซ็นต์`}
            sx={{
              p: { xs: 1.25, sm: 1.5 },
              gap: 1.25,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 2,
              bgcolor: row.is_current_student ? 'primary.lighter' : 'background.neutral',
              border: '1px solid',
              borderColor: row.is_current_student ? 'primary.light' : 'transparent',
            }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                display: 'grid',
                flexShrink: 0,
                borderRadius: '50%',
                placeItems: 'center',
                color: index < 3 ? medalColors[index] : 'text.secondary',
                bgcolor: 'background.paper',
                fontWeight: 800,
              }}
            >
              {index < 3 ? <RemixIcon icon="solar:cup-star-bold" width={19} aria-hidden /> : row.rank}
            </Box>
            <Avatar
              sx={{
                width: 38,
                height: 38,
                fontSize: 15,
                color: row.is_current_student ? 'primary.darker' : 'text.secondary',
                bgcolor: row.is_current_student ? 'primary.lighter' : 'background.paper',
              }}
            >
              {(row.student.first_name ?? row.student.username).slice(0, 1).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle2" noWrap>
                {displayName(row.student)} {row.is_current_student && '(คุณ)'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {row.student_number ? `เลขที่ ${row.student_number}` : 'ยังไม่มีเลขที่'}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>
                {row.percentage.toFixed(1)}%
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {row.score}/{row.full_score}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>

      {currentStudent && !visibleRanking.some((row) => row.is_current_student) && (
        <Alert severity="info" icon={<RemixIcon icon="solar:cup-star-bold" />} sx={{ mt: 2 }}>
          อันดับของคุณคือ #{currentStudent.rank} · {currentStudent.percentage.toFixed(1)}%
        </Alert>
      )}
      <Typography variant="caption" sx={{ mt: 1.5, display: 'block', color: 'text.secondary' }}>
        {note}
      </Typography>
    </>
  );
}

function AnnouncementsSection({
  announcements,
}: {
  announcements: StudentHomeDashboard['announcements'];
}) {
  const priorityConfig = {
    normal: { label: 'ทั่วไป', color: 'info' as const, border: 'info.main' },
    important: { label: 'สำคัญ', color: 'warning' as const, border: 'warning.main' },
    urgent: { label: 'เร่งด่วน', color: 'error' as const, border: 'error.main' },
  };
  const typeConfig = {
    general: { label: 'ประกาศทั่วไป', icon: 'solar:bell-bing-bold' as const },
    holiday: { label: 'วันหยุด', icon: 'solar:calendar-date-bold' as const },
    exam: { label: 'วันสอบ', icon: 'solar:file-check-bold-duotone' as const },
  };

  return (
    <Card
      component="section"
      aria-label="ประกาศจากโรงเรียน"
      variant="outlined"
      sx={{
        p: { xs: 2, md: 2.75 },
        borderRadius: 3,
        borderTop: '4px solid',
        borderTopColor: 'info.main',
        boxShadow: (theme) => theme.shadows[4],
      }}
    >
      <SectionHeading
        compact
        icon="solar:bell-bing-bold"
        title="ประกาศจากโรงเรียน"
        subtitle="ข่าวสารและเรื่องสำคัญที่ควรรู้"
      />

      {announcements.length ? (
        <Stack spacing={1.25}>
          {announcements.map((announcement) => {
            const priority = priorityConfig[announcement.priority];
            const type = typeConfig[announcement.announcement_type];
            return (
              <Box
                component="article"
                key={announcement.id}
                sx={{
                  p: { xs: 1.75, sm: 2 },
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderLeft: `4px solid ${priority.border}`,
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                  justifyContent="space-between"
                  sx={{ mb: 0.75 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography component="h3" variant="subtitle1">
                      {announcement.title}
                    </Typography>
                    <Label variant="soft" color={priority.color}>
                      {priority.label}
                    </Label>
                    <Label
                      variant="outlined"
                      color="default"
                      startIcon={<RemixIcon icon={type.icon} />}
                    >
                      {type.label}
                    </Label>
                  </Stack>
                  <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                    {new Intl.DateTimeFormat('th-TH', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }).format(new Date(announcement.published_at))}
                  </Typography>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', whiteSpace: 'pre-line', lineHeight: 1.75 }}
                >
                  {announcement.content}
                </Typography>
                {announcement.image_url && (
                  <Box
                    component="img"
                    src={announcement.image_url}
                    alt={announcement.title}
                    sx={{
                      mt: 2,
                      width: '100%',
                      maxHeight: 320,
                      borderRadius: 2,
                      objectFit: 'cover',
                    }}
                  />
                )}
                {(announcement.event_start || announcement.event_end) && (
                  <Typography
                    variant="caption"
                    sx={{ mt: 1, display: 'block', color: 'text.secondary' }}
                  >
                    กำหนดการ:{' '}
                    {announcement.event_start
                      ? new Intl.DateTimeFormat('th-TH', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(announcement.event_start))
                      : 'ไม่ระบุ'}{' '}
                    –{' '}
                    {announcement.event_end
                      ? new Intl.DateTimeFormat('th-TH', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(announcement.event_end))
                      : 'ไม่ระบุ'}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>
      ) : (
        <EmptyCard text="ยังไม่มีประกาศใหม่จากโรงเรียน" compact />
      )}
    </Card>
  );
}
