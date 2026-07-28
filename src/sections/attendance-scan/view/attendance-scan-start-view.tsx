'use client';

import type { AttendanceScanSessionType } from '../attendance-scan-actions';

import dayjs from 'dayjs';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { RemixIcon } from 'src/components/remix-icon';

import { getMyHomeroomStudents } from 'src/sections/teacher-students/teacher-students-actions';
import { listTeacherAssignments } from 'src/sections/teacher-assignment/teacher-assignment-actions';

import { useAuthContext } from 'src/auth/hooks';

import { createAttendanceScanSession } from '../attendance-scan-actions';

// ----------------------------------------------------------------------

const SESSION_OPTIONS: Array<{
  value: AttendanceScanSessionType;
  title: string;
  description: string;
  icon:
    | 'solar:calendar-date-bold'
    | 'solar:notebook-bold-duotone'
    | 'solar:cloudy-moon-bold-duotone';
}> = [
  {
    value: 'homeroom_morning',
    title: 'เข้าแถวตอนเช้า',
    description: 'บันทึกนักเรียนในชั้นที่คุณเป็นครูประจำชั้น',
    icon: 'solar:calendar-date-bold',
  },
  {
    value: 'class_period',
    title: 'เข้าเรียนรายคาบ',
    description: 'เลือกวิชา ห้องเรียน และระบุชื่อคาบก่อนสแกน',
    icon: 'solar:notebook-bold-duotone',
  },
  {
    value: 'homeroom_evening',
    title: 'เข้าแถวตอนเย็น',
    description: 'บันทึกการเข้าแถวหรือกลับบ้านช่วงเย็น',
    icon: 'solar:cloudy-moon-bold-duotone',
  },
];

