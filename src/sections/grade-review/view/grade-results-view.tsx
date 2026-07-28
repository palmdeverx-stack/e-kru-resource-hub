'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDateTime } from 'src/utils/format-time';

import { RemixIcon } from 'src/components/remix-icon';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import { listGradeReviews } from '../grade-review-actions';

// ----------------------------------------------------------------------

type ClassroomGroup = {
  key: string;
  classroomId: string;
  semesterId: string;
  classroomName: string;
  gradeLevel: string | null;
  academicYear: string | null;
  semesterName: string;
  studentCount: number;
  subjectCount: number;
  approvedCount: number;
  lockedCount: number;
  latestApprovedAt: string | null;
};

export function GradeResultsView({
  detailBasePath = paths.admin.gradeResults,
}: {
  detailBasePath?: string;
}) {
  const table = useTable({ defaultRowsPerPage: 10 });
  const [academicYear, setAcademicYear] = useState('all');
  const [semester, setSemester] = useState('all');
  const [gradeLevel, setGradeLevel] = useState('all');
  const [search, setSearch] = useState('');
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['grade-reviews'],
    queryFn: listGradeReviews,
  });

  const classroomGroups = useMemo(() => {
    const groups = new Map<string, ClassroomGroup>();
    data.forEach((item) => {
      if (!item.classroom?.id || !item.semester?.id) return;
      const key = `${item.classroom.id}:${item.semester.id}`;
      const status = item.review?.status ?? 'draft';
      const approved = ['approved', 'locked'].includes(status);
      const current = groups.get(key) ?? {
        key,
        classroomId: item.classroom.id,
        semesterId: item.semester.id,
        classroomName: item.classroom.name,
        gradeLevel: item.classroom.grade_level,
        academicYear: item.classroom.academic_year?.year ?? null,
        semesterName: item.semester.name ?? '-',
        studentCount: item.student_count,
        subjectCount: 0,
        approvedCount: 0,
        lockedCount: 0,
        latestApprovedAt: null,
      };
      current.subjectCount += 1;
      current.studentCount = Math.max(current.studentCount, item.student_count);
      if (approved) current.approvedCount += 1;
      if (status === 'locked') current.lockedCount += 1;
      if (
        approved &&
        item.review?.approved_at &&
        (!current.latestApprovedAt || item.review.approved_at > current.latestApprovedAt)
      ) {
        current.latestApprovedAt = item.review.approved_at;
      }
      groups.set(key, current);
    });
    return [...groups.values()]
      .filter((group) => group.approvedCount > 0)
      .sort((left, right) => {
        const year = String(right.academicYear ?? '').localeCompare(
          String(left.academicYear ?? ''),
          'th',
          { numeric: true }
        );
        if (year) return year;
        const term = left.semesterName.localeCompare(right.semesterName, 'th', { numeric: true });
        if (term) return term;
        return `${left.gradeLevel ?? ''}${left.classroomName}`.localeCompare(
          `${right.gradeLevel ?? ''}${right.classroomName}`,
          'th',
          { numeric: true }
        );
      });
  }, [data]);

  const years = useMemo(
    () =>
      [...new Set(classroomGroups.flatMap((item) => (item.academicYear ? [item.academicYear] : [])))]
        .sort((a, b) => b.localeCompare(a, 'th', { numeric: true })),
    [classroomGroups]
  );
  const semesters = useMemo(
    () =>
      [...new Set(classroomGroups.map((item) => item.semesterName))].sort((a, b) =>
        a.localeCompare(b, 'th', { numeric: true })
      ),
    [classroomGroups]
  );
  const grades = useMemo(
    () =>
      [...new Set(classroomGroups.flatMap((item) => (item.gradeLevel ? [item.gradeLevel] : [])))]
        .sort((a, b) => a.localeCompare(b, 'th', { numeric: true })),
    [classroomGroups]
  );
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    return classroomGroups.filter((item) => {
      if (academicYear !== 'all' && item.academicYear !== academicYear) return false;
      if (semester !== 'all' && item.semesterName !== semester) return false;
      if (gradeLevel !== 'all' && item.gradeLevel !== gradeLevel) return false;
      if (!keyword) return true;
      return [item.gradeLevel, item.classroomName, item.academicYear, item.semesterName]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword);
    });
  }, [academicYear, classroomGroups, gradeLevel, search, semester]);
  const visible = useMemo(
    () => rowInPage(filtered, table.page, table.rowsPerPage),
    [filtered, table.page, table.rowsPerPage]
  );
  const resetPage = () => table.onResetPage();

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Box sx={{ mb: 4 }}>
        <Typography component="h1" variant="h3">
          ผลการเรียนรายชั้นเรียน
        </Typography>
        <Typography sx={{ mt: 1, color: 'text.secondary' }}>
          เลือกชั้นเรียนและภาคเรียนเพื่อดูผลรายวิชา ใบ ปพ.5 และการส่งให้ผู้ปกครอง
        </Typography>
      </Box>

      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
          sx={{ mb: 3 }}
        >
          ไม่สามารถโหลดประวัติผลการเรียนได้
        </Alert>
      )}

      <Card variant="outlined">
        <Box
          sx={{
            p: 2.5,
            gap: 1.5,
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: '180px 180px 180px minmax(260px, 1fr)',
            },
          }}
        >
          <TextField
            select
            size="small"
            label="ปีการศึกษา"
            value={academicYear}
            onChange={(event) => {
              setAcademicYear(event.target.value);
              resetPage();
            }}
          >
            <MenuItem value="all">ทุกปีการศึกษา</MenuItem>
            {years.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
          </TextField>
          <TextField
            select
            size="small"
            label="ภาคเรียน"
            value={semester}
            onChange={(event) => {
              setSemester(event.target.value);
              resetPage();
            }}
          >
            <MenuItem value="all">ทุกภาคเรียน</MenuItem>
            {semesters.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
          <TextField
            select
            size="small"
            label="ชั้นปี"
            value={gradeLevel}
            onChange={(event) => {
              setGradeLevel(event.target.value);
              resetPage();
            }}
          >
            <MenuItem value="all">ทุกชั้นปี</MenuItem>
            {grades.map((grade) => <MenuItem key={grade} value={grade}>{grade}</MenuItem>)}
          </TextField>
          <TextField
            size="small"
            value={search}
            placeholder="ค้นหาชั้นปีหรือห้องเรียน"
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
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

        <TableContainer>
          <Table sx={{ minWidth: 1000 }}>
            <TableHead>
              <TableRow>
                <TableCell>ปี/ภาคเรียน</TableCell>
                <TableCell>ชั้นปี/ห้องเรียน</TableCell>
                <TableCell align="center">นักเรียน</TableCell>
                <TableCell>รายวิชาที่อนุมัติ</TableCell>
                <TableCell>ความพร้อม</TableCell>
                <TableCell>อนุมัติล่าสุด</TableCell>
                <TableCell align="right">รายละเอียด</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                      <CircularProgress size={28} />
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !filtered.length && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}>
                    ยังไม่มีชั้นเรียนที่มีผลการเรียนผ่านการอนุมัติ
                  </TableCell>
                </TableRow>
              )}
              {visible.map((item) => {
                const percent = item.subjectCount
                  ? Math.round((item.approvedCount / item.subjectCount) * 100)
                  : 0;
                const ready = item.approvedCount === item.subjectCount;
                return (
                  <TableRow key={item.key} hover>
                    <TableCell>
                      {item.academicYear ?? '-'} / {item.semesterName}
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {item.gradeLevel ?? '-'} {item.classroomName}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{item.studentCount}</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption">
                          {item.approvedCount}/{item.subjectCount} วิชา
                        </Typography>
                        <Typography variant="caption">{percent}%</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={percent}
                        color={ready ? 'success' : 'warning'}
                        sx={{ height: 6, borderRadius: 1 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="soft"
                        color={ready ? 'success' : 'warning'}
                        label={ready ? 'พร้อมส่งผู้ปกครอง' : 'รออนุมัติให้ครบ'}
                      />
                    </TableCell>
                    <TableCell>
                      {item.latestApprovedAt
                        ? fDateTime(item.latestApprovedAt, 'DD/MM/YYYY HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        component={RouterLink}
                        href={`${detailBasePath}/classroom/${item.classroomId}/${item.semesterId}`}
                        size="small"
                        variant="outlined"
                        endIcon={<RemixIcon icon="eva:arrow-ios-forward-fill" />}
                      >
                        ดูรายวิชา
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePaginationCustom
          page={table.page}
          count={filtered.length}
          rowsPerPage={table.rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          onPageChange={table.onChangePage}
          onRowsPerPageChange={table.onChangeRowsPerPage}
          labelRowsPerPage="แสดงต่อหน้า"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
        />
      </Card>
    </Container>
  );
}
