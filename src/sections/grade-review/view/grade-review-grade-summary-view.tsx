'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import { listGradeReviews } from '../grade-review-actions';

// ----------------------------------------------------------------------

export const UNASSIGNED_GRADE = '__unassigned__';

export function GradeReviewGradeSummaryView({
  gradeBasePath = paths.admin.gradeReviews,
}: {
  gradeBasePath?: string;
}) {
  const table = useTable({ defaultRowsPerPage: 10 });
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['grade-reviews'],
    queryFn: listGradeReviews,
  });

  const gradeGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        classrooms: Set<string>;
        subjects: number;
        draft: number;
        pending: number;
        revision: number;
        completed: number;
      }
    >();
    data.forEach((item) => {
      const key = item.classroom?.grade_level?.trim() || UNASSIGNED_GRADE;
      const group = groups.get(key) ?? {
        key,
        label: key === UNASSIGNED_GRADE ? 'ไม่ระบุชั้นปี' : key,
        classrooms: new Set<string>(),
        subjects: 0,
        draft: 0,
        pending: 0,
        revision: 0,
        completed: 0,
      };
      const status = item.review?.status ?? 'draft';
      if (item.classroom?.id) group.classrooms.add(item.classroom.id);
      group.subjects += 1;
      if (status === 'draft') group.draft += 1;
      if (status === 'submitted' || status === 'reviewed') group.pending += 1;
      if (status === 'revision') group.revision += 1;
      if (status === 'approved' || status === 'locked') group.completed += 1;
      groups.set(key, group);
    });
    return [...groups.values()].sort((left, right) =>
      left.label.localeCompare(right.label, 'th', { numeric: true, sensitivity: 'base' })
    );
  }, [data]);
  const visibleGradeGroups = useMemo(
    () => rowInPage(gradeGroups, table.page, table.rowsPerPage),
    [gradeGroups, table.page, table.rowsPerPage]
  );

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Box sx={{ mb: 4 }}>
        <Typography component="h1" variant="h3">
          ตรวจสอบผลการเรียนรายชั้นปี
        </Typography>
        <Typography sx={{ mt: 1, color: 'text.secondary' }}>
          เลือกชั้นปีเพื่อดูรายวิชา ห้องเรียน และตรวจผลการเรียนที่ครูส่งมา
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
          ไม่สามารถโหลดข้อมูลชั้นปีได้
        </Alert>
      )}

      <Card variant="outlined">
        <Box sx={{ p: 2.5 }}>
          <Typography variant="h6">ชั้นปีทั้งหมด</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {isLoading ? 'กำลังโหลด...' : `${gradeGroups.length} ชั้นปี`}
          </Typography>
        </Box>
        <TableContainer>
          <Table sx={{ minWidth: 950 }}>
            <TableHead>
              <TableRow>
                <TableCell>ชั้นปี</TableCell>
                <TableCell align="center">ห้องเรียน</TableCell>
                <TableCell align="center">รายวิชา</TableCell>
                <TableCell align="center">ยังไม่ส่ง</TableCell>
                <TableCell align="center">รอตรวจ</TableCell>
                <TableCell align="center">ส่งแก้ไข</TableCell>
                <TableCell>ความคืบหน้า</TableCell>
                <TableCell align="right">รายละเอียด</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                      <CircularProgress size={28} />
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !gradeGroups.length && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}>
                    ยังไม่มีข้อมูลรายวิชาในชั้นปี
                  </TableCell>
                </TableRow>
              )}
              {visibleGradeGroups.map((group) => {
                const percent = group.subjects
                  ? Math.round((group.completed / group.subjects) * 100)
                  : 0;
                return (
                  <TableRow key={group.key} hover>
                    <TableCell>
                      <Typography variant="subtitle1">{group.label}</Typography>
                    </TableCell>
                    <TableCell align="center">{group.classrooms.size}</TableCell>
                    <TableCell align="center">{group.subjects}</TableCell>
                    <TableCell align="center">{group.draft}</TableCell>
                    <TableCell align="center">{group.pending}</TableCell>
                    <TableCell align="center">{group.revision}</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption">ผ่าน {group.completed}/{group.subjects}</Typography>
                        <Typography variant="caption">{percent}%</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={percent}
                        color={percent === 100 ? 'success' : 'primary'}
                        sx={{ height: 7, borderRadius: 1 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        component={RouterLink}
                        href={`${gradeBasePath}/grade/${encodeURIComponent(group.key)}`}
                        variant="outlined"
                        size="small"
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
          count={gradeGroups.length}
          rowsPerPage={table.rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          onPageChange={table.onChangePage}
          onRowsPerPageChange={table.onChangeRowsPerPage}
          labelRowsPerPage="แสดงต่อหน้า"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
          getItemAriaLabel={(type) => {
            if (type === 'first') return 'หน้าแรก';
            if (type === 'last') return 'หน้าสุดท้าย';
            if (type === 'next') return 'หน้าถัดไป';
            return 'หน้าก่อนหน้า';
          }}
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
      </Card>
    </Container>
  );
}
