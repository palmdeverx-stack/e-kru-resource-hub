'use client';

import type { GuardianStudentProfile, GuardianAttendanceStatus } from '../guardian-profile-actions';

import { useQuery, useMutation } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import {
  RiTimeLine,
  RiSchoolLine,
  RiUserHeartLine,
  RiLogoutBoxRLine,
  RiShieldCheckLine,
  RiCalendarCheckLine,
  RiGraduationCapLine,
} from 'src/components/remix-icon';

import { GuardianPortalLogin } from '../components/guardian-portal-login';
import {
  getGuardianProfile,
  GuardianPortalError,
  logoutGuardianPortal,
} from '../guardian-profile-actions';

// ----------------------------------------------------------------------

const STATUS = {
  studying: { label: 'กำลังศึกษา', color: 'success' as const },
  graduated: { label: 'สำเร็จการศึกษา', color: 'info' as const },
  transferred: { label: 'ย้ายโรงเรียน', color: 'warning' as const },
  withdrawn: { label: 'ลาออก', color: 'warning' as const },
  dismissed: { label: 'พ้นสภาพ', color: 'error' as const },
};

const GENDER = {
  male: 'ชาย',
  female: 'หญิง',
  other: 'อื่น ๆ',
  unspecified: 'ไม่ระบุ',
};

const ATTENDANCE_STATUS = {
  present: { label: 'มา', color: 'success' as const },
  absent: { label: 'ขาด', color: 'error' as const },
  leave: { label: 'ลา', color: 'info' as const },
  late: { label: 'สาย', color: 'warning' as const },
};

export function GuardianStudentProfileView() {
  const query = useQuery({
    queryKey: ['guardian-student-profile'],
    queryFn: getGuardianProfile,
    staleTime: 0,
    retry: false,
  });
  const logoutMutation = useMutation({
    mutationFn: logoutGuardianPortal,
    onSuccess: () => query.refetch(),
  });

  if (query.isLoading) {
    return (
      <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 5 } }}>
        <Skeleton variant="rounded" height={120} sx={{ borderRadius: 3 }} />
        <Skeleton variant="rounded" height={320} sx={{ mt: 2, borderRadius: 3 }} />
      </Container>
    );
  }

  if (query.isError || !query.data) {
    if (query.error instanceof GuardianPortalError && query.error.status === 401) {
      return <GuardianPortalLogin onAuthenticated={() => query.refetch()} />;
    }
    return (
      <Container maxWidth="sm" sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 3, md: 10 } }}>
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => query.refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          {query.error?.message ??
            'ไม่สามารถเปิดโปรไฟล์ได้ กรุณาพิมพ์ “ข้อมูลนักเรียน” ใน LINE อีกครั้ง'}
        </Alert>
      </Container>
    );
  }

  const { school, students } = query.data;

  return (
    <Container
      maxWidth="md"
      sx={{ px: { xs: 1.5, sm: 3 }, pt: { xs: 1.5, sm: 3, md: 5 }, pb: { xs: 4, md: 8 } }}
    >
      <Card
        sx={{
          p: { xs: 2, sm: 3.5 },
          color: 'common.white',
          borderRadius: { xs: 2.5, sm: 4 },
          boxShadow: { xs: '0 8px 24px rgba(18,58,114,0.22)', sm: 8 },
          background: 'linear-gradient(135deg, #123A72 0%, #1976D2 100%)',
        }}
      >
        <Box sx={{ gap: { xs: 1.25, sm: 2 }, display: 'flex', alignItems: 'center' }}>
          <Avatar
            src={school?.logo_url ?? undefined}
            sx={{
              width: { xs: 52, sm: 68 },
              height: { xs: 52, sm: 68 },
              flexShrink: 0,
              bgcolor: 'common.white',
              color: 'primary.main',
              border: '3px solid rgba(255,255,255,0.22)',
            }}
          >
            <RiSchoolLine size={26} />
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="overline" sx={{ lineHeight: 1.2, opacity: 0.75 }}>
              Parent Portal
            </Typography>
            <Typography
              component="h1"
              variant="h4"
              sx={{
                mt: 0.25,
                fontSize: { xs: 20, sm: 28, md: 32 },
                lineHeight: { xs: 1.3, sm: 1.25 },
                overflowWrap: 'anywhere',
              }}
            >
              {school?.name ?? 'ข้อมูลนักเรียน'}
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.5, display: { xs: 'none', sm: 'block' }, opacity: 0.8 }}
            >
              โปรไฟล์บุตรหลานที่เชื่อมกับบัญชี LINE ของคุณ
            </Typography>
          </Box>
          <Button
            color="inherit"
            variant="outlined"
            loading={logoutMutation.isPending}
            startIcon={<RiLogoutBoxRLine />}
            onClick={() => logoutMutation.mutate()}
            aria-label="ออกจากระบบ Parent Portal"
            sx={{
              minWidth: { xs: 40, sm: 64 },
              px: { xs: 1, sm: 2 },
              flexShrink: 0,
              color: 'common.white',
              borderColor: 'rgba(255,255,255,0.4)',
              '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
              '&:hover': { borderColor: 'common.white' },
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              ออกจากระบบ
            </Box>
          </Button>
        </Box>
        <Typography
          variant="caption"
          sx={{ mt: 1.25, display: { xs: 'block', sm: 'none' }, opacity: 0.8 }}
        >
          โปรไฟล์และประวัติการเข้าเรียนของบุตรหลาน
        </Typography>
      </Card>

      <Box sx={{ gap: { xs: 1.5, sm: 3 }, mt: { xs: 1.5, sm: 3 }, display: 'grid' }}>
        {students.map((student) => (
          <StudentProfileCard key={student.id} student={student} />
        ))}
      </Box>

      <Alert
        severity="info"
        icon={<RiShieldCheckLine />}
        sx={{
          mt: { xs: 1.5, sm: 3 },
          alignItems: 'flex-start',
          borderRadius: 2.5,
          '& .MuiAlert-message': { fontSize: { xs: 12, sm: 14 } },
        }}
      >
        ข้อมูลเป็นแบบอ่านอย่างเดียว การเข้าสู่ระบบจดจำไว้ 30 วัน และเปิดได้เฉพาะบัญชี LINE
        ผู้ปกครองที่เชื่อมกับนักเรียน
      </Alert>
    </Container>
  );
}

