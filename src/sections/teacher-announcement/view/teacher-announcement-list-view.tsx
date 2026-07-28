'use client';

import type { TeacherAnnouncement } from '../teacher-announcement-actions';

import { useMemo, useState } from 'react';
import { usePopover } from 'minimal-shared/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';

import { RemixIcon } from 'src/components/remix-icon';
import { CustomPopover } from 'src/components/custom-popover';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import { TeacherAnnouncementFormDialog } from '../components/teacher-announcement-form-dialog';
import {
  getTeacherAnnouncements,
  deleteTeacherAnnouncement,
} from '../teacher-announcement-actions';

// ----------------------------------------------------------------------

const typeConfig = {
  general: { label: 'ทั่วไป', color: 'info' as const, icon: 'solar:bell-bing-bold' as const },
  holiday: {
    label: 'วันหยุด',
    color: 'success' as const,
    icon: 'solar:calendar-date-bold' as const,
  },
  exam: {
    label: 'วันสอบ',
    color: 'warning' as const,
    icon: 'solar:file-check-bold-duotone' as const,
  },
};

const priorityConfig = {
  normal: { label: 'ปกติ', color: 'default' as const },
  important: { label: 'สำคัญ', color: 'warning' as const },
  urgent: { label: 'เร่งด่วน', color: 'error' as const },
};

