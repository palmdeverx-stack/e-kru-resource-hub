'use client';

import type { UserRow, UpdateSchoolAdminParams } from 'src/sections/user/user-actions';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
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

import { RemixIcon } from 'src/components/remix-icon';

import { listSchools } from 'src/sections/school/school-actions';
import { listUsers, updateSchoolAdmin, deleteSchoolAdmin } from 'src/sections/user/user-actions';

// ----------------------------------------------------------------------

export function SchoolAdminListView() {
  const [search, setSearch] = useState('');
  const [editingAdmin, setEditingAdmin] = useState<UserRow | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<UpdateSchoolAdminParams>({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    schoolId: '',
  });
  const queryClient = useQueryClient();
  const {
    data: schoolAdmins = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['users', 'school_admin'],
    queryFn: () => listUsers('school_admin'),
  });
  const { data: schools = [] } = useQuery({ queryKey: ['schools'], queryFn: listSchools });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSchoolAdminParams }) =>
      updateSchoolAdmin(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users', 'school_admin'] });
      setEditingAdmin(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSchoolAdmin,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users', 'school_admin'] });
      setDeletingAdmin(null);
    },
  });

  const openEditDialog = (admin: UserRow) => {
    updateMutation.reset();
    setEditingAdmin(admin);
    setEditForm({
      firstName: admin.first_name ?? '',
      lastName: admin.last_name ?? '',
      username: admin.username,
      email: admin.email ?? '',
      password: '',
      schoolId: admin.school_id ?? '',
    });
  };

  const updateEditField = (field: keyof UpdateSchoolAdminParams, value: string) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const canSaveEdit =
    editForm.firstName.trim() &&
    editForm.lastName.trim() &&
    editForm.username.trim() &&
    editForm.schoolId &&
    (!editForm.password || editForm.password.length >= 6);

  const filteredAdmins = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    if (!keyword) return schoolAdmins;
    return schoolAdmins.filter((admin) =>
      [admin.username, admin.first_name, admin.last_name, admin.email, admin.school?.name]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword)
    );
  }, [schoolAdmins, search]);

  const coveredSchools = new Set(schoolAdmins.map((admin) => admin.school_id).filter(Boolean)).size;

  return (
    <Container maxWidth="xl" sx={{ pb: { xs: 5, md: 7 } }}>
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
            ผู้ดูแลโรงเรียน
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            จัดการบัญชีผู้ดูแลและโรงเรียนที่รับผิดชอบ
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          href={paths.master.schoolAdmin.new}
          variant="contained"
          startIcon={<RemixIcon icon="solar:user-plus-bold" />}
        >
          เพิ่มผู้ดูแลโรงเรียน
        </Button>
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
          ไม่สามารถโหลดรายการผู้ดูแลโรงเรียนได้
        </Alert>
      )}

      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        }}
      >
        <SummaryCard
          icon="solar:users-group-rounded-bold-duotone"
          label="บัญชีผู้ดูแลทั้งหมด"
          value={schoolAdmins.length}
          color="primary.main"
          bgcolor="primary.lighter"
        />
        <SummaryCard
          icon="solar:home-angle-bold-duotone"
          label="โรงเรียนที่มีผู้ดูแล"
          value={coveredSchools}
          color="success.dark"
          bgcolor="success.lighter"
        />
      </Box>

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
              รายชื่อผู้ดูแล
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {isLoading
                ? 'กำลังโหลด...'
                : `แสดง ${filteredAdmins.length} จาก ${schoolAdmins.length} บัญชี`}
            </Typography>
          </Box>
          <TextField
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาชื่อ ผู้ใช้ หรือโรงเรียน"
            aria-label="ค้นหาผู้ดูแลโรงเรียน"
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
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>ผู้ดูแล</TableCell>
                <TableCell>ชื่อผู้ใช้งาน</TableCell>
                <TableCell>อีเมล</TableCell>
                <TableCell>โรงเรียนที่รับผิดชอบ</TableCell>
                <TableCell>วันที่สร้าง</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}
                  >
                    กำลังโหลดข้อมูล...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !filteredAdmins.length && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 8, textAlign: 'center' }}>
                    <RemixIcon
                      icon="solar:inbox-in-bold"
                      width={36}
                      sx={{ color: 'text.disabled' }}
                    />
                    <Typography variant="subtitle2" sx={{ mt: 1 }}>
                      {search ? 'ไม่พบผู้ดูแลที่ค้นหา' : 'ยังไม่มีผู้ดูแลโรงเรียน'}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                      {search
                        ? 'ลองเปลี่ยนคำค้นหาอีกครั้ง'
                        : 'เพิ่มบัญชีผู้ดูแลเพื่อเชื่อมกับโรงเรียน'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {filteredAdmins.map((admin) => {
                const fullName =
                  `${admin.first_name ?? ''} ${admin.last_name ?? ''}`.trim() || admin.username;
                return (
                  <TableRow key={admin.id} hover>
                    <TableCell>
                      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
                        <Avatar
                          src={admin.avatar_url ?? undefined}
                          alt={fullName}
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: 'primary.lighter',
                            color: 'primary.main',
                          }}
                        >
                          {fullName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">{fullName}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            ผู้ดูแลโรงเรียน
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">@{admin.username}</Typography>
                    </TableCell>
                    <TableCell>
                      {admin.email ?? (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          ไม่ระบุ
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {admin.school?.name ? (
                        <Chip
                          size="small"
                          variant="soft"
                          color="primary"
                          label={admin.school.name}
                        />
                      ) : (
                        <Chip size="small" variant="outlined" label="ยังไม่ระบุโรงเรียน" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {new Intl.DateTimeFormat('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }).format(new Date(admin.created_at))}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Tooltip title="แก้ไขผู้ดูแล">
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(admin)}
                            aria-label={`แก้ไข ${fullName}`}
                          >
                            <RemixIcon icon="solar:pen-bold" width={18} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="ลบผู้ดูแล">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              deleteMutation.reset();
                              setDeletingAdmin(admin);
                            }}
                            aria-label={`ลบ ${fullName}`}
                          >
                            <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog
        open={!!editingAdmin}
        onClose={() => !updateMutation.isPending && setEditingAdmin(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>แก้ไขผู้ดูแลโรงเรียน</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ mb: 2.5, color: 'text.secondary' }}>
            แก้ไขข้อมูลบัญชี โรงเรียนที่รับผิดชอบ หรือกำหนดรหัสผ่านใหม่
          </Typography>
          {updateMutation.error && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {updateMutation.error.message}
            </Alert>
          )}
          <Box sx={{ gap: 2.5, display: 'flex', flexDirection: 'column' }}>
            <TextField
              select
              label="โรงเรียนที่รับผิดชอบ"
              value={editForm.schoolId}
              onChange={(event) => updateEditField('schoolId', event.target.value)}
              required
            >
              {schools.map((school) => (
                <MenuItem key={school.id} value={school.id}>
                  {school.name} · {school.code}
                </MenuItem>
              ))}
            </TextField>
            <Box
              sx={{
                gap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              }}
            >
              <TextField
                autoFocus
                label="ชื่อ"
                value={editForm.firstName}
                onChange={(event) => updateEditField('firstName', event.target.value)}
                required
              />
              <TextField
                label="นามสกุล"
                value={editForm.lastName}
                onChange={(event) => updateEditField('lastName', event.target.value)}
                required
              />
            </Box>
            <TextField
              label="ชื่อผู้ใช้งาน"
              value={editForm.username}
              onChange={(event) => updateEditField('username', event.target.value)}
              required
            />
            <TextField
              label="อีเมล"
              type="email"
              value={editForm.email ?? ''}
              onChange={(event) => updateEditField('email', event.target.value)}
            />
            <TextField
              label="รหัสผ่านใหม่ (ไม่บังคับ)"
              type="password"
              value={editForm.password ?? ''}
              onChange={(event) => updateEditField('password', event.target.value)}
              helperText="เว้นว่างไว้หากไม่ต้องการเปลี่ยน อย่างน้อย 6 ตัวอักษร"
              error={!!editForm.password && editForm.password.length < 6}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => setEditingAdmin(null)}
            disabled={updateMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            loading={updateMutation.isPending}
            disabled={!canSaveEdit}
            onClick={() =>
              editingAdmin &&
              updateMutation.mutate({
                id: editingAdmin.id,
                data: {
                  ...editForm,
                  firstName: editForm.firstName.trim(),
                  lastName: editForm.lastName.trim(),
                  username: editForm.username.trim(),
                  email: editForm.email?.trim() || undefined,
                  password: editForm.password || undefined,
                },
              })
            }
          >
            บันทึกการแก้ไข
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!deletingAdmin}
        onClose={() => !deleteMutation.isPending && setDeletingAdmin(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการลบผู้ดูแล</DialogTitle>
        <DialogContent>
          {deleteMutation.error ? (
            <Alert severity="error">{deleteMutation.error.message}</Alert>
          ) : (
            <>
              <Typography>
                ต้องการลบบัญชี “{deletingAdmin?.username}” ออกจากระบบใช่หรือไม่?
              </Typography>
              <Alert severity="warning" sx={{ mt: 2 }}>
                ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้อีก และการดำเนินการนี้ย้อนกลับไม่ได้
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => setDeletingAdmin(null)}
            disabled={deleteMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={deleteMutation.isPending}
            onClick={() => deletingAdmin && deleteMutation.mutate(deletingAdmin.id)}
          >
            ลบบัญชี
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
  bgcolor,
}: {
  icon: 'solar:users-group-rounded-bold-duotone' | 'solar:home-angle-bold-duotone';
  label: string;
  value: number;
  color: string;
  bgcolor: string;
}) {
  return (
    <Card variant="outlined" sx={{ p: 2.5, gap: 1.75, display: 'flex', alignItems: 'center' }}>
      <Box
        sx={{
          width: 46,
          height: 46,
          display: 'grid',
          borderRadius: 1.5,
          placeItems: 'center',
          color,
          bgcolor,
        }}
      >
        <RemixIcon icon={icon} width={24} />
      </Box>
      <Box>
        <Typography variant="h4">{value.toLocaleString('th-TH')}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
      </Box>
    </Card>
  );
}
