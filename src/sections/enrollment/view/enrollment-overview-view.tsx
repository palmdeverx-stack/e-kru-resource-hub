'use client';

import type { RemixIconName } from 'src/components/remix-icon/icon-map';
import type { ClassroomTeacher } from 'src/sections/classroom/classroom-actions';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';

import { listClassrooms } from 'src/sections/classroom/classroom-actions';
import { listAcademicYears } from 'src/sections/academic-year/academic-year-actions';

import { useAuthContext } from 'src/auth/hooks';

import { listEnrollments } from '../enrollment-actions';
import { BulkPromoteDialog } from '../components/bulk-promote-dialog';

// ----------------------------------------------------------------------

export function EnrollmentOverviewView() {
  const { user } = useAuthContext();
  const isTeacher = user?.role === 'teacher';
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [currentAcademicYearId, setCurrentAcademicYearId] = useState('');
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);

  const {
    data: academicYears = [],
    isLoading: academicYearsLoading,
    isError: academicYearsError,
    refetch: refetchAcademicYears,
  } = useQuery({
    queryKey: ['academic-years'],
    queryFn: listAcademicYears,
  });

  useEffect(() => {
    if (!academicYears.length) {
      setCurrentAcademicYearId('');
      return;
    }

    const now = new Date();
    const currentYear = academicYears.find((item) => {
      if (!item.start_date || !item.end_date) return false;

      const startDate = new Date(`${item.start_date}T00:00:00`);
      const endDate = new Date(`${item.end_date}T23:59:59`);

      return startDate <= now && now <= endDate;
    });
    const gregorianYear = String(now.getFullYear());
    const buddhistYear = String(now.getFullYear() + 543);
    const matchingYear = academicYears.find(
      (item) => item.year === gregorianYear || item.year === buddhistYear
    );
    const defaultYear = currentYear ?? matchingYear ?? academicYears[0];

    setCurrentAcademicYearId(currentYear?.id ?? '');
    setAcademicYearId((current) =>
      current && academicYears.some((item) => item.id === current) ? current : defaultYear.id
    );
  }, [academicYears]);

  const {
    data: classrooms = [],
    isLoading: classroomsLoading,
    isError: classroomsError,
    refetch: refetchClassrooms,
  } = useQuery({
    queryKey: ['classrooms', { academicYearId }],
    queryFn: () => listClassrooms({ academicYearId }),
    enabled: !!academicYearId,
  });
  const {
    data: enrollments = [],
    isLoading: enrollmentsLoading,
    isError: enrollmentsError,
    refetch: refetchEnrollments,
  } = useQuery({
    queryKey: ['enrollments', { academicYearId }],
    queryFn: () => listEnrollments({ academicYearId }),
    enabled: !!academicYearId,
  });

  const classroomCounts = useMemo(() => {
    const counts = new Map<string, number>();
    enrollments.forEach((enrollment) => {
      counts.set(enrollment.classroom.id, (counts.get(enrollment.classroom.id) ?? 0) + 1);
    });
    return counts;
  }, [enrollments]);

  const groupedClassrooms = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    const visible = classrooms.filter((classroom) => {
      if (!keyword) return true;
      return [
        classroom.name,
        classroom.grade_level,
        classroom.academic_years?.year,
        ...classroom.homeroom_teachers.flatMap((teacher) => [
          teacher.username,
          teacher.first_name,
          teacher.last_name,
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword);
    });

    return visible.reduce<
      Array<{ academicYearId: string; year: string; classrooms: typeof classrooms }>
    >((groups, classroom) => {
      const existing = groups.find((group) => group.academicYearId === classroom.academic_year_id);
      if (existing) {
        existing.classrooms.push(classroom);
      } else {
        groups.push({
          academicYearId: classroom.academic_year_id,
          year: classroom.academic_years?.year ?? 'ไม่ระบุปีการศึกษา',
          classrooms: [classroom],
        });
      }
      return groups;
    }, []);
  }, [classrooms, search]);

  const isLoading =
    academicYearsLoading ||
    (!!academicYearId && (classroomsLoading || enrollmentsLoading));
  const isError = academicYearsError || classroomsError || enrollmentsError;
  const registeredStudents = new Set(enrollments.map((enrollment) => enrollment.student.id)).size;
  const emptyClassrooms = classrooms.filter(
    (classroom) => !classroomCounts.get(classroom.id)
  ).length;

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Box
        sx={{
          mb: 4,
          gap: 2,
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            ลงทะเบียนนักเรียน
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            เลือกชั้นเรียนเพื่อดูรายชื่อและเพิ่มนักเรียนเข้าห้อง
          </Typography>
        </Box>
        <Box
          sx={{
            gap: 1.5,
            width: { xs: 1, sm: 'auto' },
            display: 'flex',
            alignItems: 'center',
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <TextField
            select
            size="small"
            label="ปีการศึกษา"
            value={academicYearId}
            disabled={academicYearsLoading || !academicYears.length}
            onChange={(event) => {
              setAcademicYearId(event.target.value);
              setSearch('');
            }}
            sx={{ width: { xs: 1, sm: 190 } }}
          >
            {academicYears.map((academicYear) => (
              <MenuItem key={academicYear.id} value={academicYear.id}>
                ปีการศึกษา {academicYear.year}
                {academicYear.id === currentAcademicYearId ? ' (ปัจจุบัน)' : ''}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            disabled={!academicYearId}
            onClick={() => setPromoteDialogOpen(true)}
            startIcon={<RemixIcon icon="solar:double-alt-arrow-up-bold-duotone" />}
            sx={{ width: { xs: 1, sm: 'auto' }, whiteSpace: 'nowrap' }}
          >
            เลื่อนชั้นยกชุด
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
                refetchAcademicYears();
                refetchClassrooms();
                refetchEnrollments();
              }}
            >
              ลองอีกครั้ง
            </Button>
          }
          sx={{ mb: 3 }}
        >
          ไม่สามารถโหลดข้อมูลชั้นเรียนได้
        </Alert>
      )}

      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        }}
      >
        <SummaryCard
          icon="solar:users-group-rounded-bold"
          label="ชั้นเรียนทั้งหมด"
          value={classrooms.length}
          color="primary.main"
          bgcolor="primary.lighter"
        />
        <SummaryCard
          icon="solar:user-rounded-bold"
          label="นักเรียนที่ลงทะเบียน"
          value={registeredStudents}
          color="success.main"
          bgcolor="success.lighter"
        />
        <SummaryCard
          icon="solar:inbox-bold"
          label="ห้องที่ยังไม่มีนักเรียน"
          value={emptyClassrooms}
          color="warning.main"
          bgcolor="warning.lighter"
        />
      </Box>

      <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            mb: 3,
            gap: 2,
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography component="h2" variant="h6">
              ชั้นเรียน
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {isLoading ? 'กำลังโหลด...' : `พบ ${classrooms.length} ห้องเรียน`}
            </Typography>
          </Box>
          <TextField
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาชั้นเรียนหรือปีการศึกษา"
            aria-label="ค้นหาชั้นเรียน"
            sx={{ width: { xs: 1, sm: 320 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <RemixIcon icon="eva:search-fill" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        {!isLoading && !groupedClassrooms.length && (
          <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
            <RemixIcon icon="solar:users-group-rounded-bold-duotone" width={48} />
            <Typography sx={{ mt: 1 }}>
              {classrooms.length
                ? 'ไม่พบชั้นเรียนที่ค้นหา'
                : academicYears.length
                  ? 'ยังไม่มีชั้นเรียนในปีการศึกษานี้'
                  : 'ยังไม่มีปีการศึกษา'}
            </Typography>
          </Box>
        )}

        {groupedClassrooms.map((group) => (
          <Box key={group.academicYearId} sx={{ '&:not(:last-of-type)': { mb: 4 } }}>
            <Box sx={{ mb: 1.5, gap: 1, display: 'flex', alignItems: 'center' }}>
              <Typography variant="subtitle1">ปีการศึกษา {group.year}</Typography>
              <Label variant="soft" color="info">
                {group.classrooms.length} ห้อง
              </Label>
            </Box>
            <Box
              sx={{
                gap: 2,
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(3, minmax(0, 1fr))',
                },
              }}
            >
              {group.classrooms.map((classroom) => (
                <ClassroomCard
                  key={classroom.id}
                  name={classroom.name}
                  gradeLevel={classroom.grade_level}
                  teachers={classroom.homeroom_teachers}
                  studentCount={classroomCounts.get(classroom.id) ?? 0}
                  onClick={() =>
                    router.push(
                      isTeacher
                        ? paths.teacher.departmentEnrollment.classroom(classroom.id)
                        : paths.admin.enrollment.classroom(classroom.id)
                    )
                  }
                />
              ))}
            </Box>
          </Box>
        ))}
      </Card>

      <BulkPromoteDialog open={promoteDialogOpen} onClose={() => setPromoteDialogOpen(false)} />
    </Container>
  );
}

