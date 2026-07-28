'use client';

import type { TeacherAssignment } from '../teacher-assignment-actions';

import { varAlpha } from 'minimal-shared/utils';
import { useDebounce } from 'minimal-shared/hooks';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';

import { RemixIcon } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { TeacherAssignmentCard } from '../components/teacher-assignment-card';
import { TeacherAssignmentFormDialog } from '../components/teacher-assignment-form-dialog';
import {
  deleteTeacherAssignment,
  listTeacherAssignmentsPage,
  getTeacherAssignmentSummary,
} from '../teacher-assignment-actions';

// ----------------------------------------------------------------------

const PAGE_SIZE = 9;

const summaryItems = [
  {
    key: 'classes',
    label: 'ชั้นเรียนทั้งหมด',
    icon: 'solar:notebook-bold-duotone',
    color: 'success.main',
    bgcolor: 'success.lighter',
  },
  {
    key: 'subjects',
    label: 'รายวิชา',
    icon: 'solar:notes-bold-duotone',
    color: 'primary.main',
    bgcolor: 'primary.lighter',
  },
  {
    key: 'classrooms',
    label: 'ห้องเรียน',
    icon: 'solar:users-group-rounded-bold-duotone',
    color: 'warning.main',
    bgcolor: 'warning.lighter',
  },
  {
    key: 'semesters',
    label: 'ภาคเรียน',
    icon: 'solar:calendar-date-bold',
    color: 'secondary.dark',
    bgcolor: 'secondary.lighter',
  },
] as const;