function StudentProfileCard({ student }: { student: GuardianStudentProfile }) {
  const classroomValue = Array.isArray(student.enrollment?.classroom)
    ? student.enrollment.classroom[0]
    : student.enrollment?.classroom;
  const displayName =
    `${student.name_prefix ?? ''}${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() ||
    'นักเรียน';
  const englishName = `${student.first_name_en ?? ''} ${student.last_name_en ?? ''}`.trim();
  const status = STATUS[student.student_status ?? 'studying'];

  return (
    <Card
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderRadius: { xs: 2.5, sm: 3 },
        bgcolor: 'rgba(255,255,255,0.96)',
        boxShadow: { xs: '0 6px 20px rgba(15,23,42,0.10)', sm: 2 },
      }}
    >
      <Box
        sx={{
          p: { xs: 2, sm: 3 },
          gap: { xs: 1.5, sm: 2.5 },
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Avatar
          src={student.avatar_url ?? undefined}
          alt={displayName}
          sx={{
            width: { xs: 64, sm: 82 },
            height: { xs: 64, sm: 82 },
            flexShrink: 0,
            fontSize: { xs: 22, sm: 28 },
            color: 'primary.main',
            bgcolor: 'primary.lighter',
            border: '3px solid',
            borderColor: 'primary.lighter',
          }}
        >
          {student.first_name?.charAt(0) ?? <RiGraduationCapLine />}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ gap: 0.75, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography
              component="h2"
              variant="h5"
              sx={{ fontSize: { xs: 18, sm: 24 }, lineHeight: 1.35, overflowWrap: 'anywhere' }}
            >
              {displayName}
            </Typography>
            <Chip size="small" color={status.color} label={status.label} variant="soft" />
          </Box>
          {englishName && (
            <Typography variant="body2" sx={{ mt: 0.25, color: 'text.secondary' }}>
              {englishName}
            </Typography>
          )}
          <Box sx={{ gap: 0.75, mt: 0.75, display: 'flex', flexWrap: 'wrap' }}>
            <Chip
              size="small"
              variant="soft"
              icon={<RiGraduationCapLine size={15} />}
              label={`รหัส ${student.student_code ?? 'ไม่ระบุ'}`}
            />
            {student.nickname && (
              <Chip size="small" variant="soft" label={`ชื่อเล่น ${student.nickname}`} />
            )}
          </Box>
        </Box>
      </Box>

      <Divider />

      <Box
        sx={{
          p: { xs: 2, sm: 3 },
          gap: { xs: 1.75, sm: 2 },
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: '1fr 1fr' },
        }}
      >
        <ProfileFact label="ชั้นเรียน" value={classroomValue?.name ?? 'ยังไม่ได้ลงทะเบียน'} />
        <ProfileFact label="ปีการศึกษา" value={classroomValue?.academic_year?.year ?? 'ไม่ระบุ'} />
        <ProfileFact label="เลขที่" value={student.enrollment?.student_number ?? 'ไม่ระบุ'} />
        <ProfileFact
          label="วันเดือนปีเกิด"
          value={
            student.birth_date
              ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' }).format(
                  new Date(`${student.birth_date}T00:00:00`)
                )
              : 'ไม่ระบุ'
          }
        />
        <ProfileFact label="เพศ" value={GENDER[student.gender ?? 'unspecified']} />
        <ProfileFact label="สัญชาติ" value={student.nationality ?? 'ไม่ระบุ'} />
        <ProfileFact label="ศาสนา" value={student.religion ?? 'ไม่ระบุ'} />
        <ProfileFact
          label="ผู้ปกครองที่เชื่อม"
          value={
            student.guardian
              ? `${student.guardian.fullName} (${student.guardian.relationship})`
              : 'ไม่ระบุ'
          }
          icon={<RiUserHeartLine size={18} />}
        />
      </Box>

      <AttendanceSection student={student} />
    </Card>
  );
}

function AttendanceSection({ student }: { student: GuardianStudentProfile }) {
  const records = [
    ...student.attendance.homeroom.map((record) => ({
      id: `homeroom-${record.id}`,
      date: record.date,
      status: record.status,
      title: record.period === 'morning' ? 'เข้าแถวช่วงเช้า' : 'เข้าแถวช่วงเย็น',
      detail: record.classroom?.name ?? '',
      note: record.note,
      type: 'homeroom' as const,
    })),
    ...student.attendance.classes.map((record) => {
      const assignment = Array.isArray(record.assignment)
        ? record.assignment[0]
        : record.assignment;
      const subjectValue = Array.isArray(assignment?.subject)
        ? assignment.subject[0]
        : assignment?.subject;
      const classroomValue = Array.isArray(assignment?.classroom)
        ? assignment.classroom[0]
        : assignment?.classroom;
      return {
        id: `class-${record.id}`,
        date: record.date,
        status: record.status,
        title: subjectValue?.name ?? 'เข้าเรียนรายวิชา',
        detail: [classroomValue?.name, record.period !== 'daily' ? record.period : null]
          .filter(Boolean)
          .join(' · '),
        note: record.note,
        type: 'class' as const,
      };
    }),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const summary = records.reduce<Record<GuardianAttendanceStatus, number>>(
    (result, record) => ({ ...result, [record.status]: result[record.status] + 1 }),
    { present: 0, absent: 0, leave: 0, late: 0 }
  );

  return (
    <>
      <Divider />
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            gap: 1.5,
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontSize: { xs: 17, sm: 20 } }}>
              ประวัติการเข้าเรียน
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontSize: { xs: 12, sm: 14 }, color: 'text.secondary' }}
            >
              รวมข้อมูลเข้าแถวและเข้าเรียนรายวิชาย้อนหลัง 1 ปี
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            gap: 0.75,
            mt: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          }}
        >
          {(Object.keys(ATTENDANCE_STATUS) as GuardianAttendanceStatus[]).map((status) => {
            const item = ATTENDANCE_STATUS[status];
            return (
              <Box
                key={status}
                sx={{
                  py: { xs: 1, sm: 1.25 },
                  px: 0.5,
                  minWidth: 0,
                  textAlign: 'center',
                  borderRadius: 1.5,
                  color: `${item.color}.dark`,
                  bgcolor: `${item.color}.lighter`,
                }}
              >
                <Typography variant="h6" sx={{ fontSize: { xs: 18, sm: 20 }, lineHeight: 1.2 }}>
                  {summary[status]}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {!records.length ? (
          <Box
            sx={{
              py: { xs: 4, sm: 5 },
              mt: 2,
              textAlign: 'center',
              borderRadius: 2,
              bgcolor: 'background.neutral',
            }}
          >
            <RiCalendarCheckLine size={30} />
            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              ยังไม่มีประวัติการเข้าเรียน
            </Typography>
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            {records.slice(0, 30).map((record, index) => {
              const status = ATTENDANCE_STATUS[record.status];
              return (
                <Box key={record.id}>
                  <Box
                    sx={{
                      gap: { xs: 1, sm: 1.5 },
                      py: { xs: 1.25, sm: 1.5 },
                      display: 'flex',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Avatar
                      variant="rounded"
                      sx={{
                        width: { xs: 34, sm: 38 },
                        height: { xs: 34, sm: 38 },
                        flexShrink: 0,
                        color: record.type === 'homeroom' ? 'primary.main' : 'info.main',
                        bgcolor: record.type === 'homeroom' ? 'primary.lighter' : 'info.lighter',
                      }}
                    >
                      {record.type === 'homeroom' ? (
                        <RiCalendarCheckLine size={19} />
                      ) : (
                        <RiTimeLine size={19} />
                      )}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontSize: { xs: 13, sm: 14 }, lineHeight: 1.35 }}
                      >
                        {record.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          mt: 0.25,
                          display: 'block',
                          lineHeight: 1.45,
                          color: 'text.secondary',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(
                          new Date(`${record.date}T00:00:00`)
                        )}
                        {record.detail ? ` · ${record.detail}` : ''}
                        {record.note ? ` · ${record.note}` : ''}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={status.color}
                      variant="soft"
                      label={status.label}
                      sx={{ flexShrink: 0 }}
                    />
                  </Box>
                  {index < Math.min(records.length, 30) - 1 && <Divider />}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </>
  );
}

function ProfileFact({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        sx={{
          gap: 0.5,
          display: 'flex',
          fontSize: { xs: 11, sm: 12 },
          alignItems: 'center',
          color: 'text.secondary',
        }}
      >
        {icon}
        {label}
      </Typography>
      <Typography
        variant="subtitle2"
        sx={{
          mt: 0.25,
          fontSize: { xs: 13, sm: 14 },
          lineHeight: 1.4,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
