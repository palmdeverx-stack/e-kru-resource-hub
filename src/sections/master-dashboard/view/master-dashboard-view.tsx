'use client';

import { useMemo } from 'react';
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

import { listUsers } from 'src/sections/user/user-actions';
import { listSchools } from 'src/sections/school/school-actions';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export function MasterDashboardView() {
  const { user } = useAuthContext();
  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: listSchools });
  const adminsQuery = useQuery({
    queryKey: ['users', 'school_admin'],
    queryFn: () => listUsers('school_admin'),
  });

  const schools = useMemo(() => schoolsQuery.data ?? [], [schoolsQuery.data]);
  const schoolAdmins = useMemo(() => adminsQuery.data ?? [], [adminsQuery.data]);
  const isLoading = schoolsQuery.isLoading || adminsQuery.isLoading;
  const isError = schoolsQuery.isError || adminsQuery.isError;

  const totals = useMemo(
    () =>
      schools.reduce(
        (result, school) => ({
          teachers: result.teachers + school.teacherCount,
          students: result.students + school.studentCount,
          classrooms: result.classrooms + school.classroomCount,
          subjects: result.subjects + school.subjectCount,
        }),
        { teachers: 0, students: 0, classrooms: 0, subjects: 0 }
      ),
    [schools]
  );

  if (isLoading) return <MasterDashboardSkeleton />;

  const activeSchools = schools.filter((school) => school.is_active).length;
  const schoolsWithoutAdmin = Math.max(
    schools.length -
      new Set(schoolAdmins.map((admin) => admin.school_id).filter((schoolId) => schoolId !== null))
        .size,
    0
  );

  return (
    <Container maxWidth="xl" sx={{ pb: { xs: 5, md: 7 } }}>
      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary' }}>
            สวัสดี {user?.first_name || user?.username || 'ผู้ดูแลระบบ'}
          </Typography>
          <Typography component="h1" variant="h3">
            ภาพรวมระบบ
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.75, color: 'text.secondary' }}>
            ติดตามโรงเรียน ผู้ดูแล และจำนวนผู้ใช้งานทั้งหมดจากที่เดียว
          </Typography>
        </Box>
        <Box sx={{ gap: 1, display: 'flex' }}>
          <Button
            component={RouterLink}
            href={paths.master.schoolAdmin.new}
            variant="outlined"
            startIcon={<RemixIcon icon="solar:user-plus-bold" />}
          >
            เพิ่มผู้ดูแล
          </Button>
          <Button
            component={RouterLink}
            href={paths.master.school.new}
            variant="contained"
            startIcon={<RemixIcon icon="mingcute:add-line" />}
          >
            เพิ่มโรงเรียน
          </Button>
        </Box>
      </Box>

      {isError && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                schoolsQuery.refetch();
                adminsQuery.refetch();
              }}
            >
              ลองอีกครั้ง
            </Button>
          }
          sx={{ mb: 3 }}
        >
          โหลดข้อมูลภาพรวมได้ไม่ครบถ้วน
        </Alert>
      )}

      <Card
        sx={{
          mb: 3,
          p: { xs: 2.5, md: 3.5 },
          color: 'common.white',
          overflow: 'hidden',
          position: 'relative',
          background: (theme) =>
            `linear-gradient(120deg, ${theme.vars.palette.grey[900]} 0%, ${theme.vars.palette.primary.darker} 100%)`,
          '&::after': {
            top: -140,
            right: -40,
            width: 320,
            height: 320,
            content: '""',
            borderRadius: '50%',
            position: 'absolute',
            bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.06),
          },
        }}
      >
        <Box
          sx={{
            zIndex: 1,
            gap: 3,
            display: 'grid',
            position: 'relative',
            alignItems: 'center',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 0.8fr) minmax(0, 1.2fr)' },
          }}
        >
          <Box>
            <Chip
              size="small"
              icon={<RemixIcon icon="solar:shield-check-bold" />}
              label="ศูนย์ควบคุมระบบ"
              sx={(theme) => ({
                mb: 2,
                color: 'common.white',
                bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.12),
                '& .MuiChip-icon': { color: 'inherit' },
              })}
            />
            <Typography variant="h4">{schools.length.toLocaleString('th-TH')} โรงเรียน</Typography>
            <Typography variant="body2" sx={{ mt: 0.75, opacity: 0.72 }}>
              เปิดใช้งาน {activeSchools.toLocaleString('th-TH')} แห่ง · ผู้ดูแล{' '}
              {schoolAdmins.length.toLocaleString('th-TH')} บัญชี
            </Typography>
          </Box>
          <Box
            sx={{
              gap: 1,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
            }}
          >
            {[
              { label: 'นักเรียน', value: totals.students },
              { label: 'ครูผู้สอน', value: totals.teachers },
              { label: 'ห้องเรียน', value: totals.classrooms },
              { label: 'รายวิชา', value: totals.subjects },
            ].map((item) => (
              <Box
                key={item.label}
                sx={{
                  p: 2,
                  borderRadius: 1.5,
                  bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.08),
                }}
              >
                <Typography variant="h5">{item.value.toLocaleString('th-TH')}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Card>

      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        }}
      >
        <SummaryCard
          icon="solar:home-angle-bold-duotone"
          label="โรงเรียนทั้งหมด"
          value={schools.length}
          helper={`${activeSchools} แห่งกำลังเปิดใช้งาน`}
          color="primary.main"
          bgcolor="primary.lighter"
          href={paths.master.school.root}
        />
        <SummaryCard
          icon="solar:users-group-rounded-bold-duotone"
          label="ผู้ดูแลโรงเรียน"
          value={schoolAdmins.length}
          helper="บัญชีผู้ดูแลในระบบ"
          color="success.dark"
          bgcolor="success.lighter"
          href={paths.master.schoolAdmin.root}
        />
        <SummaryCard
          icon="solar:danger-bold"
          label="รอจัดสรรผู้ดูแล"
          value={schoolsWithoutAdmin}
          helper={schoolsWithoutAdmin ? 'โรงเรียนที่ควรตรวจสอบ' : 'ทุกโรงเรียนมีผู้ดูแลแล้ว'}
          color={schoolsWithoutAdmin ? 'warning.dark' : 'success.dark'}
          bgcolor={schoolsWithoutAdmin ? 'warning.lighter' : 'success.lighter'}
          href={paths.master.schoolAdmin.new}
        />
      </Box>

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.45fr) minmax(300px, 0.65fr)' },
        }}
      >
        <Card variant="outlined">
          <Box
            sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Box>
              <Typography component="h2" variant="h6">
                โรงเรียนล่าสุด
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                ภาพรวมการใช้งานของแต่ละโรงเรียน
              </Typography>
            </Box>
            <Button component={RouterLink} href={paths.master.school.root} size="small">
              ดูทั้งหมด
            </Button>
          </Box>
          <Divider />
          {schools.slice(0, 5).map((school, index) => (
            <Box key={school.id}>
              <Box sx={{ gap: 1.5, px: 3, py: 2, display: 'flex', alignItems: 'center' }}>
                <Avatar
                  src={school.logo_url ?? undefined}
                  variant="rounded"
                  sx={{ bgcolor: 'primary.lighter', color: 'primary.main' }}
                >
                  {school.name.charAt(0)}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2" noWrap>
                    {school.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {school.studentCount.toLocaleString('th-TH')} นักเรียน ·{' '}
                    {school.teacherCount.toLocaleString('th-TH')} ครู
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  variant="soft"
                  color={school.is_active ? 'success' : 'default'}
                  label={school.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                />
              </Box>
              {index < Math.min(schools.length, 5) - 1 && <Divider />}
            </Box>
          ))}
          {!schools.length && (
            <Box sx={{ px: 3, py: 7, textAlign: 'center' }}>
              <RemixIcon icon="solar:inbox-in-bold" width={36} sx={{ color: 'text.disabled' }} />
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                ยังไม่มีโรงเรียนในระบบ
              </Typography>
            </Box>
          )}
        </Card>

        <Card variant="outlined" sx={{ p: 3 }}>
          <Typography component="h2" variant="h6">
            เริ่มต้นใช้งาน
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, mb: 2.5, color: 'text.secondary' }}>
            ขั้นตอนหลักสำหรับเพิ่มโรงเรียนใหม่เข้าสู่ระบบ
          </Typography>
          {[
            { label: 'สร้างข้อมูลโรงเรียน', icon: 'solar:home-angle-bold-duotone' as const },
            { label: 'สร้างบัญชีผู้ดูแล', icon: 'solar:user-plus-bold' as const },
            { label: 'ส่งข้อมูลเข้าสู่ระบบ', icon: 'solar:shield-check-bold' as const },
          ].map((item, index) => (
            <Box key={item.label} sx={{ gap: 1.5, mb: 2, display: 'flex', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  display: 'grid',
                  borderRadius: '50%',
                  placeItems: 'center',
                  color: 'primary.main',
                  bgcolor: 'primary.lighter',
                }}
              >
                <RemixIcon icon={item.icon} width={18} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2">{item.label}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  ขั้นตอนที่ {index + 1}
                </Typography>
              </Box>
            </Box>
          ))}
          <Button
            component={RouterLink}
            href={paths.master.school.new}
            fullWidth
            variant="contained"
            sx={{ mt: 1 }}
          >
            เพิ่มโรงเรียนใหม่
          </Button>
        </Card>
      </Box>
    </Container>
  );
}