export function TeacherAnnouncementListView({ mode = 'teacher' }: { mode?: 'teacher' | 'admin' }) {
  const table = useTable({ defaultRowsPerPage: 10 });
  const rowMenu = usePopover();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TeacherAnnouncement['announcement_type']>(
    'all'
  );
  const [menuAnnouncement, setMenuAnnouncement] = useState<TeacherAnnouncement | null>(null);
  const [editing, setEditing] = useState<TeacherAnnouncement | null>(null);
  const [deleting, setDeleting] = useState<TeacherAnnouncement | null>(null);

  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['teacher-announcements'],
    queryFn: getTeacherAnnouncements,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteTeacherAnnouncement,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teacher-announcements'] });
      await queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      setDeleting(null);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (announcement: TeacherAnnouncement) => {
    setEditing(announcement);
    setDialogOpen(true);
  };
  const announcements = useMemo(() => data?.announcements ?? [], [data?.announcements]);
  const filteredAnnouncements = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    return announcements.filter((announcement) => {
      if (typeFilter !== 'all' && announcement.announcement_type !== typeFilter) return false;
      if (!keyword) return true;
      return [
        announcement.title,
        announcement.content,
        ...announcement.targets.map((target) => target.classroom?.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword);
    });
  }, [announcements, search, typeFilter]);
  const visibleAnnouncements = rowInPage(filteredAnnouncements, table.page, table.rowsPerPage);
  const urgentCount = announcements.filter((item) => item.priority === 'urgent').length;
  const activeCount = announcements.filter(
    (item) => !item.expires_at || new Date(item.expires_at).getTime() >= dataUpdatedAt
  ).length;

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            {mode === 'admin' ? 'ประกาศโรงเรียน' : 'ประกาศถึงนักเรียน'}
          </Typography>
          <Typography sx={{ mt: 0.5, color: 'text.secondary' }}>
            {mode === 'admin'
              ? 'ส่งข่าว วันหยุด และเหตุการณ์สำคัญถึงนักเรียนและ LINE ผู้ปกครอง'
              : 'แจ้งข่าว วันหยุด และวันสอบเฉพาะห้องที่คุณเป็นครูประจำชั้น'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={<RemixIcon icon="mingcute:add-line" />}
          onClick={openCreate}
        >
          สร้างประกาศ
        </Button>
      </Box>

      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          ไม่สามารถโหลดประกาศได้
        </Alert>
      )}
      {deleteMutation.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {deleteMutation.error.message}
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
          icon="solar:bell-bing-bold"
          label="ประกาศทั้งหมด"
          value={announcements.length}
          color="primary"
        />
        <SummaryCard
          icon="solar:check-circle-bold"
          label="กำลังเผยแพร่"
          value={activeCount}
          color="success"
        />
        <SummaryCard
          icon="solar:danger-triangle-bold"
          label="เร่งด่วน"
          value={urgentCount}
          color="error"
        />
      </Box>

      <Card variant="outlined">
        <Box
          sx={{
            gap: 2,
            px: 3,
            py: 2.5,
            display: 'flex',
            alignItems: { xs: 'stretch', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            borderBottom: '1px solid',
            borderColor: 'divider',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography component="h2" variant="h6">
              รายการประกาศ
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {isLoading ? 'กำลังโหลด...' : `${filteredAnnouncements.length} รายการ`}
            </Typography>
          </Box>
          <Box sx={{ gap: 1.5, display: 'flex', flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField
              select
              size="small"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(
                  event.target.value as 'all' | TeacherAnnouncement['announcement_type']
                );
                table.onResetPage();
              }}
              sx={{ minWidth: 160 }}
              aria-label="กรองประเภทประกาศ"
            >
              <MenuItem value="all">ทุกประเภท</MenuItem>
              {Object.entries(typeConfig).map(([value, item]) => (
                <MenuItem key={value} value={value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                table.onResetPage();
              }}
              placeholder="ค้นหาหัวข้อ รายละเอียด หรือห้องเรียน"
              sx={{ width: { xs: 1, sm: 320 } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <RemixIcon icon="solar:magnifer-linear" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
        </Box>

        <TableContainer>
          <Table sx={{ minWidth: 1080 }}>
            <TableHead>
              <TableRow>
                <TableCell>ประกาศ</TableCell>
                <TableCell>ประเภท / ความสำคัญ</TableCell>
                <TableCell>กลุ่มเป้าหมาย</TableCell>
                <TableCell>ช่วงกิจกรรม</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">การจัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6}>กำลังโหลด...</TableCell>
                </TableRow>
              )}
              {!isLoading && !filteredAnnouncements.length && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}
                  >
                    {announcements.length ? 'ไม่พบประกาศที่ตรงกับตัวกรอง' : 'ยังไม่มีประกาศ'}
                  </TableCell>
                </TableRow>
              )}
              {visibleAnnouncements.map((announcement) => {
                const type = typeConfig[announcement.announcement_type];
                const priority = priorityConfig[announcement.priority];
                const expired =
                  !!announcement.expires_at &&
                  new Date(announcement.expires_at).getTime() < dataUpdatedAt;
                return (
                  <TableRow key={announcement.id} hover>
                    <TableCell sx={{ maxWidth: 400 }}>
                      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
                        <Avatar
                          variant="rounded"
                          src={announcement.image_url ?? undefined}
                          sx={{
                            width: 48,
                            height: 48,
                            color: `${type.color}.main`,
                            bgcolor: `${type.color}.lighter`,
                          }}
                        >
                          <RemixIcon icon={type.icon} width={23} />
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" noWrap>
                            {announcement.title}
                          </Typography>
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{ display: 'block', color: 'text.secondary' }}
                          >
                            {announcement.content || 'ประกาศด้วยรูปภาพ'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                            เผยแพร่ {formatDate(announcement.published_at)}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ gap: 0.75, display: 'flex', flexWrap: 'wrap' }}>
                        <Chip size="small" label={type.label} color={type.color} variant="soft" />
                        <Chip
                          size="small"
                          label={priority.label}
                          color={priority.color}
                          variant="outlined"
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {announcement.targets
                          .slice(0, 2)
                          .map((target) => target.classroom?.name ?? 'ห้องเรียน')
                          .join(', ')}
                      </Typography>
                      {announcement.targets.length > 2 && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          และอีก {announcement.targets.length - 2} ห้อง
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {announcement.event_start || announcement.event_end ? (
                        <>
                          <Typography variant="body2">
                            {announcement.event_start
                              ? formatDate(announcement.event_start)
                              : 'ไม่ระบุ'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            ถึง{' '}
                            {announcement.event_end
                              ? formatDate(announcement.event_end)
                              : 'ไม่ระบุ'}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                          ไม่ระบุ
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="soft"
                        color={expired ? 'default' : 'success'}
                        label={expired ? 'สิ้นสุดแล้ว' : 'กำลังเผยแพร่'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          setMenuAnnouncement(announcement);
                          rowMenu.onOpen(event);
                        }}
                        aria-label={`ตัวเลือกเพิ่มเติมสำหรับ ${announcement.title}`}
                      >
                        <RemixIcon icon="eva:more-vertical-fill" width={20} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePaginationCustom
          page={table.page}
          count={filteredAnnouncements.length}
          rowsPerPage={table.rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          onPageChange={table.onChangePage}
          onRowsPerPageChange={table.onChangeRowsPerPage}
          labelRowsPerPage="แสดงต่อหน้า"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
      </Card>

      <CustomPopover open={rowMenu.open} anchorEl={rowMenu.anchorEl} onClose={rowMenu.onClose}>
        <MenuList>
          <MenuItem
            onClick={() => {
              if (menuAnnouncement) openEdit(menuAnnouncement);
              rowMenu.onClose();
            }}
          >
            <RemixIcon icon="solar:pen-bold" width={18} />
            แก้ไข
          </MenuItem>
          <Divider sx={{ borderStyle: 'dashed' }} />
          <MenuItem
            sx={{ color: 'error.main' }}
            onClick={() => {
              if (menuAnnouncement) setDeleting(menuAnnouncement);
              rowMenu.onClose();
            }}
          >
            <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
            ลบ
          </MenuItem>
        </MenuList>
      </CustomPopover>

      <TeacherAnnouncementFormDialog
        open={dialogOpen}
        announcement={editing}
        classrooms={data?.classrooms ?? []}
        mode={mode}
        onClose={() => setDialogOpen(false)}
      />

      <Dialog
        open={!!deleting}
        onClose={() => !deleteMutation.isPending && setDeleting(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>ยืนยันการลบประกาศ</DialogTitle>
        <DialogContent>
          <Typography>
            ต้องการลบ “{deleting?.title}” ใช่หรือไม่? นักเรียนจะไม่เห็นประกาศนี้อีก
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => setDeleting(null)}
            disabled={deleteMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={deleteMutation.isPending}
            onClick={() => deleting && deleteMutation.mutate(deleting.id)}
          >
            ลบประกาศ
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  color: 'primary' | 'success' | 'error';
}) {
  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            display: 'grid',
            flexShrink: 0,
            borderRadius: 1.5,
            color: `${color}.main`,
            placeItems: 'center',
            bgcolor: `${color}.lighter`,
          }}
        >
          <RemixIcon icon={icon} width={24} />
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
