'use client';

import type { UserRow, StudentStatus } from '../user-actions';

import { useMemo, useState } from 'react';
import { usePopover } from 'minimal-shared/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
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

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Label } from 'src/components/label';
import { CustomPopover } from 'src/components/custom-popover';
import { RemixIcon, RiLineFill, RiLineLine } from 'src/components/remix-icon';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import { useAuthContext } from 'src/auth/hooks';

import { downloadStudentImportTemplate } from '../student-import-utils';
import { StudentImportDialog } from '../components/student-import-dialog';
import {
  listUsers,
  updateUserActive,
  deleteManagedUser,
  confirmStudentImport,
} from '../user-actions';

// ----------------------------------------------------------------------

const STUDENT_STATUS_META: Record<
  StudentStatus,
  { label: string; color: 'success' | 'info' | 'warning' | 'error' | 'default' }
> = {
  studying: { label: 'กำลังศึกษา', color: 'success' },
  graduated: { label: 'จบการศึกษา', color: 'info' },
  transferred: { label: 'ย้ายออก', color: 'warning' },
  withdrawn: { label: 'ลาออก', color: 'default' },
  dismissed: { label: 'ให้ออก', color: 'error' },
};

const STUDENT_STATUS_FILTERS: Array<{ value: StudentStatus | 'all'; label: string }> = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'studying', label: 'กำลังศึกษา' },
  { value: 'graduated', label: 'จบการศึกษา' },
  { value: 'transferred', label: 'ย้ายออก' },
  { value: 'withdrawn', label: 'ลาออก' },
  { value: 'dismissed', label: 'ให้ออก' },
];

