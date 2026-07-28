'use client';

import { varAlpha } from 'minimal-shared/utils';
import { useQuery } from '@tanstack/react-query';

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

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';

import { getStudentProfile, type StudentProfile } from '../student-profile-actions';

// ----------------------------------------------------------------------

type StudentStatus = NonNullable<StudentProfile['student_status']>;
type StudentGuardian = StudentProfile['guardians'][number];

const STUDENT_STATUS_CONFIG: Record<
  StudentStatus,
  { label: string; color: 'success' | 'info' | 'warning' | 'error' }
> = {
  studying: { label: 'กำลังศึกษา', color: 'success' },
  graduated: { label: 'สำเร็จการศึกษา', color: 'info' },
  transferred: { label: 'ย้ายโรงเรียน', color: 'warning' },
  withdrawn: { label: 'ลาออก', color: 'warning' },
  dismissed: { label: 'พ้นสภาพ', color: 'error' },
};

export function StudentProfileView() {
  const {
    data: profile,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['student-profile'],
    queryFn: getStudentProfile,
  });

  if (isLoading) return <ProfileSkeleton />;

  if (isError || !profile) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 7 } }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          ไม่สามารถโหลดข้อมูลโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง
        </Alert>
      </Container>
    );
  }

  const displayName =
    `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.username;
  const initials =
    [profile.first_name, profile.last_name]
      .filter(Boolean)
      .map((name) => name?.charAt(0))
      .join('') || profile.username.charAt(0).toUpperCase();
  const classroom = profile.enrollment?.classroom;
  const studentStatus = STUDENT_STATUS_CONFIG[profile.student_status ?? 'studying'];
  const memberSince = new Intl.DateTimeFormat('th-TH', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(profile.created_at));

  return (
    <Container maxWidth="lg" sx={{ pt: { xs: 2, md: 3 }, pb: { xs: 5, md: 7 } }}>
      <Card
        sx={{
          mb: 3,
          p: { xs: 2.5, sm: 3.5, md: 4 },
          minHeight: { md: 220 },
          color: 'common.white',
          overflow: 'hidden',
          position: 'relative',
          borderRadius: 4,
          boxShadow: (theme) =>
            `0 24px 48px ${varAlpha(theme.vars.palette.primary.darkerChannel, 0.2)}`,
          background: (theme) =>
            `linear-gradient(135deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.main} 55%, ${theme.vars.palette.primary.light} 100%)`,
          '&::before': {
            top: -110,
            right: -60,
            width: 280,
            height: 280,
            content: '""',
            borderRadius: '50%',
            position: 'absolute',
            bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.1),
          },
          '&::after': {
            right: 180,
            bottom: -120,
            width: 220,
            height: 220,
            content: '""',
            borderRadius: '50%',
            position: 'absolute',
            bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.07),
          },
        }}
      >
        <Box
          sx={{
            gap: { xs: 2.5, sm: 3 },
            zIndex: 1,
            display: 'flex',
            position: 'relative',
            alignItems: { xs: 'flex-start', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Avatar
            src={profile.avatar_url ?? undefined}
            aria-label={`รูปโปรไฟล์ของ ${displayName}`}
            sx={{
              width: { xs: 84, sm: 108 },
              height: { xs: 84, sm: 108 },
              fontSize: { xs: 30, sm: 38 },
              fontWeight: 800,
              color: 'primary.darker',
              bgcolor: 'common.white',
              boxShadow: (theme) =>
                `0 12px 28px ${varAlpha(theme.vars.palette.common.blackChannel, 0.18)}`,
              border: (theme) =>
                `4px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.3)}`,
            }}
          >
            {initials}
          </Avatar>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="overline" sx={{ opacity: 0.82, letterSpacing: 1.2 }}>
              ข้อมูลส่วนตัวของฉัน
            </Typography>
            <Typography
              component="h1"
              variant="h3"
              sx={{ mt: 0.25, fontSize: { xs: 28, sm: 36 }, overflowWrap: 'anywhere' }}
            >
              {displayName}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.82 }}>
              ตรวจสอบข้อมูลส่วนตัว การเรียน และผู้ปกครองของคุณ
            </Typography>
            <Box sx={{ gap: 1, mt: 1.75, display: 'flex', flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={studentStatus.label}
                icon={<RemixIcon icon="solar:verified-check-bold" />}
                sx={{
                  fontWeight: 700,
                  color: `${studentStatus.color}.darker`,
                  bgcolor: `${studentStatus.color}.lighter`,
                  '& .MuiChip-icon': { color: `${studentStatus.color}.main` },
                }}
              />
              <Chip
                size="small"
                label={classroom ? `ห้อง ${classroom.name}` : 'ยังไม่มีห้องเรียน'}
                sx={(theme) => ({
                  color: 'common.white',
                  bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
                })}
              />
              {profile.enrollment?.student_number && (
                <Chip
                  size="small"
                  label={`เลขที่ ${profile.enrollment.student_number}`}
                  sx={(theme) => ({
                    color: 'common.white',
                    bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
                  })}
                />
              )}
            </Box>
          </Box>

          <Box
            sx={(theme) => ({
              p: 2,
              gap: 0.5,
              width: { xs: 1, sm: 230 },
              flexShrink: 0,
              display: 'flex',
              borderRadius: 2.5,
              flexDirection: 'column',
              border: `1px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.18)}`,
              bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.1),
              backdropFilter: 'blur(8px)',
            })}
          >
            <Typography variant="caption" sx={{ opacity: 0.72 }}>
              โรงเรียน
            </Typography>
            <Typography variant="subtitle2">
              {profile.school?.name ?? 'ยังไม่มีข้อมูลโรงเรียน'}
            </Typography>
            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.16)' }} />
            <Typography variant="caption" sx={{ opacity: 0.72 }}>
              ภาคเรียน / ปีการศึกษา
            </Typography>
            <Typography variant="subtitle2">
              {profile.semester?.name ?? 'ยังไม่มีข้อมูล'} /{' '}
              {classroom?.academic_year?.year ?? 'ยังไม่มีข้อมูล'}
            </Typography>
          </Box>
        </Box>
      </Card>

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
        }}
      >
        <Box sx={{ gap: 3, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
            <ProfileSectionHeader
              icon="solar:user-id-bold"
              title="ข้อมูลส่วนตัว"
              description="ข้อมูลนักเรียนที่บันทึกไว้ในระบบ"
            />
            <Box
              sx={{
                gap: 1,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              <ProfileFact
                icon="solar:user-rounded-bold"
                label="ชื่อ"
                value={profile.first_name ?? 'ยังไม่มีข้อมูล'}
              />
              <ProfileFact
                icon="solar:user-rounded-bold"
                label="นามสกุล"
                value={profile.last_name ?? 'ยังไม่มีข้อมูล'}
              />
              <ProfileFact
                icon="solar:letter-bold"
                label="อีเมล"
                value={profile.email ?? 'ยังไม่มีข้อมูล'}
              />
              <ProfileFact icon="solar:user-id-bold" label="ชื่อผู้ใช้" value={profile.username} />
            </Box>
          </Card>

          <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
            <ProfileSectionHeader
              icon="solar:notebook-bold-duotone"
              title="ข้อมูลการเรียน"
              description="ข้อมูลห้องเรียนและสถานะปัจจุบันของนักเรียน"
            />
            <Box
              sx={{
                gap: 0.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              <ProfileFact
                icon="solar:users-group-rounded-bold"
                label="โรงเรียน"
                value={profile.school?.name ?? 'ยังไม่มีข้อมูล'}
              />
              <ProfileFact
                icon="solar:notebook-bold-duotone"
                label="ห้องเรียน"
                value={classroom?.name ?? 'ยังไม่ได้ลงทะเบียน'}
              />
              <ProfileFact
                icon="solar:calendar-date-bold"
                label="ปีการศึกษา"
                value={classroom?.academic_year?.year ?? 'ยังไม่มีข้อมูล'}
              />
              <ProfileFact
                icon="solar:flag-bold"
                label="ภาคเรียน"
                value={profile.semester?.name ?? 'ยังไม่มีข้อมูล'}
              />
              <ProfileFact
                icon="solar:user-rounded-bold"
                label="เลขประจำตัวในห้อง"
                value={profile.enrollment?.student_number ?? 'ยังไม่มีข้อมูล'}
              />
              <ProfileFact
                icon="solar:verified-check-bold"
                label="สถานะนักเรียน"
                value={studentStatus.label}
                valueColor={`${studentStatus.color}.main`}
              />
            </Box>
          </Card>

          <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
            <ProfileSectionHeader
              icon="solar:users-group-rounded-bold-duotone"
              title="ข้อมูลผู้ปกครอง"
              description="ข้อมูลสำหรับติดต่อผู้ปกครองที่บันทึกไว้ในระบบ"
            />
            {profile.guardians.length ? (
              <Box sx={{ gap: 1.5, display: 'grid' }}>
                {profile.guardians.map((guardian) => (
                  <GuardianCard key={guardian.id} guardian={guardian} />
                ))}
              </Box>
            ) : (
              <Box
                sx={{
                  py: 5,
                  px: 2,
                  textAlign: 'center',
                  borderRadius: 2,
                  bgcolor: 'background.neutral',
                  border: '1px dashed',
                  borderColor: 'divider',
                }}
              >
                <RemixIcon
                  icon="solar:users-group-rounded-bold"
                  width={42}
                  sx={{ color: 'text.disabled' }}
                />
                <Typography variant="subtitle2" sx={{ mt: 1 }}>
                  ยังไม่มีข้อมูลผู้ปกครอง
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  กรุณาติดต่อผู้ดูแลโรงเรียนเพื่อเพิ่มข้อมูล
                </Typography>
              </Box>
            )}
          </Card>
        </Box>

        <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
          <Card variant="outlined" sx={{ p: 3, textAlign: 'center', borderRadius: 3 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              บัตรนักเรียน
            </Typography>
            <Avatar
              src={profile.avatar_url ?? undefined}
              alt={displayName}
              sx={{
                mx: 'auto',
                mt: 1.5,
                width: 120,
                height: 120,
                fontSize: 38,
                fontWeight: 800,
                color: 'primary.darker',
                bgcolor: 'primary.lighter',
                border: '4px solid',
                borderColor: 'primary.lighter',
                boxShadow: (theme) =>
                  `0 12px 32px ${varAlpha(theme.vars.palette.primary.mainChannel, 0.18)}`,
              }}
            >
              {initials}
            </Avatar>
            <Typography variant="h6" sx={{ mt: 2 }}>
              {displayName}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              @{profile.username}
            </Typography>
            <Chip
              size="small"
              color={studentStatus.color}
              label={studentStatus.label}
              sx={{ mt: 1.5, fontWeight: 700 }}
            />
            <Divider sx={{ my: 2.5 }} />
            <Box sx={{ gap: 1, display: 'flex', alignItems: 'flex-start', textAlign: 'left' }}>
              <RemixIcon
                icon="solar:info-circle-bold"
                width={18}
                sx={{ mt: 0.25, color: 'info.main' }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                รูปโปรไฟล์จัดการโดยผู้ดูแลโรงเรียน หากต้องการเปลี่ยนรูป กรุณาติดต่อผู้ดูแล
              </Typography>
            </Box>
          </Card>

          <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
            <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'flex-start' }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  display: 'grid',
                  borderRadius: 1.5,
                  color: 'primary.main',
                  placeItems: 'center',
                  bgcolor: 'primary.lighter',
                }}
              >
                <RemixIcon icon="solar:shield-keyhole-bold-duotone" width={24} />
              </Box>
              <Box>
                <Typography component="h2" variant="subtitle1">
                  ความปลอดภัยของบัญชี
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  จัดการรหัสผ่านสำหรับเข้าสู่ระบบ
                </Typography>
              </Box>
            </Box>
            <Button
              fullWidth
              component={RouterLink}
              href={paths.auth.jwt.changePassword}
              variant="outlined"
              startIcon={<RemixIcon icon="ic:round-vpn-key" />}
              sx={{ mt: 2.5 }}
            >
              เปลี่ยนรหัสผ่าน
            </Button>
            <Typography
              variant="caption"
              sx={{ mt: 1.5, display: 'block', textAlign: 'center', color: 'text.secondary' }}
            >
              เป็นสมาชิกตั้งแต่ {memberSince}
            </Typography>
          </Card>
        </Box>
      </Box>
    </Container>
  );
}

// ----------------------------------------------------------------------

type ProfileSectionHeaderProps = {
  icon:
    | 'solar:user-id-bold'
    | 'solar:notebook-bold-duotone'
    | 'solar:users-group-rounded-bold-duotone';
  title: string;
  description: string;
};

function ProfileSectionHeader({ icon, title, description }: ProfileSectionHeaderProps) {
  return (
    <Box sx={{ gap: 1.5, mb: 3, display: 'flex', alignItems: 'center' }}>
      <Box
        sx={{
          width: 46,
          height: 46,
          flexShrink: 0,
          display: 'grid',
          borderRadius: 1.75,
          color: 'primary.main',
          placeItems: 'center',
          bgcolor: 'primary.lighter',
        }}
      >
        <RemixIcon icon={icon} width={24} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h2" variant="h6">
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {description}
        </Typography>
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

function GuardianCard({ guardian }: { guardian: StudentGuardian }) {
  return (
    <Card
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2.5,
        bgcolor: 'background.neutral',
      }}
    >
      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'flex-start' }}>
        <Avatar sx={{ color: 'primary.main', bgcolor: 'primary.lighter' }}>
          <RemixIcon icon="solar:user-rounded-bold" />
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ gap: 0.75, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="subtitle1">{guardian.full_name}</Typography>
            <Chip size="small" variant="outlined" label={guardian.relationship} />
            {guardian.is_primary && (
              <Chip size="small" color="primary" label="ผู้ติดต่อหลัก" sx={{ fontWeight: 700 }} />
            )}
          </Box>
          {guardian.occupation && (
            <Typography variant="body2" sx={{ mt: 0.25, color: 'text.secondary' }}>
              อาชีพ {guardian.occupation}
            </Typography>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          gap: 1,
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: guardian.email ? '1fr 1fr' : '1fr' },
        }}
      >
        <Button
          component="a"
          href={`tel:${guardian.phone}`}
          color="inherit"
          variant="outlined"
          startIcon={<RemixIcon icon="solar:phone-bold" />}
          sx={{ justifyContent: 'flex-start' }}
        >
          {guardian.phone}
        </Button>
        {guardian.email && (
          <Button
            component="a"
            href={`mailto:${guardian.email}`}
            color="inherit"
            variant="outlined"
            startIcon={<RemixIcon icon="solar:letter-bold" />}
            sx={{ minWidth: 0, justifyContent: 'flex-start', overflowWrap: 'anywhere' }}
          >
            {guardian.email}
          </Button>
        )}
      </Box>

      {(guardian.address || guardian.notes) && <Divider sx={{ my: 2 }} />}
      {guardian.address && (
        <Box sx={{ gap: 1, display: 'flex', alignItems: 'flex-start' }}>
          <RemixIcon
            icon="solar:home-2-outline"
            width={18}
            sx={{ mt: 0.25, color: 'text.secondary' }}
          />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {guardian.address}
          </Typography>
        </Box>
      )}
      {guardian.notes && (
        <Box
          sx={{ gap: 1, mt: guardian.address ? 1 : 0, display: 'flex', alignItems: 'flex-start' }}
        >
          <RemixIcon
            icon="solar:file-text-bold"
            width={18}
            sx={{ mt: 0.25, color: 'text.secondary' }}
          />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            หมายเหตุ: {guardian.notes}
          </Typography>
        </Box>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------

type ProfileFactProps = {
  icon:
    | 'solar:user-id-bold'
    | 'solar:users-group-rounded-bold'
    | 'solar:notebook-bold-duotone'
    | 'solar:calendar-date-bold'
    | 'solar:flag-bold'
    | 'solar:letter-bold'
    | 'solar:user-rounded-bold'
    | 'solar:verified-check-bold';
  label: string;
  value: string;
  valueColor?: string;
};

function ProfileFact({ icon, label, value, valueColor }: ProfileFactProps) {
  return (
    <Box
      sx={{
        p: 1,
        gap: 0,
        minWidth: 0,
        display: 'flex',
        borderRadius: 2,
        alignItems: 'center',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography variant="subtitle1" sx={{ color: valueColor, overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

function ProfileSkeleton() {
  return (
    <Container maxWidth="lg" aria-label="กำลังโหลดโปรไฟล์" sx={{ pb: 5 }}>
      <Skeleton variant="rounded" height={184} sx={{ mb: 3, borderRadius: 2 }} />
      <Box
        sx={{
          gap: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' },
        }}
      >
        <Skeleton variant="rounded" height={520} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" height={390} sx={{ borderRadius: 2 }} />
      </Box>
    </Container>
  );
}
