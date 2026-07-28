'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDateTime } from 'src/utils/format-time';

import { RemixIcon } from 'src/components/remix-icon';
import { useTable, rowInPage, TablePaginationCustom } from 'src/components/table';

import {
  type ScheduleApproval,
  listScheduleApprovals,
  type ScheduleApprovalListStatus,
} from '../schedule-approvals-actions';

// ----------------------------------------------------------------------

function fullName(person: { first_name: string | null; last_name: string | null } | null) {
  return `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim() || null;
}

function homeroomNames(classroom: ScheduleApproval['classroom']) {
  const names = (classroom?.homeroom_teachers ?? [])
    .map((entry) => fullName(entry.teacher))
    .filter(Boolean);
  return names.length ? names.join(', ') : 'ยังไม่กำหนดครูประจำชั้น';
}

const STATUS_CONTENT = {
  submitted: {
    tabLabel: 'รออนุมัติ',
    listTitle: 'รายการรออนุมัติ',
    statusLabel: 'รอยืนยัน',
    emptyLabel: 'ไม่มีตารางสอนที่รอยืนยัน เมื่อมีการส่งตรวจจะปรากฏที่นี่',
  },
  approved: {
    tabLabel: 'อนุมัติแล้ว',
    listTitle: 'รายการที่อนุมัติแล้ว',
    statusLabel: 'อนุมัติแล้ว',
    emptyLabel: 'ยังไม่มีประวัติตารางสอนที่อนุมัติแล้ว',
  },
  canceled: {
    tabLabel: 'ยกเลิกแล้ว',
    listTitle: 'รายการที่ยกเลิกแล้ว',
    statusLabel: 'ยกเลิกแล้ว',
    emptyLabel: 'ยังไม่มีประวัติตารางสอนที่ยกเลิกการส่ง',
  },
} satisfies Record<
  ScheduleApprovalListStatus,
  { tabLabel: string; listTitle: string; statusLabel: string; emptyLabel: string }
>;

function actionPerson(approval: ScheduleApproval) {
  if (approval.status === 'approved') return approval.approved_by;
  if (approval.status === 'canceled') return approval.canceled_by;
  return approval.submitted_by;
}

function actionDate(approval: ScheduleApproval) {
  if (approval.status === 'approved') return approval.approved_at;
  if (approval.status === 'canceled') return approval.canceled_at;
  return approval.submitted_at;
}

type Props = {
  tracking?: boolean;
  detailBasePath?: string;
};

export function ScheduleApprovalsView({
  tracking = false,
  detailBasePath = paths.admin.scheduleApprovals,
}: Props) {
  const table = useTable({ defaultRowsPerPage: 10 });
  const [status, setStatus] = useState<ScheduleApprovalListStatus>('submitted');
  const [search, setSearch] = useState('');

  const {
    data: approvals = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['schedule-approvals', status],
    queryFn: () => listScheduleApprovals(status),
  });

  const filteredApprovals = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    if (!keyword) return approvals;

    return approvals.filter((approval) =>
      [
        approval.classroom?.grade_level,
        approval.classroom?.name,
        homeroomNames(approval.classroom),
        approval.semester?.academic_year?.year,
        approval.semester?.name,
        fullName(approval.submitted_by),
        fullName(approval.approved_by),
        fullName(approval.canceled_by),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(keyword)
    );
  }, [approvals, search]);

  const visibleApprovals = useMemo(
    () => rowInPage(filteredApprovals, table.page, table.rowsPerPage),
    [filteredApprovals, table.page, table.rowsPerPage]
  );

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Box sx={{ mb: 4 }}>
        <Typography component="h1" variant="h3">
          {tracking ? 'สถานะการลงนามตารางสอน' : 'อนุมัติตารางสอน'}
        </Typography>
        <Typography sx={{ mt: 1, color: 'text.secondary' }}>
          {tracking
            ? 'ตรวจสอบสถานะลายเซ็นของผู้จัดทำและผู้อำนวยการ พร้อมดูรายการย้อนหลัง'
            : 'ตารางสอนที่ฝ่ายจัดตารางสอนส่งมาให้ตรวจสอบและยืนยัน'}
        </Typography>
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
          ไม่สามารถโหลด{STATUS_CONTENT[status].listTitle}ได้
        </Alert>
      )}

      <Card variant="outlined">
        <Tabs
          value={status}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          onChange={(_, value: ScheduleApprovalListStatus) => {
            setStatus(value);
            table.onResetPage();
          }}
          sx={{ px: 3, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          {(Object.keys(STATUS_CONTENT) as ScheduleApprovalListStatus[]).map((itemStatus) => (
            <Tab
              key={itemStatus}
              value={itemStatus}
              label={STATUS_CONTENT[itemStatus].tabLabel}
            />
          ))}
        </Tabs>

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
              {STATUS_CONTENT[status].listTitle}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {isLoading ? 'กำลังโหลด...' : `${filteredApprovals.length} รายการ`}
            </Typography>
          </Box>
          <TextField
            size="small"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              table.onResetPage();
            }}
            placeholder="ค้นหาชั้นเรียน ครู หรือปีการศึกษา"
            aria-label="ค้นหารายการอนุมัติตารางสอน"
            sx={{ width: { xs: 1, sm: 360 } }}
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
          <Table sx={{ minWidth: tracking ? 1250 : 1050 }}>
            <TableHead>
              <TableRow>
                <TableCell>ชั้นเรียน</TableCell>
                <TableCell>ครูประจำชั้น</TableCell>
                <TableCell>ปีการศึกษา/ภาคเรียน</TableCell>
                <TableCell>ผู้ดำเนินการ</TableCell>
                <TableCell>วันที่ดำเนินการ</TableCell>
                {tracking && <TableCell>ผู้จัดทำลงนาม</TableCell>}
                {tracking && <TableCell>ผู้อำนวยการลงนาม</TableCell>}
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={tracking ? 9 : 7}>
                    <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                      <CircularProgress size={28} />
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !filteredApprovals.length && (
                <TableRow>
                  <TableCell
                    colSpan={tracking ? 9 : 7}
                    sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                  >
                    {search
                      ? 'ไม่พบรายการที่ตรงกับคำค้นหา'
                      : STATUS_CONTENT[status].emptyLabel}
                  </TableCell>
                </TableRow>
              )}
              {visibleApprovals.map((approval) => {
                const operatedAt = actionDate(approval);
                return (
                  <TableRow key={approval.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2">
                        ชั้น {approval.classroom?.grade_level ?? ''}{' '}
                        {approval.classroom?.name ?? '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{homeroomNames(approval.classroom)}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        ปีการศึกษา {approval.semester?.academic_year?.year ?? '-'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        ภาคเรียนที่ {approval.semester?.name ?? '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{fullName(actionPerson(approval)) ?? 'ไม่ทราบชื่อ'}</TableCell>
                    <TableCell>
                      {operatedAt ? fDateTime(operatedAt, 'DD/MM/YYYY HH:mm') : '-'}
                    </TableCell>
                    {tracking && (
                      <TableCell>
                        <Chip
                          size="small"
                          variant="soft"
                          color={approval.submitter_signature_url ? 'success' : 'warning'}
                          label={approval.submitter_signature_url ? 'ลงนามแล้ว' : 'ไม่มีลายเซ็น'}
                        />
                      </TableCell>
                    )}
                    {tracking && (
                      <TableCell>
                        <Chip
                          size="small"
                          variant="soft"
                          color={approval.signature_url ? 'success' : 'warning'}
                          label={
                            approval.signature_url
                              ? 'ลงนามแล้ว'
                              : approval.status === 'canceled'
                                ? 'ยกเลิกก่อนลงนาม'
                                : 'รอลงนาม'
                          }
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Chip
                        size="small"
                        variant="soft"
                        color={
                          approval.status === 'approved'
                            ? 'success'
                            : approval.status === 'canceled'
                              ? 'default'
                              : 'warning'
                        }
                        label={STATUS_CONTENT[approval.status].statusLabel}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        component={RouterLink}
                        href={`${detailBasePath}/${approval.id}`}
                        size="small"
                        variant="outlined"
                        startIcon={<RemixIcon icon="solar:document-text-bold" />}
                      >
                        {tracking
                          ? 'ดูรายละเอียด'
                          : approval.status === 'submitted'
                            ? 'ตรวจสอบ'
                            : 'ดูตารางสอน'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePaginationCustom
          page={table.page}
          count={filteredApprovals.length}
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
    </Container>
  );
}
