'use client';

import type { StaffType } from 'src/types/staff-employment';
import type {
  AccessLevel,
  OverrideAccessLevel,
} from '../access-permission-actions';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import {
  DEPARTMENT_PERMISSIONS,
  isManageableDepartmentPermission,
} from 'src/lib/department-permissions-config';

import { RemixIcon } from 'src/components/remix-icon';

import {
  getAccessPermissions,
  saveStaffTypePermissions,
  saveUserPermissionOverrides,
} from '../access-permission-actions';

// ----------------------------------------------------------------------

type Props = {
  mode: 'staff_type' | 'individual';
};

function PermissionRows({
  values,
  overrideMode,
  disabled,
  onChange,
}: {
  values: Record<string, AccessLevel | OverrideAccessLevel>;
  overrideMode?: boolean;
  disabled?: boolean;
  onChange: (key: string, level: AccessLevel | OverrideAccessLevel) => void;
}) {
  return (
    <TableContainer>
      <Table sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 220 }}>หน้าระบบ</TableCell>
            <TableCell>ขอบเขตสิทธิ์</TableCell>
            <TableCell sx={{ width: 240 }}>ระดับสิทธิ์</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {DEPARTMENT_PERMISSIONS.map((permission) => (
            <TableRow key={permission.key} hover>
              <TableCell>
                <Typography variant="subtitle2">{permission.label}</Typography>
                {!isManageableDepartmentPermission(permission.key) && (
                  <Chip
                    size="small"
                    variant="soft"
                    color="warning"
                    label="ดูข้อมูลเท่านั้น"
                    sx={{ mt: 0.75 }}
                  />
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {permission.description}
                </Typography>
              </TableCell>
              <TableCell>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={values[permission.key] ?? (overrideMode ? 'inherit' : 'none')}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(
                      permission.key,
                      event.target.value as AccessLevel | OverrideAccessLevel
                    )
                  }
                  slotProps={{ select: { displayEmpty: true } }}
                >
                  {overrideMode && <MenuItem value="inherit">ตามค่าหลัก</MenuItem>}
                  <MenuItem value="none">ไม่มีสิทธิ์</MenuItem>
                  <MenuItem value="view">ดูข้อมูล</MenuItem>
                  {isManageableDepartmentPermission(permission.key) && (
                    <MenuItem value="manage">ดูและจัดการ</MenuItem>
                  )}
                </TextField>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function StaffAccessPermissionsPanel({ mode }: Props) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['access-permissions'],
    queryFn: getAccessPermissions,
  });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedStaffType, setSelectedStaffType] = useState<StaffType>('executive');
  const [values, setValues] = useState<
    Record<string, AccessLevel | OverrideAccessLevel>
  >({});

  const selectedUser = data?.staff.find((staff) => staff.id === selectedUserId);

  useEffect(() => {
    if (mode === 'staff_type' && data) {
      setValues(
        Object.fromEntries(
          data.staffTypePermissions
            .filter((permission) => permission.staff_type === selectedStaffType)
            .map((permission) => [
              permission.permission_key,
              permission.access_level,
            ])
        )
      );
      return;
    }

    if (mode === 'individual' && data?.staff.length && !selectedUserId) {
      setSelectedUserId(data.staff[0].id);
    }
  }, [data, mode, selectedStaffType, selectedUserId]);

  useEffect(() => {
    if (mode !== 'individual' || !selectedUser) return;
    setValues(
      Object.fromEntries(
        selectedUser.overrides.map((permission) => [
          permission.permission_key,
          permission.access_level,
        ])
      )
    );
  }, [mode, selectedUser]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const permissions = DEPARTMENT_PERMISSIONS.map((permission) => ({
        key: permission.key,
        level:
          values[permission.key] ?? (mode === 'individual' ? 'inherit' : 'none'),
      }));
      return mode === 'staff_type'
        ? saveStaffTypePermissions(
            selectedStaffType,
            permissions as { key: string; level: AccessLevel }[]
          )
        : saveUserPermissionOverrides(
            selectedUserId,
            permissions as { key: string; level: OverrideAccessLevel }[]
          );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['access-permissions'] });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  if (isLoading) return <Card variant="outlined" sx={{ p: 3 }}>กำลังโหลดสิทธิ์...</Card>;
  if (isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            ลองอีกครั้ง
          </Button>
        }
      >
        ไม่สามารถโหลดข้อมูลสิทธิ์ได้
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {mode === 'staff_type' && (
        <Alert severity="info">
          หลังตรวจ role เป็นครู ระบบจะตรวจประเภทบุคลากรต่อ
          และแสดงเฉพาะหน้าที่ประเภทนั้นได้รับสิทธิ์
        </Alert>
      )}
      {mode === 'staff_type' && (
        <Card variant="outlined" sx={{ p: 2.5 }}>
          <TextField
            select
            fullWidth
            label="เลือกประเภทบุคลากร"
            value={selectedStaffType}
            onChange={(event) => setSelectedStaffType(event.target.value as StaffType)}
          >
            {(data?.staffTypes ?? []).map((staffType) => (
              <MenuItem key={staffType.code} value={staffType.code}>
                {staffType.name}
                {staffType.name_en ? ` / ${staffType.name_en}` : ''}
                {!staffType.is_active ? ' (ปิดใช้งาน)' : ''}
              </MenuItem>
            ))}
          </TextField>
        </Card>
      )}
      {mode === 'individual' && (
        <Card variant="outlined" sx={{ p: 2.5 }}>
          <TextField
            select
            fullWidth
            label="เลือกครู/บุคลากร"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
          >
            {(data?.staff ?? []).map((staff) => (
              <MenuItem key={staff.id} value={staff.id}>
                {`${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim() || staff.username}
                {staff.staff_type
                  ? ` · ${
                      data?.staffTypes.find((item) => item.code === staff.staff_type)?.name ??
                      staff.staff_type
                    }`
                  : ''}
              </MenuItem>
            ))}
          </TextField>
        </Card>
      )}

      {mode === 'individual' && !data?.staff.length ? (
        <Alert severity="info">ยังไม่มีครูหรือบุคลากรในโรงเรียน</Alert>
      ) : (
        <Card variant="outlined">
          <PermissionRows
            values={values}
            overrideMode={mode === 'individual'}
            disabled={saveMutation.isPending}
            onChange={(key, level) => setValues((current) => ({ ...current, [key]: level }))}
          />
          {saveMutation.error && (
            <Alert severity="error" sx={{ m: 2.5 }}>
              {saveMutation.error.message}
            </Alert>
          )}
          <Box
            sx={{
              p: 2,
              display: 'flex',
              justifyContent: 'flex-end',
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Button
              variant="contained"
              loading={saveMutation.isPending}
              disabled={mode === 'individual' && !selectedUserId}
              startIcon={<RemixIcon icon="solar:diskette-bold" />}
              onClick={() => saveMutation.mutate()}
            >
              บันทึกสิทธิ์
            </Button>
          </Box>
        </Card>
      )}
    </Box>
  );
}
