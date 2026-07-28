'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';
import { EmptyContent } from 'src/components/empty-content';

import { getMyDepartment, listDepartmentAnnouncements } from '../teacher-department-actions';
import { DepartmentAnnouncementFormDialog } from '../components/department-announcement-form-dialog';

// ----------------------------------------------------------------------

function formatThaiDateTime(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function memberName(member: { teacher: { first_name: string | null; last_name: string | null } }) {
  return `${member.teacher.first_name ?? ''} ${member.teacher.last_name ?? ''}`.trim();
}

export function TeacherDepartmentView() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const departmentQuery = useQuery({ queryKey: ['my-department'], queryFn: getMyDepartment });
  const isHead = departmentQuery.data?.roleInDepartment === 'head';

  const announcementsQuery = useQuery({
    queryKey: ['department-announcements'],
    queryFn: listDepartmentAnnouncements,
    enabled: !!departmentQuery.data?.department,
  });

  if (departmentQuery.isLoading) {
    return (
      <Container maxWidth={false} sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!departmentQuery.data?.department) {
    return (
      <Container maxWidth={false} sx={{ pb: 5 }}>
        <EmptyContent title="คุณไม่ได้สังกัดฝ่ายใด" description="ติดต่อผู้ดูแลโรงเรียนเพื่อเพิ่มคุณเข้าฝ่าย" />
      </Container>
    );
  }

  const { department, members } = departmentQuery.data;

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
          <Typography component="h1" variant="h3">
            {department.name}
          </Typography>
          {isHead && <Chip size="small" color="primary" variant="soft" label="หัวหน้าฝ่าย" />}
        </Box>
        {department.description && (
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>{department.description}</Typography>
        )}
      </Box>

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
          alignItems: 'flex-start',
        }}
      >
        <Card variant="outlined">
          <Box
            sx={{
              px: 3,
              py: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box>
              <Typography component="h2" variant="h6">
                ประกาศฝ่าย
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                ข่าวสารและงานที่มอบหมายภายในฝ่าย
              </Typography>
            </Box>
            {isHead && (
              <Button
                variant="contained"
                size="small"
                startIcon={<RemixIcon icon="mingcute:add-line" />}
                onClick={() => setDialogOpen(true)}
              >
                สร้างประกาศ
              </Button>
            )}
          </Box>

          <Box sx={{ p: 3 }}>
            {announcementsQuery.isError && (
              <Alert severity="error">ไม่สามารถโหลดประกาศได้</Alert>
            )}
            {announcementsQuery.isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            )}
            {!announcementsQuery.isLoading && !announcementsQuery.data?.length && (
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
                ยังไม่มีประกาศในฝ่ายนี้
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {announcementsQuery.data?.map((announcement) => (
                <Box
                  key={announcement.id}
                  sx={{ p: 2, borderRadius: 1.5, bgcolor: 'background.neutral' }}
                >
                  <Typography variant="subtitle2">{announcement.title}</Typography>
                  <Typography
                    variant="body2"
                    sx={{ mt: 0.5, color: 'text.secondary', whiteSpace: 'pre-wrap' }}
                  >
                    {announcement.content}
                  </Typography>
                  <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.disabled' }}>
                    {announcement.author &&
                      `${announcement.author.first_name ?? ''} ${announcement.author.last_name ?? ''} · `}
                    {formatThaiDateTime(announcement.created_at)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Card>

        <Card variant="outlined">
          <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography component="h2" variant="h6">
              สมาชิกฝ่าย
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              {members.length} คน
            </Typography>
          </Box>
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {members.map((member) => (
              <Box key={member.id} sx={{ gap: 1.5, p: 1, display: 'flex', alignItems: 'center' }}>
                <Avatar src={member.teacher.avatar_url ?? undefined}>
                  {member.teacher.first_name?.charAt(0) ?? '?'}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" noWrap>
                    {memberName(member)}
                  </Typography>
                </Box>
                {member.role_in_department === 'head' && (
                  <Chip size="small" variant="soft" color="primary" label="หัวหน้า" />
                )}
                {isHead && (
                  <Tooltip title="ดูข้อมูลการสอน">
                    <IconButton
                      size="small"
                      component={RouterLink}
                      href={paths.teacher.departmentMember(member.teacher.id)}
                      aria-label={`ดูข้อมูลการสอนของ ${memberName(member)}`}
                    >
                      <RemixIcon icon="solar:notebook-bold-duotone" width={18} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ))}
          </Box>
        </Card>
      </Box>

      <DepartmentAnnouncementFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Container>
  );
}