export function TeacherAssignmentListView() {
  const { user } = useAuthContext();
  const isTeacher = user?.role === 'teacher';
  const canManageAssignments =
    user?.role === 'school_admin' || (user?.manage_permissions ?? []).includes('schedule.manage');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [classroomFilter, setClassroomFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<TeacherAssignment | null>(null);
  const [deletingRow, setDeletingRow] = useState<TeacherAssignment | null>(null);
  const queryClient = useQueryClient();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const detailPath = (id: string) =>
    isTeacher ? paths.teacher.assignmentDetail(id) : paths.admin.teacherAssignment.detail(id);

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: [
        'teacher-assignments',
        'list',
        user?.school_id,
        user?.id,
        classroomFilter,
        debouncedSearch,
      ],
      queryFn: ({ pageParam }) =>
        listTeacherAssignmentsPage({
          classroomId: classroomFilter || undefined,
          search: debouncedSearch || undefined,
          limit: PAGE_SIZE,
          offset: pageParam,
        }),
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) => {
        if (!lastPage.hasMore) return undefined;
        return allPages.reduce((total, page) => total + page.teacherAssignments.length, 0);
      },
      enabled: !!user?.school_id && !!user?.id,
    });

  const summaryQuery = useQuery({
    queryKey: ['teacher-assignments', 'summary', user?.school_id, user?.id],
    queryFn: getTeacherAssignmentSummary,
    enabled: !!user?.school_id && !!user?.id,
  });

  const rows = data?.pages.flatMap((page) => page.teacherAssignments) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const classroomOptions = summaryQuery.data?.classroomOptions ?? [];
  const summary = summaryQuery.data ?? { classes: 0, subjects: 0, classrooms: 0, semesters: 0 };

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const deleteMutation = useMutation({
    mutationFn: deleteTeacherAssignment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
      await queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      setDeletingRow(null);
    },
  });

  const openCreateDialog = () => {
    setEditingRow(null);
    setDialogOpen(true);
  };

  const openEditDialog = (row: TeacherAssignment) => {
    setEditingRow(row);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRow(null);
  };

  const hasFilters = Boolean(search || classroomFilter);

  const clearFilters = () => {
    setSearch('');
    setClassroomFilter('');
  };

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Card
        sx={{
          mb: 4,
          p: { xs: 2, sm: 3 },
          color: 'common.white',
          overflow: 'hidden',
          position: 'relative',
          background: (theme) =>
            `linear-gradient(135deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.main} 100%)`,
          '&::after': {
            width: 240,
            height: 240,
            content: '""',
            borderRadius: '50%',
            position: 'absolute',
            right: { xs: -150, sm: -80 },
            bottom: -150,
            backgroundColor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.08),
          },
        }}
      >
        <Box
          sx={{
            gap: 3,
            zIndex: 1,
            display: 'flex',
            position: 'relative',
            alignItems: { xs: 'flex-start', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography
              component="p"
              variant="overline"
              sx={{ mb: 0.5, opacity: 0.8, letterSpacing: 1.2 }}
            >
              พื้นที่จัดการชั้นเรียน
            </Typography>
            <Typography component="h1" variant="h3" sx={{ mb: 1 }}>
              {isTeacher ? 'รายวิชาที่รับผิดชอบ' : 'ครูประจำวิชา'}
            </Typography>
            <Typography
              sx={(theme) => ({
                maxWidth: 600,
                color: varAlpha(theme.vars.palette.common.whiteChannel, 0.76),
              })}
            >
              {isTeacher
                ? 'เลือกวิชาและห้องเรียน เพื่อสร้างงาน ตรวจสอบรายชื่อนักเรียน และบันทึกคะแนน'
                : 'จัดการครูผู้สอน รายวิชา และห้องเรียนที่ได้รับมอบหมาย'}
            </Typography>
          </Box>

          {canManageAssignments && (
            <Button
              variant="contained"
              onClick={openCreateDialog}
              startIcon={<RemixIcon icon="mingcute:add-line" />}
              sx={{
                flexShrink: 0,
                color: 'primary.darker',
                bgcolor: 'common.white',
                '&:hover': { bgcolor: 'grey.200' },
              }}
            >
              {isTeacher ? 'เพิ่มรายวิชาที่สอน' : 'เพิ่มครูประจำวิชา'}
            </Button>
          )}
        </Box>
      </Card>

      <Box
        sx={{
          mb: 4,
          gap: 2,
          display: { xs: 'none', sm: 'grid' },
          gridTemplateColumns: 'repeat(4, 1fr)',
        }}
      >
        {summaryItems.map((item) => (
          <Card key={item.key} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  display: 'grid',
                  borderRadius: 1.5,
                  placeItems: 'center',
                  color: item.color,
                  bgcolor: item.bgcolor,
                }}
              >
                <RemixIcon icon={item.icon} width={25} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h4" sx={{ lineHeight: 1.1 }}>
                  {summaryQuery.isLoading ? <Skeleton width={32} /> : summary[item.key]}
                </Typography>
                <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
                  {item.label}
                </Typography>
              </Box>
            </Box>
          </Card>
        ))}
      </Box>

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
          <Typography component="h2" variant="h5">
            วิชาของฉัน
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {isLoading ? 'กำลังโหลดข้อมูล...' : `พบ ${total} วิชา`}
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
            label="ระดับชั้น"
            value={classroomFilter}
            onChange={(event) => setClassroomFilter(event.target.value)}
            sx={{ width: { xs: 1, sm: 280 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <RemixIcon icon="solar:users-group-rounded-bold" width={20} />
                  </InputAdornment>
                ),
              },
            }}
          >
            <MenuItem value="">ทุกระดับชั้น</MenuItem>
            {classroomOptions.map((classroom) => (
              <MenuItem key={classroom.id} value={classroom.id}>
                {classroom.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหารายวิชา ห้องเรียน หรือภาคเรียน"
            aria-label="ค้นหาชั้นเรียน"
            sx={{ width: { xs: 1, sm: 360 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <RemixIcon icon="eva:search-fill" width={21} />
                  </InputAdornment>
                ),
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')} aria-label="ล้างคำค้นหา">
                      <RemixIcon icon="mingcute:close-line" width={19} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
          />
        </Box>
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
          ไม่สามารถโหลดข้อมูลชั้นเรียนได้ กรุณาลองใหม่อีกครั้ง
        </Alert>
      )}

      {isLoading ? (
        <Box
          aria-label="กำลังโหลดชั้นเรียน"
          sx={{
            gap: 2.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          }}
        >
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} variant="rounded" height={235} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            gap: 2.5,
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(3, 1fr)',
              lg: 'repeat(3, 1fr)',
              xl: 'repeat(4, 1fr)',
            },
          }}
        >
          {rows.map((row) => (
            <TeacherAssignmentCard
              key={row.id}
              row={row}
              detailPath={detailPath(row.id)}
              canEdit={canManageAssignments}
              onEdit={openEditDialog}
              onDelete={(target) => {
                deleteMutation.reset();
                setDeletingRow(target);
              }}
            />
          ))}
        </Box>
      )}

      {!isLoading && !isError && !!rows.length && (
        <Box ref={sentinelRef} sx={{ mt: 2.5 }}>
          {isFetchingNextPage && (
            <Box
              sx={{
                gap: 2.5,
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(3, 1fr)',
                  lg: 'repeat(3, 1fr)',
                  xl: 'repeat(4, 1fr)',
                },
              }}
            >
              {[0, 1].map((item) => (
                <Skeleton key={item} variant="rounded" height={235} sx={{ borderRadius: 2 }} />
              ))}
            </Box>
          )}
        </Box>
      )}

      {!isLoading && !isError && !rows.length && (
        <Card variant="outlined" sx={{ py: 7, px: 3, textAlign: 'center' }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              mx: 'auto',
              mb: 2.5,
              display: 'grid',
              borderRadius: '50%',
              color: 'text.secondary',
              placeItems: 'center',
              bgcolor: 'background.neutral',
            }}
          >
            <RemixIcon
              icon={hasFilters ? 'eva:search-fill' : 'solar:notebook-bold-duotone'}
              width={36}
            />
          </Box>
          <Typography variant="h6">
            {hasFilters ? 'ไม่พบชั้นเรียนที่ค้นหา' : 'ยังไม่มีชั้นเรียนที่ได้รับมอบหมาย'}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
            {hasFilters
              ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรองห้องเรียน เพื่อดูผลลัพธ์อื่น'
              : isTeacher
                ? 'เริ่มเพิ่มวิชา ห้องเรียน และภาคเรียนที่คุณรับผิดชอบ'
                : 'เมื่อได้รับมอบหมาย รายวิชาจะแสดงที่นี่'}
          </Typography>
          {hasFilters ? (
            <Button sx={{ mt: 2.5 }} onClick={clearFilters}>
              ล้างตัวกรอง
            </Button>
          ) : (
            isTeacher &&
            canManageAssignments && (
              <Button
                variant="contained"
                sx={{ mt: 2.5 }}
                onClick={openCreateDialog}
                startIcon={<RemixIcon icon="mingcute:add-line" />}
              >
                เพิ่มรายวิชาที่สอน
              </Button>
            )
          )}
        </Card>
      )}

      <TeacherAssignmentFormDialog
        open={dialogOpen}
        editingRow={editingRow}
        onClose={closeDialog}
      />

      <Dialog
        open={!!deletingRow}
        onClose={() => !deleteMutation.isPending && setDeletingRow(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการลบรายวิชาที่รับผิดชอบ</DialogTitle>
        <DialogContent>
          {deleteMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteMutation.error.message}
            </Alert>
          )}
          <Alert severity="warning" sx={{ mb: 2 }}>
            งาน คะแนน และตารางสอนที่อยู่ภายใต้รายการนี้จะถูกลบไปด้วย
          </Alert>
          <Typography variant="body2">
            ต้องการลบวิชา <strong>{deletingRow?.subject.name}</strong> ห้อง{' '}
            <strong>{deletingRow?.classroom.name}</strong> หรือไม่?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            disabled={deleteMutation.isPending}
            onClick={() => setDeletingRow(null)}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={deleteMutation.isPending}
            onClick={() => deletingRow && deleteMutation.mutate(deletingRow.id)}
          >
            ยืนยันการลบ
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
