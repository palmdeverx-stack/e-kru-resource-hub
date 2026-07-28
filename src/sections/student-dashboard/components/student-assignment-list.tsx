'use client';

import type { StudentAssignmentItem } from '../student-dashboard-actions';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';

import { RemixIcon } from 'src/components/remix-icon';

import { StudentAssignmentCard } from './student-assignment-card';
import { EmptyCard, isSubmitted } from '../view/student-dashboard-shared';

// ----------------------------------------------------------------------

type Filter = 'all' | 'pending' | 'submitted' | 'overdue';
type Props = { assignments: StudentAssignmentItem[]; generatedAt: string };

export function StudentAssignmentList({ assignments, generatedAt }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const now = new Date(generatedAt).getTime();

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    return assignments.filter((assignment) => {
      const submitted = isSubmitted(assignment.status);
      const overdue =
        !!assignment.due_at && new Date(assignment.due_at).getTime() < now && !submitted;
      if (filter === 'submitted' && !submitted) return false;
      if (filter === 'pending' && submitted) return false;
      if (filter === 'overdue' && !overdue) return false;
      return (
        !keyword ||
        [assignment.title, assignment.subject.code, assignment.subject.name]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('th')
          .includes(keyword)
      );
    });
  }, [assignments, filter, now, search]);

  const visible = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const filters: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'pending', label: 'ยังไม่ส่ง' },
    { value: 'submitted', label: 'ส่งแล้ว' },
    { value: 'overdue', label: 'เลยกำหนด' },
  ];

  return (
    <>
      <Box
        sx={{
          gap: 1.5,
          mb: 2,
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {filters.map((option) => (
            <Chip
              clickable
              key={option.value}
              label={option.label}
              color={filter === option.value ? 'primary' : 'default'}
              variant={filter === option.value ? 'filled' : 'outlined'}
              onClick={() => {
                setFilter(option.value);
                setPage(0);
              }}
            />
          ))}
        </Stack>
        <TextField
          size="small"
          value={search}
          placeholder="ค้นหางานหรือรายวิชา"
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
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
          sx={{ width: { xs: 1, sm: 300 } }}
        />
      </Box>

      {visible.length ? (
        <Stack spacing={1.5}>
          {visible.map((assignment) => (
            <StudentAssignmentCard
              key={assignment.id}
              assignment={assignment}
              generatedAt={generatedAt}
            />
          ))}
        </Stack>
      ) : (
        <EmptyCard
          text={assignments.length ? 'ไม่พบงานตามตัวกรองที่เลือก' : 'ยังไม่มีงานที่ได้รับมอบหมาย'}
        />
      )}

      {/* {!!filtered.length && (
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="แสดงต่อหน้า"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
          onPageChange={(_event, value) => setPage(value)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          sx={{ mt: 1, borderTop: '1px solid', borderColor: 'divider' }}
        />
      )} */}
    </>
  );
}