export function AttendanceScanStartView() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [sessionType, setSessionType] = useState<AttendanceScanSessionType>('homeroom_morning');
  const [sessionDate, setSessionDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [classroomId, setClassroomId] = useState('');
  const [teacherAssignmentId, setTeacherAssignmentId] = useState('');
  const [periodLabel, setPeriodLabel] = useState('คาบที่ 1');
  const [lateAfterMinutes, setLateAfterMinutes] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(60);

  const homeroomQuery = useQuery({
    queryKey: ['teacher-homeroom-students', user?.school_id, user?.id],
    queryFn: getMyHomeroomStudents,
    enabled: !!user?.school_id && !!user?.id,
  });
  const assignmentsQuery = useQuery({
    queryKey: ['teacher-assignments', user?.school_id, user?.id],
    queryFn: listTeacherAssignments,
    enabled: !!user?.school_id && !!user?.id,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAttendanceScanSession({
        sessionType,
        sessionDate,
        classroomId: sessionType === 'class_period' ? undefined : classroomId,
        teacherAssignmentId: sessionType === 'class_period' ? teacherAssignmentId : undefined,
        periodLabel: sessionType === 'class_period' ? periodLabel : undefined,
        durationMinutes,
        lateAfterMinutes,
      }),
    onSuccess: (sessionId) => router.push(paths.teacher.attendanceScanSession(sessionId)),
  });

  const canCreate =
    (sessionType === 'class_period'
      ? !!teacherAssignmentId && !!periodLabel.trim()
      : !!classroomId) &&
    durationMinutes >= 5 &&
    lateAfterMinutes >= 0 &&
    lateAfterMinutes <= durationMinutes;

  return (
    <Container maxWidth={false} sx={{ px: { xs: 1.5, sm: 3 }, pb: { xs: 3, sm: 5 } }}>
      <Box sx={{ mb: { xs: 2, sm: 4 } }}>
        <Typography
          component="h1"
          variant="h3"
          sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' } }}
        >
          สแกน QR เช็คชื่อ
        </Typography>
        <Typography variant="body2" sx={{ mt: { xs: 0.25, sm: 1 }, color: 'text.secondary' }}>
          เลือกว่ากำลังเช็คชื่ออะไร จากนั้นใช้ QR ประจำตัวนักเรียนอันเดิมสแกนได้ทันที
        </Typography>
      </Box>

      <Box
        sx={{
          gap: { xs: 0.75, sm: 2 },
          mb: { xs: 2, sm: 3 },
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(3, minmax(0, 1fr))',
            sm: '1fr',
            md: 'repeat(3, minmax(0, 1fr))',
          },
        }}
      >
        {SESSION_OPTIONS.map((option) => {
          const selected = option.value === sessionType;
          return (
            <Box
              key={option.value}
              component="button"
              type="button"
              onClick={() => {
                setSessionType(option.value);
                createMutation.reset();
              }}
              sx={{
                p: { xs: 0.75, sm: 2.5 },
                gap: { xs: 0.5, sm: 1.5 },
                display: 'flex',
                cursor: 'pointer',
                borderRadius: 2,
                textAlign: { xs: 'center', sm: 'left' },
                font: 'inherit',
                alignItems: { xs: 'center', sm: 'flex-start' },
                flexDirection: { xs: 'column', sm: 'row' },
                color: 'text.primary',
                bgcolor: selected ? 'primary.lighter' : 'background.paper',
                border: '1px solid',
                borderColor: selected ? 'primary.main' : 'divider',
              }}
            >
              <Box
                sx={{
                  width: { xs: 34, sm: 44 },
                  height: { xs: 34, sm: 44 },
                  display: 'grid',
                  flexShrink: 0,
                  borderRadius: 1.5,
                  color: selected ? 'common.white' : 'primary.main',
                  placeItems: 'center',
                  bgcolor: selected ? 'primary.main' : 'primary.lighter',
                }}
              >
                <RemixIcon icon={option.icon} width={21} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="subtitle1"
                  sx={{ fontSize: { xs: '0.7rem', sm: '1rem' }, lineHeight: { xs: 1.2, sm: 1.5 } }}
                >
                  {option.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.25, display: { xs: 'none', sm: 'block' }, color: 'text.secondary' }}
                >
                  {option.description}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {createMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {createMutation.error.message}
        </Alert>
      )}

      <Card
        variant="outlined"
        sx={{ p: { xs: 1.25, sm: 2.5, md: 3 }, borderRadius: { xs: 2, sm: 1 } }}
      >
        <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}>
          ตั้งค่ารอบเช็คชื่อ
        </Typography>
        <Box
          sx={{
            gap: { xs: 1.25, sm: 2 },
            mt: { xs: 1.25, sm: 2.5 },
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          }}
        >
          <DatePicker
            label="วันที่"
            value={dayjs(sessionDate)}
            onChange={(value) => {
              if (value?.isValid()) setSessionDate(value.format('YYYY-MM-DD'));
            }}
            format="DD/MM/YYYY"
            slotProps={{ textField: { size: 'small' } }}
            sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
          />

          {sessionType === 'class_period' ? (
            <TextField
              select
              size="small"
              label="วิชาและห้องเรียน"
              value={teacherAssignmentId}
              onChange={(event) => setTeacherAssignmentId(event.target.value)}
              sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
            >
              {(assignmentsQuery.data ?? []).map((assignment) => (
                <MenuItem key={assignment.id} value={assignment.id}>
                  {assignment.subject.code ? `${assignment.subject.code} · ` : ''}
                  {assignment.subject.name} · {assignment.classroom.name}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              select
              size="small"
              label="ชั้นเรียน"
              value={classroomId}
              onChange={(event) => setClassroomId(event.target.value)}
              sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
            >
              {(homeroomQuery.data?.classrooms ?? []).map((classroom) => (
                <MenuItem key={classroom.id} value={classroom.id}>
                  {classroom.name} · ปี {classroom.academic_years?.year ?? '-'}
                </MenuItem>
              ))}
            </TextField>
          )}

          {sessionType === 'class_period' && (
            <TextField
              size="small"
              label="ชื่อคาบ"
              value={periodLabel}
              onChange={(event) => setPeriodLabel(event.target.value)}
              placeholder="เช่น คาบที่ 1"
              slotProps={{ htmlInput: { maxLength: 100 } }}
              sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
            />
          )}
          <TextField
            size="small"
            type="number"
            label="นับว่าสายหลัง (นาที)"
            value={lateAfterMinutes}
            onChange={(event) => setLateAfterMinutes(Number(event.target.value))}
            slotProps={{ htmlInput: { min: 0, max: durationMinutes } }}
          />
          <TextField
            size="small"
            type="number"
            label="ระยะเวลาสแกน (นาที)"
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
            slotProps={{ htmlInput: { min: 5, max: 480 } }}
          />
        </Box>

        <Box sx={{ mt: { xs: 1.5, sm: 3 }, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="large"
            variant="contained"
            disabled={!canCreate}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            startIcon={<RemixIcon icon="solar:camera-add-bold" />}
            sx={{ width: { xs: 1, sm: 'auto' }, minHeight: { xs: 48, sm: 42 } }}
          >
            เปิดกล้องสแกน
          </Button>
        </Box>
      </Card>
    </Container>
  );
}
