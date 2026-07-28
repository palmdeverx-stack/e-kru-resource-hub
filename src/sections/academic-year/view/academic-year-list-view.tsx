'use client';

import type { AcademicYear } from '../academic-year-actions';

import dayjs from 'dayjs';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';
import { CustomPopover } from 'src/components/custom-popover';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import { useAuthContext } from 'src/auth/hooks';

import { listAcademicYears } from '../academic-year-actions';
import { AcademicYearFormDialog } from '../components/academic-year-form-dialog';
import { AcademicYearDeleteDialog } from '../components/academic-year-delete-dialog';

// ----------------------------------------------------------------------

export function AcademicYearListView() {
  const { user } = useAuthContext();
  const isTeacher = user?.role === 'teacher';
  const table = useTable({ defaultRowsPerPage: 10 });
  const rowMenu = usePopover();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuYear, setMenuYear] = useState<AcademicYear | null>(null);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [deletingYear, setDeletingYear] = useState<AcademicYear | null>(null);
  const [today] = useState(() => dayjs().startOf('day'));

  const {
    data: academicYears = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['academic-years'],
    queryFn: listAcademicYears,
  });
  const visibleAcademicYears = rowInPage(academicYears, table.page, table.rowsPerPage);

  const openCreateDialog = () => {
    setEditingYear(null);
    setDialogOpen(true);
  };

  const openEditDialog = (year: AcademicYear) => {
    setEditingYear(year);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingYear(null);
  };

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
            ปีการศึกษา
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            จัดการปีการศึกษาและภาคเรียนของโรงเรียน
          </Typography>
        </Box>

        <Button
          variant="contained"
          onClick={openCreateDialog}
          startIcon={<RemixIcon icon="mingcute:add-line" />}
        >
          เพิ่มปีการศึกษา
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
          ไม่สามารถโหลดรายการปีการศึกษาได้
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
          icon="solar:calendar-date-bold"
          label="ปีการศึกษาทั้งหมด"
          value={academicYears.length}
          color="primary.main"
        />
        <SummaryCard
          icon="solar:check-circle-bold"
          label="ปีการศึกษาปัจจุบัน"
          value={
            academicYears.filter((year) => getAcademicYearStatus(year, today).value === 'current')
              .length
          }
          color="success.main"
        />
        <SummaryCard
          icon="solar:clock-circle-bold"
          label="กำหนดช่วงเวลาแล้ว"
          value={academicYears.filter((year) => year.start_date && year.end_date).length}
          color="info.main"
        />
      </Box>

      <Card variant="outlined">
        <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography component="h2" variant="h6">
            รายการปีการศึกษา
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
            {isLoading ? 'กำลังโหลด...' : `${academicYears.length} รายการ`}
          </Typography>
        </Box>

        <TableContainer>
          <Table sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell>ปีการศึกษา</TableCell>
                <TableCell>ช่วงเวลา</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">การจัดการ</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4}>กำลังโหลด...</TableCell>
                </TableRow>
              )}

              {!isLoading && !academicYears.length && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                  >
                    ยังไม่มีปีการศึกษา กด “เพิ่มปีการศึกษา” เพื่อเริ่มต้น
                  </TableCell>
                </TableRow>
              )}

              {visibleAcademicYears.map((year) => {
                const status = getAcademicYearStatus(year, today);

                return (
                  <TableRow key={year.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2">{year.year}</Typography>
                    </TableCell>
                    <TableCell>
                      {year.start_date && year.end_date ? (
                        <Box sx={{ gap: 0.5, display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body2">{formatThaiDate(year.start_date)}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            ถึง {formatThaiDate(year.end_date)}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                          ยังไม่กำหนด
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="soft" color={status.color} label={status.label} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          setMenuYear(year);
                          rowMenu.onOpen(event);
                        }}
                        aria-label={`ตัวเลือกเพิ่มเติมสำหรับปีการศึกษา ${year.year}`}
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
          count={academicYears.length}
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
            href={
              isTeacher
                ? paths.teacher.departmentAcademicYear.semester(menuYear?.id ?? '')
                : `${paths.admin.academicYear.root}/${menuYear?.id ?? ''}/semester`
            }
            onClick={rowMenu.onClose}
          >
            <RemixIcon icon="solar:calendar-mark-bold" width={18} />
            ดูภาคเรียน
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (menuYear) openEditDialog(menuYear);
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
              if (menuYear) setDeletingYear(menuYear);
              rowMenu.onClose();
            }}
          >
            <RemixIcon icon="solar:trash-bin-trash-bold" width={18} />
            ลบ
          </MenuItem>
        </MenuList>
      </CustomPopover>

      <AcademicYearFormDialog open={dialogOpen} academicYear={editingYear} onClose={closeDialog} />
      <AcademicYearDeleteDialog
        academicYear={deletingYear}
        onClose={() => setDeletingYear(null)}
        onDeleted={() => table.onUpdatePageDeleteRow(visibleAcademicYears.length)}
      />
    </Container>
  );
}

// ----------------------------------------------------------------------

type SummaryCardProps = {
  icon: 'solar:calendar-date-bold' | 'solar:check-circle-bold' | 'solar:clock-circle-bold';
  label: string;
  value: number;
  color: string;
};

function SummaryCard({ icon, label, value, color }: SummaryCardProps) {
  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            display: 'grid',
            borderRadius: 1.5,
            color,
            placeItems: 'center',
            bgcolor: 'background.neutral',
          }}
        >
          <RemixIcon icon={icon} width={25} />
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

function getAcademicYearStatus(year: AcademicYear, today: ReturnType<typeof dayjs>) {
  if (!year.start_date || !year.end_date) {
    return { value: 'not_set', label: 'ยังไม่กำหนด', color: 'default' } as const;
  }

  if (today.isBefore(dayjs(year.start_date), 'day')) {
    return { value: 'upcoming', label: 'ยังไม่เริ่ม', color: 'info' } as const;
  }

  if (today.isAfter(dayjs(year.end_date), 'day')) {
    return { value: 'ended', label: 'สิ้นสุดแล้ว', color: 'default' } as const;
  }

  return { value: 'current', label: 'ปัจจุบัน', color: 'success' } as const;
}

function formatThaiDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}