// ----------------------------------------------------------------------

type ClassroomCardProps = {
  name: string;
  gradeLevel: string | null;
  teachers: ClassroomTeacher[];
  studentCount: number;
  onClick: () => void;
};

function ClassroomCard({ name, gradeLevel, teachers, studentCount, onClick }: ClassroomCardProps) {
  const teacherNames = teachers.map(
    (teacher) =>
      `${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`.trim() || `@${teacher.username}`
  );

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        p: 2.5,
        display: 'block',
        cursor: 'pointer',
        textAlign: 'left',
        borderRadius: 2,
        alignItems: 'center',
        font: 'inherit',
        color: 'text.primary',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        transition: (theme) =>
          theme.transitions.create(['border-color', 'box-shadow', 'transform']),
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: 'primary.main',
          boxShadow: (theme) => theme.vars.customShadows.z8,
        },
      }}
    >
      <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            flexShrink: 0,
            display: 'grid',
            borderRadius: 1.75,
            color: 'primary.main',
            placeItems: 'center',
            bgcolor: 'primary.lighter',
          }}
        >
          <RemixIcon icon="solar:users-group-rounded-bold" width={27} />
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle1" noWrap>
            {name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {gradeLevel || 'ไม่ระบุระดับชั้น'}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h6">{studentCount}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            คน
          </Typography>
        </Box>
        <RemixIcon icon="eva:arrow-ios-forward-fill" width={18} sx={{ color: 'text.disabled' }} />
      </Box>

      <Box
        sx={{
          gap: 1.25,
          mt: 2,
          pt: 1.5,
          display: 'flex',
          alignItems: 'flex-start',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <RemixIcon
          icon="solar:user-id-bold"
          width={21}
          sx={{
            mt: 0.25,
            flexShrink: 0,
            color: teachers.length ? 'primary.main' : 'text.disabled',
          }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            ครูประจำชั้น
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: teachers.length ? 'text.primary' : 'warning.dark',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {teacherNames.length ? teacherNames.join(', ') : 'ยังไม่ได้กำหนดครูประจำชั้น'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

type SummaryCardProps = {
  icon: RemixIconName;
  label: string;
  value: number;
  color: string;
  bgcolor: string;
};

function SummaryCard({ icon, label, value, color, bgcolor }: SummaryCardProps) {
  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            display: 'grid',
            borderRadius: 1.5,
            color,
            placeItems: 'center',
            bgcolor,
          }}
        >
          <RemixIcon icon={icon} width={25} />
        </Box>
        <Box>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {label}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}
