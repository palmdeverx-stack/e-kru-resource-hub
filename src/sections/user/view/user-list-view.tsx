'use client';

import type { UserRow } from '../user-actions';

import { useMemo, useState } from 'react';
import { usePopover } from 'minimal-shared/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
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
import { RemixIcon } from 'src/components/remix-icon';
import { CustomPopover } from 'src/components/custom-popover';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import { listStaffMasterItems } from 'src/sections/staff-master/staff-master-actions';

import { useAuthContext } from 'src/auth/hooks';

import { STAFF_TYPES, EMPLOYMENT_STATUSES } from 'src/types/staff-employment';

import { listUsers, updateUserActive, deleteManagedUser } from '../user-actions';

// ----------------------------------------------------------------------

const ROLE_COLOR = {
  master_admin: 'error',
  school_admin: 'warning',
  teacher: 'info',
  student: 'default',
} as const;

const ROLE_LABEL = {
  master_admin: 'ผู้ดูแลระบบ',
  school_admin: 'ผู้ดูแลโรงเรียน',
  teacher: 'ครู',
  student: 'นักเรียน',
} as const;

const STAFF_TYPE_LABEL = Object.fromEntries(
  STAFF_TYPES.map((option) => [option.value, option.label])
) as Record<(typeof STAFF_TYPES)[number]['value'], string>;

const EMPLOYMENT_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  EMPLOYMENT_STATUSES.map((option) => [option.value, option.label])
);

const EMPLOYMENT_STATUS_COLOR: Record<
  string,
  'success' | 'info' | 'warning' | 'default' | 'error'
> = {
  active: 'success',
  study_leave: 'info',
  leave: 'warning',
  retired: 'default',
  terminated: 'error',
};

