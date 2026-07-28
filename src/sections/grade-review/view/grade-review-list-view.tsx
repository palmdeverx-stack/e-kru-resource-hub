'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
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

import { RemixIcon } from 'src/components/remix-icon';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import {
  listGradeReviews,
  type GradeReviewStatus,
} from '../grade-review-actions';

// ----------------------------------------------------------------------

const STATUS = {
  draft: { label: 'ยังไม่ส่ง', color: 'default' },
  submitted: { label: 'รอตรวจ', color: 'warning' },
  revision: { label: 'ส่งแก้ไข', color: 'error' },
  reviewed: { label: 'ตรวจแล้ว', color: 'info' },
  approved: { label: 'อนุมัติแล้ว', color: 'success' },
  locked: { label: 'ปิดผลการเรียน', color: 'success' },
} as const;

type FilterStatus = 'all' | GradeReviewStatus;
const UNASSIGNED_GRADE = '__unassigned__';

function fullName(person: { first_name: string | null; last_name: string | null } | null) {
  return `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim() || '-';
}

export function GradeReviewListView({
  gradeLevel,
  detailBasePath = paths.admin.gradeReviews,
  summaryPath = paths.admin.gradeReviews,
}: {
  gradeLevel: string;
  detailBasePath?: string;
  summaryPath?: string;
}) {
  const table = useTable({ defaultRowsPerPage: 10 });
  const [status, setStatus] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['grade-reviews'],
    queryFn: listGradeReviews,
  });

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    return data.filter((item) => {
      const itemStatus = item.review?.status ?? 'draft';
      const itemGrade = item.classroom?.grade_level?.trim() || UNASSIGNED_GRADE;
      if (itemGrade !== gradeLevel) return false;
      if (status !== 'all' && itemStatus !== status) return false;
      if (!keyword) return true;
      return [
        item.subject?.code,
        item.subject?.name,
        item.classroom?.grade_level,
        item.classroom?.name,
        item.semester?.name,
        item.classroom?.academic_year?.year,
        fullName(item.teacher),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword);
    });
  }, [data, gradeLevel, search, status]);

  const visible = useMemo(
    () => rowInPage(filtered, table.page, table.rowsPerPage),
    [filtered, table.page, table.rowsPerPage]
  );
  const gradeLabel = gradeLevel === UNASSIGNED_GRADE ? 'ไม่ระบุชั้นปี' : gradeLevel;

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Button
        component={RouterLink}
        href={summaryPath}
        color="inherit"
        startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        sx={{ mb: 2 }}
      >
        กลับหน้าชั้นปี
      </Button>
      <Box sx={{ mb: 4 }}>
        <Typography component="h1" variant="h3">
          ตรวจสอบผลการเรียน · {gradeLabel}
        </Typography>
        <Typography sx={{ mt: 1, color: 'text.secondary' }}>
          รับคะแนนจากครู ตรวจความครบถ้วน เทียบข้อมูล สพฐ. และรับรองก่อนปิดภาคเรียน
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
          ไม่สามารถโหลดรายการผลการเรียนได้
        </Alert>
      )}

      <Card variant="outlined">
        <Tabs
          value={status}
          variant="scrollable"
          scrollButtons="auto"
          onChange={(_, value: FilterStatus) => {
            setStatus(value);
            table.onResetPage();
          }}
          sx={{ px: 3, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Tab value="all" label="ทั้งหมด" />
          {(Object.keys(STATUS) as GradeReviewStatus[]).map((key) => (
            <Tab key={key} value={key} label={STATUS[key].label} />
          ))}
        </Tabs>

        <Box
          sx={{
            p: 2.5,
            gap: 2,
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="h6">รายวิชาในชั้น {gradeLabel}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {filtered.length} รายวิชา
            </Typography>
          </Box>
          <TextField
            size="small"
            value={search}
            placeholder="ค้นหาวิชา ห้องเรียน หรือครู"
            onChange={(event) => {
              setSearch(event.target.value);
              table.onResetPage();
            }}
            sx={{ width: { xs: 1, sm: 380 } }}
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
          <Table sx={{ minWidth: 1150 }}>
            <TableHead>
              <TableRow>
                <TableCell>รายวิชา</TableCell>
                <TableCell>ห้องเรียน</TableCell>
                <TableCell>ครูผู้สอน</TableCell>
                <TableCell>ปี/ภาคเรียน</TableCell>
                <TableCell>ความครบถ้วน</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}>
                      <CircularProgress size={28} />
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !filtered.length && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}>
                    ไม่พบรายการผลการเรียน
                  </TableCell>
                </TableRow>
              )}
              {visible.map((item) => {
                const itemStatus = item.review?.status ?? 'draft';
                const percent = item.expected_scores
                  ? Math.round((item.completed_scores / item.expected_scores) * 100)
                  : 0;
                return (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2">{item.subject?.name ?? '-'}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {item.subject?.code || 'ไม่มีรหัสวิชา'} · {item.total_full_score} คะแนน
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {item.classroom?.grade_level} {item.classroom?.name}
                      <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                        {item.student_count} คน
                      </Typography>
                    </TableCell>
                    <TableCell>{fullName(item.teacher)}</TableCell>
                    <TableCell>
                      {item.classroom?.academic_year?.year ?? '-'} / {item.semester?.name ?? '-'}
                    </TableCell>
                    <TableCell sx={{ minWidth: 170 }}>
                      <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption">
                          {item.completed_scores}/{item.expected_scores}
                        </Typography>
                        <Typography variant="caption">{percent}%</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(percent, 100)}
                        color={percent === 100 ? 'success' : 'warning'}
                        sx={{ height: 6, borderRadius: 1 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="soft"
                        color={STATUS[itemStatus].color}
                        label={STATUS[itemStatus].label}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        component={RouterLink}
                        href={`${detailBasePath}/${item.id}`}
                        size="small"
                        variant="outlined"
                        startIcon={<RemixIcon icon="solar:clipboard-check-bold" />}
                      >
                        ตรวจสอบ
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
