'use client';

import type { StudentStatus } from '../user-actions';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
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

import { fDate } from 'src/utils/format-time';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';

import { StudentGuardiansPanel } from 'src/sections/student-guardian/components/student-guardians-panel';

import { useAuthContext } from 'src/auth/hooks';

import { getStudent } from '../user-actions';
import { StudentAvatarDialog } from '../components/student-avatar-dialog';

// ----------------------------------------------------------------------

const STUDENT_STATUS_META: Record<
  StudentStatus,
  { label: string; color: 'success' | 'info' | 'warning' | 'error' | 'default' }
> = {
  studying: { label: 'กำลังศึกษา', color: 'success' },
  graduated: { label: 'จบการศึกษา', color: 'info' },
  transferred: { label: 'ย้ายออก', color: 'warning' },
  withdrawn: { label: 'ลาออก', color: 'default' },
  dismissed: { label: 'ให้ออก', color: 'error' },
};

const GENDER_LABEL: Record<string, string> = {
  male: 'ชาย',
  female: 'หญิง',
  other: 'อื่น ๆ',
  unspecified: 'ไม่ระบุ',
};

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.25 }}>
        {value || '-'}
      </Typography>
    </Box>
  );
}

export function StudentDetailView({
  studentId,
  basePath = paths.admin.student.root,
}: {
  studentId: string;
  basePath?: string;
}) {
  const backPath = basePath;
  const editPath = `${basePath}/${studentId}/edit`;
  const { user: currentUser } = useAuthContext();
  const canManageStudents = currentUser?.role === 'school_admin';
  const [avatarOpen, setAvatarOpen] = useState(false);

  const {
    data: student,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['users', 'student', studentId],
    queryFn: () => getStudent(studentId),
  });

  if (isLoading) {
    return (
      <Box sx={{ py: 12, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !student) {
    return (
      <Container maxWidth="md">
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          ไม่พบข้อมูลนักเรียนนี้
        </Alert>
      </Container>
    );
  }

  const statusMeta = STUDENT_STATUS_META[student.student_status ?? 'studying'];
  const fullName =
    `${student.name_prefix ?? ''}${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() ||
    student.username;
  const fullNameEn = `${student.first_name_en ?? ''} ${student.last_name_en ?? ''}`.trim();

  return (
    <Container maxWidth={false} sx={{ pb: 6 }}>
      <Button
        component={RouterLink}
        href={backPath}
        color="inherit"
        startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        sx={{ mb: 2 }}
      >
        กลับหน้าทะเบียนนักเรียน
      </Button>

      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          <Tooltip title={canManageStudents ? 'เปลี่ยนรูปโปรไฟล์' : 'รูปโปรไฟล์'}>
            <IconButton
              onClick={() => canManageStudents && setAvatarOpen(true)}
              disabled={!canManageStudents}
              aria-label="จัดการรูปโปรไฟล์"
              sx={{ p: 0.5 }}
            >
              <Avatar
                src={student.avatar_url ?? undefined}
                alt={fullName}
                sx={{
                  width: 64,
                  height: 64,
                  fontSize: 24,
                  bgcolor: 'primary.lighter',
                  color: 'primary.darker',
                }}
              >
                {(student.first_name ?? student.username).charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Box>
            <Box sx={{ gap: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography component="h1" variant="h4">
                {fullName}
              </Typography>
              <Label variant="soft" color={statusMeta.color}>
                {statusMeta.label}
              </Label>
            </Box>
            <Typography sx={{ mt: 0.5, color: 'text.secondary' }}>
              รหัสนักเรียน {student.student_code ?? '-'} · ผู้ใช้งาน {student.username}
              {student.nickname ? ` · ชื่อเล่น ${student.nickname}` : ''}
            </Typography>
          </Box>
        </Box>
        {canManageStudents && (
          <Button
            variant="outlined"
            component={RouterLink}
            href={editPath}
            startIcon={<RemixIcon icon="solar:pen-bold" />}
          >
            แก้ไขข้อมูลนักเรียน
          </Button>
        )}
      </Box>

      <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          ข้อมูลนักเรียน
        </Typography>
        <Box
          sx={{
            gap: 2.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          <InfoField label="ชื่อ–นามสกุล (ไทย)" value={fullName} />
          <InfoField label="ชื่อ–นามสกุล (อังกฤษ)" value={fullNameEn} />
          <InfoField label="ชื่อเล่น" value={student.nickname ?? ''} />
          <InfoField
            label="เพศ"
            value={student.gender ? (GENDER_LABEL[student.gender] ?? student.gender) : ''}
          />
          <InfoField label="วันเกิด" value={student.birth_date ? fDate(student.birth_date) : ''} />
          <InfoField label="สัญชาติ" value={student.nationality ?? ''} />
          <InfoField label="เชื้อชาติ" value={student.ethnicity ?? ''} />
          <InfoField label="ศาสนา" value={student.religion ?? ''} />
          <InfoField label="เลขประจำตัวประชาชน" value={student.national_id ?? ''} />
          <InfoField label="อีเมล" value={student.email ?? ''} />
          <InfoField label="เข้าเรียนในระบบเมื่อ" value={fDate(student.created_at)} />
          <InfoField
            label="สถานะบัญชี"
            value={student.is_active !== false ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
          />
        </Box>
      </Card>

      <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <StudentGuardiansPanel student={student} />
      </Card>

      <StudentAvatarDialog student={avatarOpen ? student : null} onClose={() => setAvatarOpen(false)} />
    </Container>
  );
}
