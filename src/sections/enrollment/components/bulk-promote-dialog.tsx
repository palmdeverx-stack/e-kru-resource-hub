'use client';

import type { Enrollment } from '../enrollment-actions';
import type { Classroom } from 'src/sections/classroom/classroom-actions';
import type { AcademicYear } from 'src/sections/academic-year/academic-year-actions';

import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { Box, Stack } from '@mui/material';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { RemixIcon } from 'src/components/remix-icon';

import { listClassrooms } from 'src/sections/classroom/classroom-actions';
import { listAcademicYears } from 'src/sections/academic-year/academic-year-actions';

import { listEnrollments, bulkPromoteEnrollments } from '../enrollment-actions';

// ----------------------------------------------------------------------

type RowOverride = { classroomId: string; excluded: boolean };

const EMPTY_ROSTER: Enrollment[] = [];
const EMPTY_CLASSROOMS: Classroom[] = [];
const EMPTY_ACADEMIC_YEARS: AcademicYear[] = [];

type Props = {
  open: boolean;
  onClose: () => void;
  initialClassroomId?: string;
};

export function BulkPromoteDialog({ open, onClose, initialClassroomId }: Props) {
  const queryClient = useQueryClient();
  const [sourceClassroomId, setSourceClassroomId] = useState('');
  const [targetAcademicYearId, setTargetAcademicYearId] = useState('');
  const [defaultClassroomId, setDefaultClassroomId] = useState('');
  const [rowOverrides, setRowOverrides] = useState<Record<string, RowOverride>>({});

  const mutation = useMutation({
    mutationFn: bulkPromoteEnrollments,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['enrollments'] }),
        queryClient.invalidateQueries({ queryKey: ['classrooms'] }),
      ]);
      handleClose();
    },
  });

  const { data: classrooms = EMPTY_CLASSROOMS } = useQuery({
    queryKey: ['classrooms'],
    queryFn: () => listClassrooms(),
    enabled: open,
  });
  const { data: academicYears = EMPTY_ACADEMIC_YEARS } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => listAcademicYears(),
    enabled: open,
  });
  const { data: roster = EMPTY_ROSTER, isLoading: rosterLoading } = useQuery({
    queryKey: ['enrollments', { classroomId: sourceClassroomId }],
    queryFn: () => listEnrollments({ classroomId: sourceClassroomId }),
    enabled: open && !!sourceClassroomId,
  });
  const { data: destinationClassrooms = EMPTY_CLASSROOMS } = useQuery({
    queryKey: ['classrooms', { academicYearId: targetAcademicYearId }],
    queryFn: () => listClassrooms({ academicYearId: targetAcademicYearId }),
    enabled: open && !!targetAcademicYearId,
  });

  useEffect(() => {
    if (open) setSourceClassroomId(initialClassroomId ?? '');
  }, [open, initialClassroomId]);

  const sourceClassroom = classrooms.find((room) => room.id === sourceClassroomId) ?? null;

  const targetYearOptions = useMemo(
    () => academicYears.filter((year) => year.id !== sourceClassroom?.academic_year_id),
    [academicYears, sourceClassroom]
  );

  const defaultClassroom =
    destinationClassrooms.find((room) => room.id === defaultClassroomId) ?? null;

  useEffect(() => {
    if (!defaultClassroomId) {
      setRowOverrides((current) => (Object.keys(current).length ? {} : current));
      return;
    }

    const next: Record<string, RowOverride> = {};
    roster.forEach((row) => {
      next[row.student.id] = { classroomId: defaultClassroomId, excluded: false };
    });
    setRowOverrides((current) => {
      const studentIds = Object.keys(next);
      const isUnchanged =
        studentIds.length === Object.keys(current).length &&
        studentIds.every(
          (studentId) =>
            current[studentId]?.classroomId === next[studentId].classroomId &&
            current[studentId]?.excluded === next[studentId].excluded
        );

      return isUnchanged ? current : next;
    });
  }, [defaultClassroomId, roster]);

  const updateRow = (studentId: string, patch: Partial<RowOverride>) => {
    setRowOverrides((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], ...patch },
    }));
  };

  const includedCount = Object.values(rowOverrides).filter(
    (override) => !override.excluded && override.classroomId
  ).length;

  const handleClose = () => {
    if (mutation.isPending) return;
    setSourceClassroomId('');
    setTargetAcademicYearId('');
    setDefaultClassroomId('');
    setRowOverrides({});
    mutation.reset();
    onClose();
  };

  const handleSubmit = () => {
    const entries = roster
      .filter((row) => rowOverrides[row.student.id] && !rowOverrides[row.student.id].excluded)
      .map((row) => ({
        studentId: row.student.id,
        classroomId: rowOverrides[row.student.id].classroomId,
        studentNumber: row.student_number ?? undefined,
      }));

    if (!sourceClassroomId || !entries.length) return;

    mutation.mutate({ sourceClassroomId, entries });
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Typography component="h2" variant="h6">
              เลื่อนชั้นยกชุด
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              เลือกห้องต้นทางและปีการศึกษาปลายทาง แล้วปรับห้องเรียนรายบุคคลได้ก่อนยืนยัน
            </Typography>
          </Box>
          <IconButton onClick={handleClose} disabled={mutation.isPending} aria-label="ปิดหน้าต่าง">
            <RemixIcon icon="mingcute:close-line" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack sx={{ py: 2 }}>
          {mutation.error && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {mutation.error.message}
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
            <Autocomplete
              options={classrooms}
              value={sourceClassroom}
              getOptionLabel={(option) =>
                option.academic_years?.year
                  ? `${option.name} · ${option.academic_years.year}`
                  : option.name
              }
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, value) => setSourceClassroomId(value?.id ?? '')}
              noOptionsText="ไม่พบห้องเรียน"
              renderInput={(params) => <TextField {...params} label="ห้องต้นทาง *" />}
            />
            <Autocomplete
              options={targetYearOptions}
              value={academicYears.find((year) => year.id === targetAcademicYearId) ?? null}
              getOptionLabel={(option) => option.year}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, value) => {
                setTargetAcademicYearId(value?.id ?? '');
                setDefaultClassroomId('');
              }}
              disabled={!sourceClassroomId}
              noOptionsText="ไม่พบปีการศึกษาปลายทาง"
              renderInput={(params) => <TextField {...params} label="ปีการศึกษาปลายทาง *" />}
            />
            <Autocomplete
              options={destinationClassrooms}
              value={defaultClassroom}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, value) => setDefaultClassroomId(value?.id ?? '')}
              disabled={!targetAcademicYearId}
              noOptionsText="ไม่พบห้องเรียนในปีการศึกษานี้"
              renderInput={(params) => <TextField {...params} label="ห้องปลายทางเริ่มต้น *" />}
            />
          </Box>

          {targetAcademicYearId && !destinationClassrooms.length && (
            <Alert severity="info" sx={{ mb: 2.5 }}>
              ยังไม่มีห้องเรียนในปีการศึกษานี้ กรุณาสร้างห้องเรียนก่อนเลื่อนชั้น
            </Alert>
          )}

          {sourceClassroomId && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                {rosterLoading
                  ? 'กำลังโหลดรายชื่อนักเรียน...'
                  : `นักเรียนในห้องต้นทาง (${roster.length} คน) · เลือกไป ${includedCount} คน`}
              </Typography>
              <TableContainer
                sx={{
                  maxHeight: 360,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>นักเรียน</TableCell>
                      <TableCell>เลขที่เดิม</TableCell>
                      <TableCell sx={{ minWidth: 220 }}>ห้องปลายทาง</TableCell>
                      <TableCell align="center">ยกเว้น</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!rosterLoading && !roster.length && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}
                        >
                          ห้องนี้ยังไม่มีนักเรียน
                        </TableCell>
                      </TableRow>
                    )}
                    {roster.map((row) => {
                      const studentName =
                        `${row.student.first_name ?? ''} ${row.student.last_name ?? ''}`.trim() ||
                        row.student.username;
                      const override = rowOverrides[row.student.id];
                      const rowClassroom =
                        destinationClassrooms.find((room) => room.id === override?.classroomId) ??
                        null;

                      return (
                        <TableRow key={row.id} hover>
                          <TableCell>
                            <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
                              <Avatar
                                sx={{
                                  width: 30,
                                  height: 30,
                                  bgcolor: 'primary.lighter',
                                  color: 'primary.main',
                                  typography: 'caption',
                                }}
                              >
                                {studentName.charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography variant="body2">{studentName}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{row.student_number ?? '-'}</TableCell>
                          <TableCell>
                            <Autocomplete
                              size="small"
                              options={destinationClassrooms}
                              value={rowClassroom}
                              disabled={!!override?.excluded || !destinationClassrooms.length}
                              getOptionLabel={(option) => option.name}
                              isOptionEqualToValue={(option, value) => option.id === value.id}
                              onChange={(_, value) =>
                                updateRow(row.student.id, { classroomId: value?.id ?? '' })
                              }
                              renderInput={(params) => (
                                <TextField {...params} placeholder="เลือกห้องเรียน" />
                              )}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox
                              checked={!!override?.excluded}
                              onChange={(event) =>
                                updateRow(row.student.id, { excluded: event.target.checked })
                              }
                              inputProps={{
                                'aria-label': `ยกเว้น ${studentName} จากการเลื่อนชั้น`,
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={handleClose} disabled={mutation.isPending}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!includedCount}
          loading={mutation.isPending}
        >
          ยืนยันเลื่อนชั้น ({includedCount} คน)
        </Button>
      </DialogActions>
    </Dialog>
  );
}