export function StudentListView({
  basePath = paths.admin.student.root,
  view = 'combined',
}: {
  basePath?: string;
  view?: 'combined' | 'pending' | 'confirmed';
} = {}) {
  const newPath = `${basePath}/new`;
  const detailPath = (id: string) => `${basePath}/${id}`;
  const editPath = (id: string) => `${basePath}/${id}/edit`;
  const { user: currentUser } = useAuthContext();
  const canManageStudents = currentUser?.role === 'school_admin';
  const table = useTable({ defaultRowsPerPage: 10 });
  const rowMenu = usePopover();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [tab, setTab] = useState<'confirmed' | 'pending'>(
    view === 'pending' ? 'pending' : 'confirmed'
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StudentStatus | 'all'>('all');
  const [deletingStudent, setDeletingStudent] = useState<UserRow | null>(null);
  const [menuStudent, setMenuStudent] = useState<UserRow | null>(null);
  const queryClient = useQueryClient();

  const {
    data: students = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['users', 'student'],
    queryFn: () => listUsers('student'),
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateUserActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteManagedUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeletingStudent(null);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: confirmStudentImport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users', 'student'] }),
  });

  const pendingStudents = useMemo(
    () => students.filter((student) => !student.import_confirmed_at),
    [students]
  );
  const confirmedStudents = useMemo(
    () => students.filter((student) => !!student.import_confirmed_at),
    [students]
  );

  const filteredStudents = useMemo(() => {
    const source = tab === 'pending' ? pendingStudents : confirmedStudents;
    const byStatus =
      statusFilter === 'all'
        ? source
        : source.filter((student) => (student.student_status ?? 'studying') === statusFilter);
    const keyword = search.trim().toLocaleLowerCase('th');
    if (!keyword) return byStatus;

    return byStatus.filter((student) =>
      [
        student.student_code,
        student.username,
        student.email,
        student.first_name,
        student.last_name,
        student.first_name_en,
        student.last_name_en,
        student.nickname,
        student.national_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword)
    );
  }, [search, tab, statusFilter, pendingStudents, confirmedStudents]);

  const visibleStudents = useMemo(
    () => rowInPage(filteredStudents, table.page, table.rowsPerPage),
    [filteredStudents, table.page, table.rowsPerPage]
  );
  const isImportView = view === 'pending';
  const showImportActions = view !== 'confirmed';

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
            {isImportView ? 'นำเข้าข้อมูลนักเรียน' : 'ข้อมูลนักเรียน'}
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            {isImportView
              ? 'สร้างข้อมูลใหม่หรือนำเข้าจากไฟล์ Excel แล้วตรวจสอบก่อนยืนยัน'
              : 'ข้อมูลนักเรียนที่ผ่านการตรวจสอบและยืนยันแล้ว'}
          </Typography>
        </Box>
        {showImportActions && (
          <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap' }}>
            <Button
              color="inherit"
              onClick={downloadStudentImportTemplate}
              startIcon={<RemixIcon icon="solar:download-bold" />}
            >
              ดาวน์โหลด Template
            </Button>
            {canManageStudents && (
              <>
                <Button
                  variant="outlined"
                  onClick={() => setImportDialogOpen(true)}
                  startIcon={<RemixIcon icon="solar:upload-bold" />}
                >
                  นำเข้าจาก Excel
                </Button>
                <Button
                  variant="contained"
                  component={RouterLink}
                  href={newPath}
                  startIcon={<RemixIcon icon="solar:user-plus-bold" />}
                >
                  สร้างข้อมูลใหม่
                </Button>
              </>
            )}
          </Box>
        )}
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
          ไม่สามารถโหลดรายการนักเรียนได้
        </Alert>
      )}
      {activeMutation.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {activeMutation.error.message}
        </Alert>
      )}

      {confirmMutation.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {confirmMutation.error.message}
        </Alert>
      )}

      <Card variant="outlined">
        {view === 'combined' && (
          <Tabs
            value={tab}
            onChange={(_event, value) => {
              setTab(value);
              table.onResetPage();
            }}
            sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Tab
              value="confirmed"
              label={
                <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
                  ยืนยันสำเร็จ
                  <Chip size="small" label={confirmedStudents.length} />
                </Box>
              }
            />
            <Tab
              value="pending"
              label={
                <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
                  รอยืนยัน
                  {!!pendingStudents.length && (
                    <Chip size="small" color="warning" label={pendingStudents.length} />
                  )}
                </Box>
              }
            />
          </Tabs>
        )}
        <Box
          sx={{
            gap: 2,
            px: 3,
            py: 2.5,
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            borderBottom: '1px solid',
            borderColor: 'divider',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography component="h2" variant="h6">
              {tab === 'pending' ? 'นักเรียนรอยืนยันข้อมูล' : 'รายการนักเรียน'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {isLoading
                ? 'กำลังโหลด...'
                : tab === 'pending'
                  ? `${filteredStudents.length} บัญชี · ข้อมูลใหม่และไฟล์ Excel ที่ยังไม่ได้ตรวจสอบ`
                  : `${filteredStudents.length} บัญชี · ยืนยันข้อมูลแล้ว`}
            </Typography>
          </Box>
          <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
            {tab === 'pending' && !!filteredStudents.length && (
              <Button
                variant="contained"
                color="warning"
                size="small"
                loading={confirmMutation.isPending}
                onClick={() =>
                  confirmMutation.mutate(filteredStudents.map((student) => student.id))
                }
                startIcon={<RemixIcon icon="solar:check-circle-bold" />}
              >
                ยืนยันทั้งหมด ({filteredStudents.length})
              </Button>
            )}
            <TextField
              select
              size="small"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as StudentStatus | 'all');
                table.onResetPage();
              }}
              aria-label="กรองตามสถานะนักเรียน"
              sx={{ width: { xs: 1, sm: 170 } }}
            >
              {STUDENT_STATUS_FILTERS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
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
              placeholder="ค้นหารหัสนักเรียน ชื่อ หรือเลขประจำตัว"
              aria-label="ค้นหานักเรียน"
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
        </Box>

        <TableContainer>
          <Table sx={{ minWidth: 860 }}>
            <TableHead>
              <TableRow>
                <TableCell width={72}>รูป</TableCell>
                <TableCell>รหัสนักเรียน</TableCell>
                <TableCell>ชื่อ-นามสกุล</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="center">LINE</TableCell>
                <TableCell align="center">เข้าใช้งาน</TableCell>
                <TableCell align="right">การจัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7}>กำลังโหลด...</TableCell>
                </TableRow>
              )}
              {!isLoading && !filteredStudents.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                  >
                    ไม่พบนักเรียน
                  </TableCell>
                </TableRow>
              )}
              {visibleStudents.map((student) => (
                <TableRow key={student.id} hover>
                  <TableCell>
                    <Avatar
                      src={student.avatar_url ?? undefined}
                      alt={`${student.first_name ?? ''} ${student.last_name ?? ''}`.trim()}
                      sx={{
                        width: 42,
                        height: 42,
                        bgcolor: 'primary.lighter',
                        color: 'primary.darker',
                      }}
                    >
                      {(student.first_name ?? student.username).charAt(0).toUpperCase()}
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2">{student.student_code ?? '-'}</Typography>
                    {student.nickname && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        ชื่อเล่น {student.nickname}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="subtitle2"
                      component={RouterLink}
                      href={detailPath(student.id)}
                      sx={{
                        color: 'text.primary',
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {`${student.name_prefix ?? ''}${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() ||
                        '-'}
                    </Typography>
                    {(student.first_name_en || student.last_name_en) && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {`${student.first_name_en ?? ''} ${student.last_name_en ?? ''}`.trim()}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Label
                      variant="soft"
                      color={STUDENT_STATUS_META[student.student_status ?? 'studying'].color}
                    >
                      {STUDENT_STATUS_META[student.student_status ?? 'studying'].label}
                    </Label>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip
                      title={
                        student.line_guardian_count
                          ? `เชื่อมต่อ LINE แล้ว ${student.line_guardian_count} คน${
                              student.line_notifications_enabled_count
                                ? ` · เปิดแจ้งเตือน ${student.line_notifications_enabled_count} คน`
                                : ' · ปิดการแจ้งเตือนอยู่'
                            }`
                          : student.guardian_count
                            ? 'ผู้ปกครองยังไม่ได้เชื่อมต่อ LINE'
                            : 'ยังไม่มีข้อมูลผู้ปกครอง'
                      }
                    >
                      <Box
                        sx={{
                          gap: 0.75,
                          display: 'inline-flex',
                          alignItems: 'center',
                          color: student.line_guardian_count ? '#06C755' : 'text.disabled',
                        }}
                      >
                        {student.line_guardian_count ? (
                          <RiLineFill size={21} />
                        ) : (
                          <RiLineLine size={21} />
                        )}
                        <Typography
                          variant="caption"
                          sx={{ color: 'inherit', whiteSpace: 'nowrap' }}
                        >
                          {student.line_guardian_count
                            ? `${student.line_guardian_count} คน`
                            : 'ยังไม่เชื่อมต่อ'}
                        </Typography>
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip
                      title={
                        (student.student_status ?? 'studying') !== 'studying'
                          ? 'เปลี่ยนสถานะเป็น “กำลังศึกษา” ก่อนเปิดใช้งาน'
                          : student.is_active === false
                            ? 'เปิดใช้งานบัญชี'
                            : 'ปิดใช้งานบัญชี'
                      }
                    >
                      <Switch
                        size="small"
                        checked={student.is_active !== false}
                        disabled={
                          (student.student_status ?? 'studying') !== 'studying' ||
                          !canManageStudents ||
                          (activeMutation.isPending && activeMutation.variables?.id === student.id)
                        }
                        onChange={(event) =>
                          activeMutation.mutate({ id: student.id, isActive: event.target.checked })
                        }
                        inputProps={{ 'aria-label': `สถานะบัญชี ${student.username}` }}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(event) => {
                        setMenuStudent(student);
                        rowMenu.onOpen(event);
                      }}
                      aria-label={`ตัวเลือกเพิ่มเติมสำหรับ ${student.first_name ?? student.username}`}
                    >
                      <RemixIcon icon="eva:more-vertical-fill" width={20} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePaginationCustom
          page={table.page}
          count={filteredStudents.length}
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

      <CustomPopover open={rowMenu.open} anchorEl={rowMenu.anchorEl} onClose={rowMenu.onClose}>
        <MenuList>
          <MenuItem
            component={RouterLink}
            href={detailPath(menuStudent?.id ?? '')}
            onClick={rowMenu.onClose}
          >
            <RemixIcon icon="solar:eye-bold" width={18} />
            ดูข้อมูล
          </MenuItem>

          {canManageStudents && (
            <MenuItem
              component={RouterLink}
              href={editPath(menuStudent?.id ?? '')}
              onClick={rowMenu.onClose}
            >
              <RemixIcon icon="solar:pen-bold" width={18} />
              แก้ไข
            </MenuItem>
          )}

          {canManageStudents && tab === 'pending' && (
            <MenuItem
              disabled={confirmMutation.isPending}
              onClick={() => {
                if (menuStudent) confirmMutation.mutate([menuStudent.id]);
                rowMenu.onClose();
              }}
            >
              <RemixIcon icon="solar:check-circle-bold" width={18} />
              ยืนยันข้อมูล
            </MenuItem>
          )}

          {canManageStudents && (
            <>
              <Divider sx={{ borderStyle: 'dashed' }} />
              <MenuItem
                sx={{ color: 'error.main' }}
                onClick={() => {
                  if (menuStudent) {
                    deleteMutation.reset();
                    setDeletingStudent(menuStudent);
                  }
                  rowMenu.onClose();
                }}
              >
                <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
                ลบ
              </MenuItem>
            </>
          )}
        </MenuList>
      </CustomPopover>

      <StudentImportDialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} />

      <Dialog
        open={!!deletingStudent}
        onClose={() => !deleteMutation.isPending && setDeletingStudent(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการลบนักเรียน</DialogTitle>
        <DialogContent>
          {deleteMutation.error ? (
            <Alert severity="error">{deleteMutation.error.message}</Alert>
          ) : (
            <>
              <Typography>
                ต้องการลบบัญชี “{deletingStudent?.student_code ?? deletingStudent?.username}”
                ใช่หรือไม่?
              </Typography>
              <Alert severity="warning" sx={{ mt: 2 }}>
                การลงทะเบียน คะแนน การเข้าเรียน และข้อมูลผู้ปกครองที่เชื่อมโยงจะถูกลบตาม
                การดำเนินการนี้ย้อนกลับไม่ได้
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => setDeletingStudent(null)}
            disabled={deleteMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={deleteMutation.isPending}
            onClick={() => deletingStudent && deleteMutation.mutate(deletingStudent.id)}
          >
            ลบนักเรียน
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