type SummaryCardProps = {
  icon:
    | 'solar:home-angle-bold-duotone'
    | 'solar:users-group-rounded-bold-duotone'
    | 'solar:danger-bold';
  label: string;
  value: number;
  helper: string;
  color: string;
  bgcolor: string;
  href: string;
};

function SummaryCard({ icon, label, value, helper, color, bgcolor, href }: SummaryCardProps) {
  return (
    <Card
      component={RouterLink}
      href={href}
      variant="outlined"
      sx={{
        p: 2.5,
        gap: 2,
        display: 'flex',
        color: 'text.primary',
        alignItems: 'center',
        textDecoration: 'none',
        transition: 'transform 160ms ease, box-shadow 160ms ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (theme) => theme.vars.customShadows.z8,
        },
      }}
    >
      <Box
        sx={{
          width: 50,
          height: 50,
          flexShrink: 0,
          display: 'grid',
          borderRadius: 1.75,
          placeItems: 'center',
          color,
          bgcolor,
        }}
      >
        <RemixIcon icon={icon} width={26} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h4">{value.toLocaleString('th-TH')}</Typography>
        <Typography variant="subtitle2">{label}</Typography>
        <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary' }}>
          {helper}
        </Typography>
      </Box>
    </Card>
  );
}

function MasterDashboardSkeleton() {
  return (
    <Container maxWidth="xl" sx={{ pb: 7 }}>
      <Skeleton width={260} height={90} sx={{ mb: 3 }} />
      <Skeleton variant="rounded" height={190} sx={{ mb: 3 }} />
      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        }}
      >
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} variant="rounded" height={116} />
        ))}
      </Box>
      <Box
        sx={{ gap: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.45fr 0.65fr' } }}
      >
        <Skeleton variant="rounded" height={400} />
        <Skeleton variant="rounded" height={400} />
      </Box>
    </Container>
  );
}
