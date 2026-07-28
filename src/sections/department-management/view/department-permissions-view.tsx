'use client';

import type { Department } from '../department-management-actions';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import CircularProgress from '@mui/material/CircularProgress';

import { navData as adminNavData } from 'src/layouts/nav-config-dashboard';
import { navData as teacherNavData } from 'src/layouts/nav-config-teacher';
import { DEPARTMENT_DELEGABLE_PERMISSIONS } from 'src/lib/department-permissions-config';

import { RemixIcon, RiSearch2Line } from 'src/components/remix-icon';

import { listDepartments, updateDepartment } from '../department-management-actions';
import { StaffAccessPermissionsPanel } from '../components/staff-access-permissions-panel';

// ----------------------------------------------------------------------

function flattenNav(data: typeof teacherNavData) {
  return data.flatMap((group) =>
    group.items.flatMap((item) => (item.children?.length ? item.children : [item]))
  );
}

// Flatten the actual sidebar configs so this page always reflects what's
// really wired up in the nav, instead of a hand-maintained duplicate.
const teacherMenuItems = flattenNav(teacherNavData);
const adminMenuItems = flattenNav(adminNavData);

const baseMenuItems = teacherMenuItems.filter(
  (item) => !item.requiresDepartment && !item.requiresDepartmentPermission
);

const departmentMenuItems = teacherMenuItems.filter(
  (item) => item.requiresDepartment && !item.requiresDepartmentPermission
);

// Every delegable permission unlocks pages inside the admin section (a
// delegated teacher reaches them via /admin, same as a school admin) — map
// each permission key to the admin nav items that declare it.
const PERMISSION_MENU_ITEMS: Record<string, string[]> = Object.fromEntries(
  DEPARTMENT_DELEGABLE_PERMISSIONS.map((permission) => [
    permission.key,
    adminMenuItems
      .filter((item) => item.requiresDepartmentPermission === permission.key)
      .map((item) => item.title),
  ])
);

function samePermissions(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((key) => set.has(key));
}

