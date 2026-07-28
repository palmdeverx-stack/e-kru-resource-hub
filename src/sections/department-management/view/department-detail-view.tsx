'use client';

import type { DepartmentTeacher } from '../department-management-actions';
import type { DepartmentPermissionKey } from 'src/lib/department-permissions-config';

import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import {
  DEPARTMENT_PERMISSIONS,
  isManageableDepartmentPermission,
} from 'src/lib/department-permissions-config';

import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import {
  addDepartmentMember,
  getDepartmentMembers,
  removeDepartmentMember,
  updateDepartmentMemberRole,
  updateDepartmentMemberPermission,
} from '../department-management-actions';

// ----------------------------------------------------------------------

const FormSchema = z.object({
  teacherId: z.string().min(1, { error: 'กรุณาเลือกครู!' }),
  roleInDepartment: z.enum(['head', 'member']),
});

function teacherName(teacher: DepartmentTeacher) {
  return `${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`.trim();
}

type Props = { departmentId: string };

export function DepartmentDetailView({ departmentId }: Props) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['department-members', departmentId],
    queryFn: () => getDepartmentMembers(departmentId),
  });
  const members = data?.members ?? [];
  const eligibleTeachers = data?.eligibleTeachers ?? [];
  const grantedPermissions = data?.department.permissions ?? [];
  const permissionColumns = DEPARTMENT_PERMISSIONS.filter(
    (item) => grantedPermissions.includes(item.key) && isManageableDepartmentPermission(item.key)
  );
  const columnCount = 3 + permissionColumns.length;

  const methods = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: { teacherId: '', roleInDepartment: 'member' as const },
  });

  const addMutation = useMutation({
    mutationFn: (values: z.infer<typeof FormSchema>) => addDepartmentMember(departmentId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['department-members', departmentId] });
      await queryClient.invalidateQueries({ queryKey: ['departments'] });
      setAddDialogOpen(false);
      methods.reset({ teacherId: '', roleInDepartment: 'member' });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'head' | 'member' }) =>
      updateDepartmentMemberRole(departmentId, memberId, role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['department-members', departmentId] });
      await queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  const permissionMutation = useMutation({
    mutationFn: ({
      memberId,
      permissionKey,
      granted,
    }: {
      memberId: string;
      permissionKey: DepartmentPermissionKey;
      granted: boolean;
    }) => updateDepartmentMemberPermission(departmentId, memberId, permissionKey, granted),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['department-members', departmentId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeDepartmentMember(departmentId, memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['department-members', departmentId] });
      await queryClient.invalidateQueries({ queryKey: ['departments'] });
      setRemovingId(null);
    },
  });

  const openAddDialog = () => {
    methods.reset({ teacherId: '', roleInDepartment: 'member' });
    addMutation.reset();
    setAddDialogOpen(true);
  };

  const onSubmit = methods.handleSubmit((values) => addMutation.mutate(values));

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Box sx={{ mb: 1 }}>
        <Button
          component={RouterLink}
          href={paths.admin.department.root}
          size="small"
          startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        >
          กลับไปหน้ารายการฝ่าย
        </Button>
      </Box>

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
            สมาชิกฝ่าย
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            เพิ่ม/ถอดครู กำหนดหัวหน้าฝ่าย และมอบสิทธิ์แก้ไข/จัดการให้สมาชิกเป็นรายคน —
            สมาชิกทุกคนในฝ่ายดูข้อมูลได้อยู่แล้วโดยไม่ต้องมอบสิทธิ์
          </Typography>
        </Box>

        <Button
          variant="contained"
          onClick={openAddDialog}
          startIcon={<RemixIcon icon="mingcute:add-line" />}
          disabled={isLoading}
        >
          เพิ่มสมาชิก
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
          ไม่สามารถโหลดสมาชิกฝ่ายได้
        </Alert>
      )}

      {!isLoading && !!data && !permissionColumns.length && (
        <Alert severity="info" sx={{ mb: 3 }}>
          ฝ่ายนี้ยังไม่ได้เปิดสิทธิ์เข้าถึงหน้าใดไว้ — ไปที่หน้ารายการฝ่ายเพื่อเปิดสิทธิ์ก่อน
          จึงจะมอบให้สมาชิกรายคนได้
        </Alert>
      )}

      <Card variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ครู</TableCell>
                <TableCell>บทบาท</TableCell>
                {permissionColumns.map((item) => (
                  <TableCell key={item.key}>แก้ไข{item.label}ได้</TableCell>
                ))}
                <TableCell align="right">การจัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={columnCount}>กำลังโหลด...</TableCell>
                </TableRow>
              )}
              {!isLoading && !members.length && (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                  >
                    ยังไม่มีสมาชิกในฝ่ายนี้
                  </TableCell>
                </TableRow>
              )}
              {members.map((member) => (
                <TableRow key={member.id} hover>
                  <TableCell>
                    <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
                      <Avatar src={member.teacher.avatar_url ?? undefined}>
                        {member.teacher.first_name?.charAt(0) ?? '?'}
                      </Avatar>
                      <Typography variant="subtitle2">{teacherName(member.teacher)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="soft"
                      color={member.role_in_department === 'head' ? 'primary' : 'default'}
                      label={member.role_in_department === 'head' ? 'หัวหน้าฝ่าย' : 'สมาชิก'}
                    />
                  </TableCell>
                  {permissionColumns.map((item) => (
                    <TableCell key={item.key}>
                      <Switch
                        checked={member.permissions.includes(item.key)}
                        disabled={permissionMutation.isPending}
                        onChange={(event) =>
                          permissionMutation.mutate({
                            memberId: member.id,
                            permissionKey: item.key,
                            granted: event.target.checked,
                          })
                        }
                        inputProps={{
                          'aria-label': `สิทธิ์แก้ไข${item.label}ของ ${teacherName(member.teacher)}`,
                        }}
                      />
                    </TableCell>
                  ))}
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Button
                        size="small"
                        disabled={roleMutation.isPending}
                        onClick={() =>
                          roleMutation.mutate({
                            memberId: member.id,
                            role: member.role_in_department === 'head' ? 'member' : 'head',
                          })
                        }
                      >
                        {member.role_in_department === 'head' ? 'ลดเป็นสมาชิก' : 'ตั้งเป็นหัวหน้า'}
                      </Button>
                      <Tooltip title="ถอดออกจากฝ่าย">
                        <Box>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              removeMutation.reset();
                              setRemovingId(member.id);
                            }}
                            aria-label={`ถอด ${teacherName(member.teacher)} ออกจากฝ่าย`}
                          >
                            <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
                          </IconButton>
                        </Box>
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
        open={addDialogOpen}
        onClose={() => !addMutation.isPending && setAddDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <Form methods={methods} onSubmit={onSubmit}>
          <DialogTitle sx={{ pb: 1 }}>เพิ่มสมาชิกฝ่าย</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            {addMutation.error && (
              <Alert severity="error" sx={{ mb: 2.5 }}>
                {addMutation.error.message}
              </Alert>
            )}
            {!eligibleTeachers.length && !isLoading ? (
              <Alert severity="info">ครูทุกคนในโรงเรียนสังกัดฝ่ายอื่นอยู่แล้ว</Alert>
            ) : (
              <>
                <Field.Select name="teacherId" label="ครู *">
                  {eligibleTeachers.map((teacher) => (
                    <MenuItem key={teacher.id} value={teacher.id}>
                      {teacherName(teacher)}
                    </MenuItem>
                  ))}
                </Field.Select>
                <Field.RadioGroup
                  name="roleInDepartment"
                  label="บทบาทในฝ่าย"
                  row
                  sx={{ mt: 2.5 }}
                  options={[
                    { label: 'สมาชิก', value: 'member' },
                    { label: 'หัวหน้าฝ่าย', value: 'head' },
                  ]}
                />
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              color="inherit"
              onClick={() => setAddDialogOpen(false)}
              disabled={addMutation.isPending}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              variant="contained"
              loading={addMutation.isPending}
              disabled={!eligibleTeachers.length}
            >
              เพิ่มสมาชิก
            </Button>
          </DialogActions>
        </Form>
      </Dialog>

      <Dialog
        open={!!removingId}
        onClose={() => !removeMutation.isPending && setRemovingId(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการถอดสมาชิก</DialogTitle>
        <DialogContent>
          {removeMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {removeMutation.error.message}
            </Alert>
          )}
          <Typography variant="body2">ต้องการถอดครูคนนี้ออกจากฝ่ายใช่หรือไม่?</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => setRemovingId(null)}
            disabled={removeMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={removeMutation.isPending}
            onClick={() => removingId && removeMutation.mutate(removingId)}
          >
            ถอดออกจากฝ่าย
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