export function UserListView() {
  const { user: currentUser } = useAuthContext();
  const isTeacher = currentUser?.role === 'teacher';
  const canManageStaff = currentUser?.role === 'school_admin';
  const table = useTable({ defaultRowsPerPage: 10 });
  const rowMenu = usePopover();
  const [search, setSearch] = useState('');
  const [menuUser, setMenuUser] = useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const queryClient = useQueryClient();

  const {
    data: users = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['users', 'staff'],
    queryFn: () => listUsers('teacher'),
  });
  const masterItemsQuery = useQuery({
    queryKey: ['staff-master-items'],
    queryFn: listStaffMasterItems,
  });
  const staffTypeLabels = useMemo(
    () => ({
      ...STAFF_TYPE_LABEL,
      ...Object.fromEntries(
        (masterItemsQuery.data ?? [])
          .filter((item) => item.category === 'staff_type' && item.code)
          .map((item) => [item.code, item.name_en ? `${item.name}` : item.name])
      ),
    }),
    [masterItemsQuery.data]
  );
  const employmentStatusLabels = useMemo(
    () => ({
      ...EMPLOYMENT_STATUS_LABEL,
      ...Object.fromEntries(
        (masterItemsQuery.data ?? [])
          .filter((item) => item.category === 'employment_status' && item.code)
          .map((item) => [item.code, item.name_en ? `${item.name} ` : item.name])
      ),
    }),
    [masterItemsQuery.data]
  );

  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateUserActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteManagedUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeletingUser(null);
    },
  });

  const staffUsers = useMemo(() => users.filter((user) => user.role !== 'student'), [users]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    if (!keyword) return staffUsers;

    return staffUsers.filter((user) =>
      [
        user.username,
        user.email,
        user.first_name,
        user.last_name,
        user.first_name_en,
        user.last_name_en,
        user.position_title,
        user.academic_rank,
        user.staff_type ? staffTypeLabels[user.staff_type] : null,
        user.employment_status ? employmentStatusLabels[user.employment_status] : null,
        ROLE_LABEL[user.role],
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword)
    );
  }, [search, staffTypeLabels, employmentStatusLabels, staffUsers]);

  const visibleUsers = useMemo(
    () => rowInPage(filteredUsers, table.page, table.rowsPerPage),
    [filteredUsers, table.page, table.rowsPerPage]
  );

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
            ครู/บุคลากร
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            จัดการบัญชีบุคลากรและครูภายในโรงเรียน
          </Typography>
        </Box>
        {canManageStaff && (
          <Button
            component={RouterLink}
            href={paths.admin.user.new}
            variant="contained"
            startIcon={<RemixIcon icon="solar:user-plus-bold" />}
          >
            เพิ่มครู/บุคลากร
          </Button>
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
          ไม่สามารถโหลดรายการผู้ใช้งานได้
        </Alert>
      )}
      {activeMutation.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {activeMutation.error.message}
        </Alert>
      )}

      <Card variant="outlined">
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
              รายการครู/บุคลากร
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {isLoading ? 'กำลังโหลด...' : `${filteredUsers.length} บัญชี`}
            </Typography>
          </Box>
          <TextField
            size="medium"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              table.onResetPage();
            }}
            placeholder="ค้นหาชื่อ ผู้ใช้ หรืออีเมล"
            aria-label="ค้นหาผู้ใช้งาน"
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

        <TableContainer>
          <Table sx={{ minWidth: 920 }}>
            <TableHead>
              <TableRow>
                <TableCell>ชื่อ-นามสกุล</TableCell>
                <TableCell>ชื่อผู้ใช้งาน</TableCell>
                <TableCell>อีเมล</TableCell>
                <TableCell>ประเภทบุคลากร</TableCell>
                <TableCell>สถานะการทำงาน</TableCell>
                <TableCell align="center">LINE</TableCell>
                <TableCell align="center">เข้าใช้งาน</TableCell>
                <TableCell align="right">การจัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8}>กำลังโหลด...</TableCell>
                </TableRow>
              )}
              {!isLoading && !filteredUsers.length && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                  >
                    ไม่พบผู้ใช้งาน
                  </TableCell>
                </TableRow>
              )}
              {visibleUsers.map((user: UserRow) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">
                      {`${user.name_prefix ?? ''}${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() ||
                        '-'}
                    </Typography>
                    {(user.first_name_en || user.last_name_en) && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {`${user.first_name_en ?? ''} ${user.last_name_en ?? ''}`.trim()}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{user.username}</Typography>
                  </TableCell>
                  <TableCell>{user.email ?? '-'}</TableCell>
                  <TableCell>
                    {user.staff_type ? (
                      <>
                        <Typography variant="body2">
                          {staffTypeLabels[user.staff_type] ?? user.staff_type}
                        </Typography>
                        {(user.position_title || user.academic_rank) && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {[user.position_title].filter(Boolean).join(' · ')}
                          </Typography>
                        )}
                      </>
                    ) : (
                      <Label variant="soft" color={ROLE_COLOR[user.role]}>
                        {ROLE_LABEL[user.role]}
                      </Label>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.employment_status ? (
                      <Label
                        variant="soft"
                        color={EMPLOYMENT_STATUS_COLOR[user.employment_status] ?? 'default'}
                      >
                        {employmentStatusLabels[user.employment_status] ?? user.employment_status}
                      </Label>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {user.role === 'teacher' ? (
                      user.line_linked_at ? (
                        <Tooltip title={user.line_display_name ?? 'เชื่อม LINE แล้ว'}>
                          <Label variant="soft" color="success">
                            เชื่อมแล้ว
                          </Label>
                        </Tooltip>
                      ) : (
                        <Label variant="soft" color="default">
                          ยังไม่เชื่อม
                        </Label>
                      )
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip
                      title={user.is_active === false ? 'เปิดใช้งานบัญชี' : 'ปิดใช้งานบัญชี'}
                    >
                      <Switch
                        size="small"
                        checked={user.is_active !== false}
                        disabled={
                          !canManageStaff ||
                          (activeMutation.isPending && activeMutation.variables?.id === user.id)
                        }
                        onChange={(event) =>
                          activeMutation.mutate({ id: user.id, isActive: event.target.checked })
                        }
                        inputProps={{ 'aria-label': `สถานะบัญชี ${user.username}` }}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(event) => {
                        setMenuUser(user);
                        rowMenu.onOpen(event);
                      }}
                      aria-label={`ตัวเลือกเพิ่มเติมสำหรับ ${user.first_name ?? user.username}`}
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
          count={filteredUsers.length}
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
          {menuUser?.role === 'teacher' && (
            <MenuItem
              component={RouterLink}
              href={
                isTeacher
                  ? paths.teacher.departmentStaff.teaching(menuUser.id)
                  : paths.admin.user.teaching(menuUser.id)
              }
              onClick={rowMenu.onClose}
            >
              <RemixIcon icon="solar:notebook-bold-duotone" width={18} />
              ดูข้อมูลการสอน
            </MenuItem>
          )}

          {canManageStaff && (
            <MenuItem
              component={RouterLink}
              href={paths.admin.user.edit(menuUser?.id ?? '')}
              onClick={rowMenu.onClose}
            >
              <RemixIcon icon="solar:pen-bold" width={18} />
              แก้ไข
            </MenuItem>
          )}

          {canManageStaff && <Divider sx={{ borderStyle: 'dashed' }} />}
          {canManageStaff && (
            <MenuItem
              sx={{ color: 'error.main' }}
              onClick={() => {
                if (menuUser) {
                  deleteMutation.reset();
                  setDeletingUser(menuUser);
                }
                rowMenu.onClose();
              }}
            >
              <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
              ลบ
            </MenuItem>
          )}
        </MenuList>
      </CustomPopover>

      <Dialog
        open={!!deletingUser}
        onClose={() => !deleteMutation.isPending && setDeletingUser(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการลบบัญชี</DialogTitle>
        <DialogContent>
          {deleteMutation.error ? (
            <Alert severity="error">{deleteMutation.error.message}</Alert>
          ) : (
            <>
              <Typography>ต้องการลบบัญชี “{deletingUser?.username}” ใช่หรือไม่?</Typography>
              <Alert severity="warning" sx={{ mt: 2 }}>
                ข้อมูลการสอนที่เชื่อมโยงอาจถูกลบตาม การดำเนินการนี้ย้อนกลับไม่ได้
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => setDeletingUser(null)}
            disabled={deleteMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={deleteMutation.isPending}
            onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
          >
            ลบบัญชี
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