export function DepartmentPermissionsView() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const {
    data: departments = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['departments'], queryFn: listDepartments });

  // Permission edits made in the table but not yet saved, keyed by department
  // id — only departments the admin actually touched get an entry here.
  const [draft, setDraft] = useState<Record<string, string[]>>({});

  const getPermissions = (department: Department) => draft[department.id] ?? department.permissions;

  const togglePermission = (department: Department, key: string, checked: boolean) => {
    const current = getPermissions(department);
    const next = checked ? [...current, key] : current.filter((permission) => permission !== key);
    setDraft((prev) => ({ ...prev, [department.id]: next }));
  };

  const dirtyDepartments = departments.filter(
    (department) =>
      draft[department.id] && !samePermissions(draft[department.id], department.permissions)
  );
  const hasChanges = dirtyDepartments.length > 0;
  const filteredDepartments = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('th');
    if (!keyword) return departments;
    return departments.filter((department) =>
      [
        department.name,
        department.description,
        ...department.permissions.map(
          (permission) =>
            DEPARTMENT_DELEGABLE_PERMISSIONS.find((item) => item.key === permission)?.label
        ),
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
  const grantedPermissionCount = departments.reduce(
    (total, department) =>
      total +
      department.permissions.filter((permission) =>
        DEPARTMENT_DELEGABLE_PERMISSIONS.some((item) => item.key === permission)
      ).length,
    0
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        dirtyDepartments.map((department) =>
          updateDepartment(department.id, {
            name: department.name,
            description: department.description ?? '',
            permissions: draft[department.id],
          })
        )
      ),
    onSuccess: async () => {
      setDraft({});
      await queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  const discardChanges = () => setDraft({});

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Box sx={{ mb: 4 }}>
        <Typography component="h1" variant="h3">
          สิทธิ์การใช้งาน
        </Typography>
        <Typography sx={{ mt: 1, color: 'text.secondary' }}>
          กำหนดสิทธิ์ตามฝ่าย ประเภทบุคลากร และข้อยกเว้นเฉพาะบุคคล
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, value: number) => {
            setTab(value);
            setPage(0);
            setQuery('');
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2 }}
        >
          <Tab label="สิทธิ์ตามฝ่าย" />
          <Tab label="สิทธิ์ตามประเภทบุคลากร" />
          <Tab label="สิทธิ์เฉพาะบุคคล" />
        </Tabs>
      </Card>

      <Box
        sx={{
          gap: 3,
          flexDirection: 'column',
          display: tab === 0 ? 'flex' : 'none',
        }}
      >
        {isError && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => refetch()}>
                ลองอีกครั้ง
              </Button>
            }
          >
            ไม่สามารถโหลดรายการฝ่ายได้
          </Alert>
        )}

        {saveMutation.isError && (
          <Alert severity="error">บันทึกสิทธิ์ไม่สำเร็จ กรุณาลองอีกครั้ง</Alert>
        )}

        {hasChanges && (
          <Alert
            severity="warning"
            variant="outlined"
            action={
              <Box sx={{ gap: 1, display: 'flex' }}>
                <Button
                  color="inherit"
                  size="small"
                  onClick={discardChanges}
                  disabled={saveMutation.isPending}
                >
                  ยกเลิก
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => saveMutation.mutate()}
                  loading={saveMutation.isPending}
                >
                  บันทึกการเปลี่ยนแปลง
                </Button>
              </Box>
            }
          >
            มีการแก้ไขสิทธิ์ {dirtyDepartments.length} ฝ่ายที่ยังไม่ได้บันทึก
          </Alert>
        )}

        <Box
          sx={{
            gap: 2,
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {[
            { label: 'ฝ่ายทั้งหมด', value: `${departments.length} ฝ่าย` },
            { label: 'สิทธิ์ที่เปิดใช้งาน', value: `${grantedPermissionCount} รายการ` },
            { label: 'รอบันทึก', value: `${dirtyDepartments.length} ฝ่าย` },
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

        <Card variant="outlined" sx={{ p: 2.5, order: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            เมนูที่ครูเห็นในระบบตอนนี้
          </Typography>

          <Box sx={{ gap: 2.5, display: 'flex', flexDirection: 'column' }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                เมนูพื้นฐาน — ครูทุกคนเห็นเหมือนกัน ไม่ต้องมีฝ่าย
              </Typography>
              <Box sx={{ gap: 0.75, display: 'flex', flexWrap: 'wrap' }}>
                {baseMenuItems.map((item) => (
                  <Chip key={item.title} size="small" variant="soft" label={item.title} />
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                เมนูของสมาชิกฝ่าย — เหมือนกันทุกฝ่าย แค่มีสังกัดฝ่ายก็เห็น
              </Typography>
              <Box sx={{ gap: 0.75, display: 'flex', flexWrap: 'wrap', mb: 1 }}>
                {departmentMenuItems.map((item) => (
                  <Chip
                    key={item.title}
                    size="small"
                    variant="soft"
                    color="primary"
                    label={item.title}
                  />
                ))}
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                ดูประกาศฝ่ายและรายชื่อสมาชิก — ถ้าเป็น “หัวหน้าฝ่าย”
                จะโพสต์ประกาศฝ่ายและจัดการสมาชิก/มอบสิทธิ์ได้เพิ่ม
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                เมนูที่ปลดล็อกตามสิทธิ์ (คอลัมน์ในตารางด้านล่าง)
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {DEPARTMENT_DELEGABLE_PERMISSIONS.map((permission) => (
                  <Box
                    key={permission.key}
                    sx={{ gap: 0.75, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}
                  >
                    {(PERMISSION_MENU_ITEMS[permission.key] ?? []).map((title) => (
                      <Chip key={title} size="small" variant="soft" color="info" label={title} />
                    ))}
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      — {permission.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Card>

        <Card variant="outlined" sx={{ order: 1 }}>
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
              <Typography variant="h6">สิทธิ์ตามฝ่าย</Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                {query
                  ? `พบ ${filteredDepartments.length} จาก ${departments.length} ฝ่าย`
                  : `${departments.length} ฝ่าย`}
              </Typography>
            </Box>
            <TextField
              size="medium"
              value={query}
              placeholder="ค้นหาฝ่ายหรือสิทธิ์"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              sx={{ width: { xs: 1, sm: 340 } }}
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
            <Table sx={{ minWidth: 1500 }}>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      left: 0,
                      zIndex: 3,
                      minWidth: 220,
                      position: 'sticky',
                      bgcolor: 'background.paper',
                    }}
                  >
                    ฝ่าย
                  </TableCell>
                  {DEPARTMENT_DELEGABLE_PERMISSIONS.map((item) => (
                    <TableCell key={item.key} align="center" sx={{ minWidth: 150 }}>
                      <Tooltip title={item.description}>
                        <Box
                          sx={{
                            gap: 0.5,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {item.label}
                          <RemixIcon
                            icon="solar:info-circle-bold"
                            width={14}
                            sx={{ color: 'text.disabled' }}
                          />
                        </Box>
                      </Tooltip>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={1 + DEPARTMENT_DELEGABLE_PERMISSIONS.length}>
                      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                        <CircularProgress size={28} />
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !filteredDepartments.length && (
                  <TableRow>
                    <TableCell
                      colSpan={1 + DEPARTMENT_DELEGABLE_PERMISSIONS.length}
                      sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                    >
                      {query
                        ? 'ไม่พบฝ่ายที่ตรงกับคำค้นหา'
                        : 'ยังไม่มีฝ่าย ไปที่หน้ารายการฝ่ายเพื่อเพิ่มฝ่ายก่อน'}
                    </TableCell>
                  </TableRow>
                )}
                {visibleDepartments.map((department) => {
                  const isDirty = dirtyDepartments.some((item) => item.id === department.id);
                  const permissions = getPermissions(department);
                  return (
                    <TableRow key={department.id} hover selected={isDirty}>
                      <TableCell
                        sx={{
                          left: 0,
                          zIndex: 1,
                          position: 'sticky',
                          bgcolor: 'background.paper',
                        }}
                      >
                        <Typography variant="subtitle2">{department.name}</Typography>
                        <Box sx={{ mt: 0.5, gap: 0.5, display: 'flex', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            เปิด{' '}
                            {
                              permissions.filter((permission) =>
                                DEPARTMENT_DELEGABLE_PERMISSIONS.some(
                                  (item) => item.key === permission
                                )
                              ).length
                            }{' '}
                            สิทธิ์
                          </Typography>
                          {isDirty && (
                            <Chip
                              size="small"
                              color="warning"
                              variant="soft"
                              label="ยังไม่บันทึก"
                            />
                          )}
                        </Box>
                      </TableCell>
                      {DEPARTMENT_DELEGABLE_PERMISSIONS.map((item) => {
                        const granted = permissions.includes(item.key);
                        return (
                          <TableCell key={item.key} align="center">
                            <Switch
                              checked={granted}
                              disabled={saveMutation.isPending}
                              onChange={(event) =>
                                togglePermission(department, item.key, event.target.checked)
                              }
                              inputProps={{
                                'aria-label': `สิทธิ์ ${item.label} ของ ${department.name}`,
                              }}
                            />
                          </TableCell>
                        );
                      })}
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
      </Box>

      {tab === 1 && <StaffAccessPermissionsPanel mode="staff_type" />}
      {tab === 2 && <StaffAccessPermissionsPanel mode="individual" />}
    </Container>
  );
}
