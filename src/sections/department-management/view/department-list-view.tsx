'use client';

import type { Department } from '../department-management-actions';

import * as z from 'zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { usePopover } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
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
import AvatarGroup from '@mui/material/AvatarGroup';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Form, Field } from 'src/components/hook-form';
import { CustomPopover } from 'src/components/custom-popover';
import { RemixIcon, RiSearch2Line } from 'src/components/remix-icon';

import {
  listDepartments,
  createDepartment,
  deleteDepartment,
  updateDepartment,
} from '../department-management-actions';

// ----------------------------------------------------------------------

const FormSchema = z.object({
  name: z.string().trim().min(1, { error: 'กรุณากรอกชื่อฝ่าย!' }),
  description: z.string().trim(),
});

function teacherName(teacher: Department['members'][number]['teacher']) {
  return `${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`.trim() || '-';
}

export function DepartmentListView() {
  const rowMenu = usePopover();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuDepartment, setMenuDepartment] = useState<Department | null>(null);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);
  const queryClient = useQueryClient();

  const {
    data: departments = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['departments'], queryFn: listDepartments });

  const filteredDepartments = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('th');
    if (!keyword) return departments;
    return departments.filter((department) =>
      [
        department.name,
        department.description,
        ...department.members.map((member) => teacherName(member.teacher)),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword)
    );
  }, [departments, query]);
  const visibleDepartments = filteredDepartments.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );
  const departmentsWithHead = departments.filter((department) =>
    department.members.some((member) => member.role_in_department === 'head')
  ).length;
  const uniqueMemberCount = new Set(
    departments.flatMap((department) => department.members.map((member) => member.teacher.id))
  ).size;

  const methods = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: '', description: '' },
  });
  const { handleSubmit, reset } = methods;

  const saveMutation = useMutation({
    mutationFn: (data: z.infer<typeof FormSchema>) =>
      editing ? updateDepartment(editing.id, data) : createDepartment(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDialogOpen(false);
      setEditing(null);
      reset({ name: '', description: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDeleting(null);
    },
  });

  const openCreateDialog = () => {
    setEditing(null);
    reset({ name: '', description: '' });
    saveMutation.reset();
    setDialogOpen(true);
  };

  const openEditDialog = (department: Department) => {
    setEditing(department);
    reset({
      name: department.name,
      description: department.description ?? '',
    });
    saveMutation.reset();
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saveMutation.isPending) return;
    setDialogOpen(false);
    setEditing(null);
    reset({ name: '', description: '' });
    saveMutation.reset();
  };

  const onSubmit = handleSubmit((data) => saveMutation.mutate(data));

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
            จัดการฝ่าย
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            กำหนดฝ่ายงานภายในโรงเรียน พร้อมหัวหน้าฝ่ายและสมาชิก
          </Typography>
        </Box>

        <Box sx={{ gap: 1, display: 'flex' }}>
          <Button
            variant="contained"
            onClick={openCreateDialog}
            startIcon={<RemixIcon icon="mingcute:add-line" />}
          >
            เพิ่มฝ่าย
          </Button>
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
          ไม่สามารถโหลดรายการฝ่ายได้
        </Alert>
      )}

      <Box
        sx={{
          mb: 3,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        }}
      >
        {[
          { label: 'ฝ่ายทั้งหมด', value: `${departments.length} ฝ่าย` },
          { label: 'กำหนดหัวหน้าแล้ว', value: `${departmentsWithHead} ฝ่าย` },
          { label: 'บุคลากรในฝ่าย', value: `${uniqueMemberCount} คน` },
        ].map((item) => (
          <Card key={item.label} variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {item.label}
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
              {item.value}
            </Typography>
          </Card>
        ))}
      </Box>

      <Card variant="outlined">
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
            <Typography component="h2" variant="h6">
              รายการฝ่าย
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              {isLoading
                ? 'กำลังโหลด...'
                : query
                  ? `พบ ${filteredDepartments.length} จาก ${departments.length} ฝ่าย`
                  : `${departments.length} ฝ่าย`}
            </Typography>
          </Box>
          <TextField
            size="medium"
            value={query}
            placeholder="ค้นหาฝ่าย หัวหน้า หรือสมาชิก"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            sx={{ width: { xs: 1, sm: 360 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <RiSearch2Line />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        <TableContainer>
          <Table sx={{ minWidth: 820 }}>
            <TableHead>
              <TableRow>
                <TableCell>ฝ่าย</TableCell>
                <TableCell>หัวหน้าฝ่าย</TableCell>
                <TableCell>สมาชิก</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">การจัดการ</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                      <CircularProgress size={28} />
                    </Box>
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !filteredDepartments.length && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                  >
                    {query
                      ? 'ไม่พบฝ่ายที่ตรงกับคำค้นหา'
                      : 'ยังไม่มีฝ่าย กด “เพิ่มฝ่าย” เพื่อเริ่มต้น'}
                  </TableCell>
                </TableRow>
              )}

              {visibleDepartments.map((department) => {
                const heads = department.members.filter(
                  (member) => member.role_in_department === 'head'
                );
                return (
                  <TableRow key={department.id} hover>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography variant="subtitle2">{department.name}</Typography>
                      <Typography variant="body2" sx={{ mt: 0.25, color: 'text.secondary' }} noWrap>
                        {department.description || 'ไม่มีคำอธิบาย'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {heads.length ? (
                        <Box sx={{ gap: 0.5, display: 'flex', flexWrap: 'wrap' }}>
                          {heads.map((head) => (
                            <Chip
                              key={head.id}
                              size="small"
                              variant="soft"
                              color="primary"
                              label={teacherName(head.teacher)}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                          ยังไม่ได้กำหนด
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
                        <AvatarGroup
                          max={4}
                          sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: 12 } }}
                        >
                          {department.members.map((member) => (
                            <Avatar
                              key={member.id}
                              src={member.teacher.avatar_url ?? undefined}
                              alt={teacherName(member.teacher)}
                            >
                              {member.teacher.first_name?.charAt(0) ?? '?'}
                            </Avatar>
                          ))}
                        </AvatarGroup>
                        <Typography variant="body2">{department.members.length} คน</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="soft"
                        color={heads.length ? 'success' : 'warning'}
                        label={heads.length ? 'พร้อมใช้งาน' : 'รอกำหนดหัวหน้า'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          setMenuDepartment(department);
                          rowMenu.onOpen(event);
                        }}
                        aria-label={`ตัวเลือกเพิ่มเติมสำหรับฝ่าย ${department.name}`}
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

        <TablePagination
          component="div"
          page={page}
          count={filteredDepartments.length}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          labelRowsPerPage="แสดงต่อหน้า"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
        />
      </Card>

      <CustomPopover open={rowMenu.open} anchorEl={rowMenu.anchorEl} onClose={rowMenu.onClose}>
        <MenuList>
          <MenuItem
            component={RouterLink}
            href={paths.admin.department.detail(menuDepartment?.id ?? '')}
            onClick={rowMenu.onClose}
          >
            <RemixIcon icon="solar:users-group-rounded-bold" width={18} />
            จัดการสมาชิก
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (menuDepartment) openEditDialog(menuDepartment);
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
              if (menuDepartment) {
                deleteMutation.reset();
                setDeleting(menuDepartment);
              }
              rowMenu.onClose();
            }}
          >
            <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
            ลบ
          </MenuItem>
        </MenuList>
      </CustomPopover>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="xs">
        <Form methods={methods} onSubmit={onSubmit}>
          <DialogTitle sx={{ pb: 1 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
            >
              <Box>
                <Typography component="h2" variant="h6">
                  {editing ? 'แก้ไขฝ่าย' : 'เพิ่มฝ่าย'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                  {editing ? 'ปรับชื่อและคำอธิบายฝ่าย' : 'สร้างฝ่ายงานใหม่สำหรับโรงเรียน'}
                </Typography>
              </Box>
              <IconButton
                onClick={closeDialog}
                disabled={saveMutation.isPending}
                aria-label="ปิดหน้าต่าง"
              >
                <RemixIcon icon="mingcute:close-line" />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ pt: 2 }}>
            {saveMutation.error && (
              <Alert severity="error" sx={{ mb: 2.5 }}>
                {saveMutation.error.message}
              </Alert>
            )}
            <Field.Text name="name" label="ชื่อฝ่าย *" placeholder="เช่น ฝ่ายวิชาการ" autoFocus />
            <Field.Text
              name="description"
              label="คำอธิบาย"
              placeholder="รายละเอียดหน้าที่ของฝ่าย (ถ้ามี)"
              multiline
              minRows={2}
              sx={{ mt: 2.5 }}
            />
          </DialogContent>

          <DialogActions>
            <Button color="inherit" onClick={closeDialog} disabled={saveMutation.isPending}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="contained" loading={saveMutation.isPending}>
              {editing ? 'บันทึกการแก้ไข' : 'เพิ่มฝ่าย'}
            </Button>
          </DialogActions>
        </Form>
      </Dialog>

      <Dialog
        open={!!deleting}
        onClose={() => !deleteMutation.isPending && setDeleting(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการลบฝ่าย</DialogTitle>
        <DialogContent>
          {deleteMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteMutation.error.message}
            </Alert>
          )}
          <Typography variant="body2">
            ต้องการลบฝ่าย <strong>{deleting?.name}</strong> ใช่หรือไม่?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            สมาชิกและประกาศของฝ่ายนี้จะถูกลบตามไปด้วย การดำเนินการนี้ย้อนกลับไม่ได้
          </Alert>
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
            ลบฝ่าย
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
