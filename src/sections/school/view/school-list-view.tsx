'use client';

import type { School } from '../school-actions';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
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

import { listSchools, deleteSchool, updateSchool, toggleSchoolActive } from '../school-actions';

// ----------------------------------------------------------------------

export function SchoolListView() {
  const [search, setSearch] = useState('');
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [deletingSchool, setDeletingSchool] = useState<School | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editCode, setEditCode] = useState('');
  const queryClient = useQueryClient();

  const {
    data: schools = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['schools'], queryFn: listSchools });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleSchoolActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schools'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      name,
      nameEn,
      code,
    }: {
      id: string;
      name: string;
      nameEn?: string;
      code: string;
    }) => updateSchool(id, { name, nameEn, code }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schools'] });
      setEditingSchool(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSchool,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schools'] });
      setDeletingSchool(null);
    },
  });

  const openEditDialog = (school: School) => {
    updateMutation.reset();
    setEditingSchool(school);
    setEditName(school.name);
    setEditNameEn(school.name_en ?? '');
    setEditCode(school.code);
  };

  const saveSchool = () => {
    if (!editingSchool || !editName.trim() || !/^\d{8}$/.test(editCode.trim())) return;
    updateMutation.mutate({
      id: editingSchool.id,
      name: editName.trim(),
      nameEn: editNameEn.trim(),
      code: editCode.trim(),
    });
  };

  const filteredSchools = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    if (!keyword) return schools;
    return schools.filter((school) =>
      `${school.name} ${school.name_en ?? ''} ${school.code}`
        .toLocaleLowerCase('th')
        .includes(keyword)
    );
  }, [schools, search]);

  const activeCount = schools.filter((school) => school.is_active).length;
  const totalStudents = schools.reduce((sum, school) => sum + school.studentCount, 0);
  const totalTeachers = schools.reduce((sum, school) => sum + school.teacherCount, 0);

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
            จัดการโรงเรียน
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            ดูข้อมูลการใช้งานและควบคุมสถานะโรงเรียนทั้งหมด
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          href={paths.master.school.new}
          variant="contained"
          startIcon={<RemixIcon icon="mingcute:add-line" />}
        >
          เพิ่มโรงเรียน
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
          ไม่สามารถโหลดรายการโรงเรียนได้
        </Alert>
      )}
      {toggleMutation.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          ไม่สามารถเปลี่ยนสถานะโรงเรียนได้ กรุณาลองใหม่
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
          icon="solar:home-angle-bold-duotone"
          label="โรงเรียนทั้งหมด"
          value={schools.length}
          color="primary.main"
          bgcolor="primary.lighter"
        />
        <SummaryCard
          icon="solar:check-circle-bold"
          label="กำลังเปิดใช้งาน"
          value={activeCount}
          color="success.dark"
          bgcolor="success.lighter"
        />
        <SummaryCard
          icon="solar:users-group-rounded-bold-duotone"
          label="ผู้ใช้งานทั้งหมด"
          value={totalStudents + totalTeachers}
          color="info.dark"
          bgcolor="info.lighter"
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
              รายชื่อโรงเรียน
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {isLoading
                ? 'กำลังโหลด...'
                : `แสดง ${filteredSchools.length} จาก ${schools.length} แห่ง`}
            </Typography>
          </Box>
          <TextField
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาชื่อหรือรหัสโรงเรียน"
            aria-label="ค้นหาโรงเรียน"
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
          <Table sx={{ minWidth: 1160 }}>
            <TableHead>
              <TableRow>
                <TableCell>โรงเรียน</TableCell>
                <TableCell>รหัส</TableCell>
                <TableCell>แพ็กเกจ</TableCell>
                <TableCell align="center">ครู</TableCell>
                <TableCell align="center">นักเรียน</TableCell>
                <TableCell align="center">ห้องเรียน</TableCell>
                <TableCell align="center">รายวิชา</TableCell>
                <TableCell align="right">สถานะ</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}
                  >
                    กำลังโหลดข้อมูล...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !filteredSchools.length && (
                <TableRow>
                  <TableCell colSpan={9} sx={{ py: 8, textAlign: 'center' }}>
                    <RemixIcon
                      icon="solar:inbox-in-bold"
                      width={36}
                      sx={{ color: 'text.disabled' }}
                    />
                    <Typography variant="subtitle2" sx={{ mt: 1 }}>
                      {search ? 'ไม่พบโรงเรียนที่ค้นหา' : 'ยังไม่มีโรงเรียน'}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                      {search
                        ? 'ลองเปลี่ยนคำค้นหาอีกครั้ง'
                        : 'เพิ่มโรงเรียนแห่งแรกเพื่อเริ่มต้นใช้งาน'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {filteredSchools.map((school) => (
                <TableRow key={school.id} hover>
                  <TableCell>
                    <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
                      <Avatar
                        src={school.logo_url ?? undefined}
                        alt={school.name}
                        variant="rounded"
                        sx={{
                          width: 42,
                          height: 42,
                          color: 'primary.main',
                        }}
                      >
                        {school.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap>
                          {school.name}
                        </Typography>
                        {school.name_en && (
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{ display: 'block', color: 'text.secondary' }}
                          >
                            {school.name_en}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          สร้างเมื่อ{' '}
                          {new Intl.DateTimeFormat('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          }).format(new Date(school.created_at))}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={school.code} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2">
                      {school.subscription?.plan_name ?? 'ยังไม่กำหนด'}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color:
                          school.subscription?.status === 'active'
                            ? 'success.main'
                            : school.subscription?.status === 'trialing'
                              ? 'info.main'
                              : 'warning.main',
                      }}
                    >
                      {school.subscription?.status === 'active'
                        ? 'ใช้งาน'
                        : school.subscription?.status === 'trialing'
                          ? 'ทดลองใช้'
                          : school.subscription
                            ? 'ต้องตรวจสอบ'
                            : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {school.teacherCount.toLocaleString('th-TH')}
                  </TableCell>
                  <TableCell align="center">
                    {school.studentCount.toLocaleString('th-TH')}
                  </TableCell>
                  <TableCell align="center">
                    {school.classroomCount.toLocaleString('th-TH')}
                  </TableCell>
                  <TableCell align="center">
                    {school.subjectCount.toLocaleString('th-TH')}
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ gap: 0.5, display: 'inline-flex', alignItems: 'center' }}>
                      <Typography
                        variant="caption"
                        sx={{ color: school.is_active ? 'success.dark' : 'text.secondary' }}
                      >
                        {school.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </Typography>
                      <Tooltip
                        title={school.is_active ? 'ปิดใช้งานโรงเรียน' : 'เปิดใช้งานโรงเรียน'}
                      >
                        <Switch
                          size="small"
                          checked={school.is_active}
                          disabled={
                            toggleMutation.isPending && toggleMutation.variables?.id === school.id
                          }
                          onChange={(event) =>
                            toggleMutation.mutate({ id: school.id, isActive: event.target.checked })
                          }
                          inputProps={{ 'aria-label': `สถานะ ${school.name}` }}
                        />
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Tooltip title="แพ็กเกจและสิทธิ์ใช้งาน">
                        <IconButton
                          component={RouterLink}
                          href={paths.master.school.subscription(school.id)}
                          size="small"
                          color="primary"
                          aria-label={`จัดการแพ็กเกจ ${school.name}`}
                        >
                          <RemixIcon icon="solar:settings-bold" width={18} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="แก้ไขโรงเรียน">
                        <IconButton
                          size="small"
                          onClick={() => openEditDialog(school)}
                          aria-label={`แก้ไข ${school.name}`}
                        >
                          <RemixIcon icon="solar:pen-bold" width={18} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="ลบโรงเรียน">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            deleteMutation.reset();
                            setDeletingSchool(school);
                          }}
                          aria-label={`ลบ ${school.name}`}
                        >
                          <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog
        open={!!editingSchool}
        onClose={() => !updateMutation.isPending && setEditingSchool(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>แก้ไขโรงเรียน</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ mb: 2.5, color: 'text.secondary' }}>
            แก้ไขชื่อและรหัสอ้างอิงของโรงเรียน
          </Typography>
          {updateMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {updateMutation.error.message}
            </Alert>
          )}
          <Box sx={{ gap: 2.5, display: 'flex', flexDirection: 'column' }}>
            <TextField
              autoFocus
              label="ชื่อโรงเรียนภาษาไทย"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              required
            />
            <TextField
              label="ชื่อโรงเรียนภาษาอังกฤษ"
              value={editNameEn}
              onChange={(event) => setEditNameEn(event.target.value)}
              slotProps={{ htmlInput: { lang: 'en' } }}
            />
            <TextField
              label="รหัสโรงเรียน"
              value={editCode}
              onChange={(event) => setEditCode(event.target.value)}
              helperText="ตัวเลข 8 หลัก ใช้เป็น PIN สำหรับผู้ดูแลโรงเรียน"
              slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 8 } }}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => setEditingSchool(null)}
            disabled={updateMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            onClick={saveSchool}
            loading={updateMutation.isPending}
            disabled={!editName.trim() || !/^\d{8}$/.test(editCode.trim())}
          >
            บันทึกการแก้ไข
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!deletingSchool}
        onClose={() => !deleteMutation.isPending && setDeletingSchool(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการลบโรงเรียน</DialogTitle>
        <DialogContent>
          {deleteMutation.error ? (
            <Alert severity="error">{deleteMutation.error.message}</Alert>
          ) : (
            <>
              <Typography>ต้องการลบ “{deletingSchool?.name}” ออกจากระบบใช่หรือไม่?</Typography>
              <Alert severity="warning" sx={{ mt: 2 }}>
                ลบได้เฉพาะโรงเรียนที่ยังไม่มีผู้ใช้งานหรือข้อมูลการเรียน
                การดำเนินการนี้ย้อนกลับไม่ได้
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => setDeletingSchool(null)}
            disabled={deleteMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={deleteMutation.isPending}
            onClick={() => deletingSchool && deleteMutation.mutate(deletingSchool.id)}
          >
            ลบโรงเรียน
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
  icon:
    | 'solar:home-angle-bold-duotone'
    | 'solar:check-circle-bold'
    | 'solar:users-group-rounded-bold-duotone';
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
          flexShrink: 0,
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
