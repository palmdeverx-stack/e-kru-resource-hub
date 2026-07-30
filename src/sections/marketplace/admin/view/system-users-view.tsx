'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import CircularProgress from '@mui/material/CircularProgress';

import { formatThaiDateTime } from 'src/utils/timezone';

import {
  RiUser3Line,
  RiSearchLine,
  RiUserForbidLine,
  RiShieldUserLine,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

type SystemAccount = {
  id: string;
  source: 'app' | 'marketplace';
  username: string;
  email: string | null;
  display_name: string;
  role: string;
  school_name: string | null;
  is_active: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  has_auth_identity: boolean;
  created_at: string;
};

const roleLabels: Record<string, string> = {
  master_admin: 'Super Admin',
  school_admin: 'ผู้ดูแลโรงเรียน',
  teacher: 'ครู',
  student: 'นักเรียน',
  marketplace_user: 'ผู้ใช้ Marketplace',
};

const roleOptions = Object.entries(roleLabels);

function accountStatus(account: SystemAccount) {
  if (account.is_suspended) return { label: 'ระงับการใช้งาน', color: 'error' as const };
  if (!account.is_active && account.source === 'marketplace') {
    return { label: 'รอยืนยันอีเมล', color: 'warning' as const };
  }
  if (!account.is_active) return { label: 'ปิดใช้งาน', color: 'default' as const };
  return { label: 'ใช้งานได้', color: 'success' as const };
}

export function SystemUsersView() {
  const { user } = useAuthContext();
  const [accounts, setAccounts] = useState<SystemAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<SystemAccount | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchDraft.trim());
      setPage(0);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [searchDraft]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(role && { role }),
        ...(status && { status }),
        ...(search && { search }),
      });
      const response = await fetch(`/api/admin/system-users?${params}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setAccounts(result.accounts ?? []);
      setTotal(result.total ?? 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดบัญชีผู้ใช้งานไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, role, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateSuspension = async () => {
    if (!selected) return;
    const nextSuspended = !selected.is_suspended;
    if (nextSuspended && reason.trim().length < 3) {
      setError('กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/system-users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          source: selected.source,
          isSuspended: nextSuspended,
          reason: nextSuspended ? reason.trim() : '',
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMessage(result.message);
      setSelected(null);
      setReason('');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'เปลี่ยนสถานะบัญชีไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'flex-end' }}
        spacing={2}
        sx={{ mb: 4 }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            บัญชีผู้ใช้งาน Marketplace
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            แสดงเฉพาะบัญชี Marketplace และบัญชี E-KRU ที่มีประวัติใช้งาน Marketplace
          </Typography>
        </Box>
        <Chip
          icon={<RiShieldUserLine />}
          color="primary"
          variant="soft"
          label={`${total.toLocaleString('th-TH')} บัญชี`}
        />
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {!!message && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      <Card variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            fullWidth
            value={searchDraft}
            placeholder="ค้นหาชื่อ ชื่อผู้ใช้ หรืออีเมล"
            onChange={(event) => setSearchDraft(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <RiSearchLine />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            label="ประเภทบัญชี"
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(0);
            }}
            sx={{ minWidth: { md: 210 } }}
          >
            <MenuItem value="">ทุกประเภท</MenuItem>
            {roleOptions.map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="สถานะ"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
            sx={{ minWidth: { md: 190 } }}
          >
            <MenuItem value="">ทุกสถานะ</MenuItem>
            <MenuItem value="active">ใช้งานได้</MenuItem>
            <MenuItem value="suspended">ระงับการใช้งาน</MenuItem>
            <MenuItem value="inactive">ปิดใช้งาน</MenuItem>
            <MenuItem value="unverified">รอยืนยันอีเมล</MenuItem>
          </TextField>
        </Stack>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow>
                <TableCell>ผู้ใช้งาน</TableCell>
                <TableCell>ประเภท</TableCell>
                <TableCell>โรงเรียน/ระบบ</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell>วันที่สร้าง</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 9 }}>
                    <CircularProgress size={34} />
                  </TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 9 }}>
                    <RiUser3Line size={38} />
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      ไม่พบบัญชีผู้ใช้งาน
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => {
                  const currentStatus = accountStatus(account);
                  const isCurrentAccount = account.source === 'app' && account.id === user?.id;
                  return (
                    <TableRow hover key={`${account.source}:${account.id}`}>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar sx={{ width: 38, height: 38 }}>
                            {account.display_name.slice(0, 1).toUpperCase()}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" noWrap>
                              {account.display_name}
                              {isCurrentAccount ? ' (คุณ)' : ''}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              @{account.username}
                              {account.email ? ` · ${account.email}` : ''}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {roleLabels[account.role] ?? account.role}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {account.source === 'marketplace' ? 'Marketplace' : 'ระบบโรงเรียน'}
                        </Typography>
                      </TableCell>
                      <TableCell>{account.school_name || 'E-KRU Marketplace'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={currentStatus.color}
                          variant="soft"
                          label={currentStatus.label}
                        />
                        {account.is_suspended && account.suspended_reason && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            sx={{ mt: 0.5, maxWidth: 220 }}
                          >
                            {account.suspended_reason}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatThaiDateTime(account.created_at)}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          color={account.is_suspended ? 'success' : 'error'}
                          variant={account.is_suspended ? 'contained' : 'outlined'}
                          disabled={isCurrentAccount}
                          startIcon={
                            account.is_suspended ? <RiCheckboxCircleLine /> : <RiUserForbidLine />
                          }
                          onClick={() => {
                            setError('');
                            setReason('');
                            setSelected(account);
                          }}
                        >
                          {account.is_suspended ? 'เปิดใช้งาน' : 'ระงับ'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[10, 20, 50, 100]}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(0);
          }}
          labelRowsPerPage="แถวต่อหน้า"
        />
      </Card>

      <Dialog
        open={Boolean(selected)}
        onClose={() => !saving && setSelected(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {selected?.is_suspended ? 'เปิดใช้งานบัญชี' : 'ระงับบัญชีผู้ใช้งาน'}
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={2.5}>
              <Alert severity={selected.is_suspended ? 'success' : 'warning'}>
                {selected.is_suspended
                  ? `บัญชี @${selected.username} จะสามารถเข้าสู่ระบบได้อีกครั้ง`
                  : `บัญชี @${selected.username} จะไม่สามารถเข้าสู่ระบบได้จนกว่าจะเปิดใช้งาน`}
              </Alert>
              {!selected.is_suspended && (
                <TextField
                  required
                  autoFocus
                  multiline
                  minRows={3}
                  label="เหตุผลที่ระงับ"
                  value={reason}
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                  helperText={`${reason.length}/500 ตัวอักษร`}
                  onChange={(event) => setReason(event.target.value)}
                />
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" disabled={saving} onClick={() => setSelected(null)}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            color={selected?.is_suspended ? 'success' : 'error'}
            loading={saving}
            disabled={!selected?.is_suspended && reason.trim().length < 3}
            onClick={updateSuspension}
          >
            {selected?.is_suspended ? 'ยืนยันเปิดใช้งาน' : 'ยืนยันระงับบัญชี'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
