'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
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
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import CircularProgress from '@mui/material/CircularProgress';

import { formatThaiDateTime } from 'src/utils/timezone';

type AuditItem = {
  id: string;
  actor_id: string | null;
  actor_username: string | null;
  actor_role: string | null;
  category: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  result: 'success' | 'failure' | 'denied';
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const categoryLabels: Record<string, string> = {
  authentication: 'เข้าสู่ระบบ',
  authorization: 'สิทธิ์เข้าถึง',
  account: 'บัญชีผู้ใช้',
  download: 'ดาวน์โหลด',
  admin: 'ผู้ดูแลระบบ',
};

const resultLabels = {
  success: 'สำเร็จ',
  failure: 'ไม่สำเร็จ',
  denied: 'ปฏิเสธสิทธิ์',
};

const resultColors = {
  success: 'success',
  failure: 'error',
  denied: 'warning',
} as const;

export function SecurityAuditView() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [category, setCategory] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(category && { category }),
        ...(result && { result }),
      });
      const response = await fetch(`/api/security-audit?${params}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [category, page, pageSize, result]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Container maxWidth={false} sx={{ py: { xs: 4, md: 6 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography component="h1" variant="h3">
          บันทึกความปลอดภัย
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          ตรวจสอบการเข้าสู่ระบบ การใช้สิทธิ์ และกิจกรรมสำคัญของระบบ
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          select
          label="ประเภทเหตุการณ์"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">ทั้งหมด</MenuItem>
          {Object.entries(categoryLabels).map(([value, label]) => (
            <MenuItem key={value} value={value}>{label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="ผลลัพธ์"
          value={result}
          onChange={(event) => {
            setResult(event.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">ทั้งหมด</MenuItem>
          {Object.entries(resultLabels).map(([value, label]) => (
            <MenuItem key={value} value={value}>{label}</MenuItem>
          ))}
        </TextField>
      </Stack>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>วันเวลา</TableCell>
                <TableCell>ผู้กระทำ</TableCell>
                <TableCell>เหตุการณ์</TableCell>
                <TableCell>เป้าหมาย</TableCell>
                <TableCell>ผลลัพธ์</TableCell>
                <TableCell>IP Address</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">ยังไม่มีบันทึกความปลอดภัย</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow
                    hover
                    key={item.id}
                    onClick={() => setSelected(item)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatThaiDateTime(item.created_at)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.actor_username || 'ไม่ระบุตัวตน'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.actor_role || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.action}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {categoryLabels[item.category] || item.category}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {item.target_type || '-'}
                      {item.target_id && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {item.target_id}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={resultColors[item.result]}
                        label={resultLabels[item.result]}
                      />
                    </TableCell>
                    <TableCell>{item.ip_address || '-'}</TableCell>
                  </TableRow>
                ))
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

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="md">
        <DialogTitle>รายละเอียดบันทึกความปลอดภัย</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={2}>
              <Typography><strong>เหตุการณ์:</strong> {selected.action}</Typography>
              <Typography><strong>Request ID:</strong> {selected.request_id || '-'}</Typography>
              <Typography><strong>User Agent:</strong> {selected.user_agent || '-'}</Typography>
              <Box>
                <Typography sx={{ mb: 1 }}><strong>Metadata</strong></Typography>
                <Box
                  component="pre"
                  sx={{
                    p: 2,
                    m: 0,
                    borderRadius: 1,
                    bgcolor: 'background.neutral',
                    overflow: 'auto',
                    fontSize: 13,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(selected.metadata ?? {}, null, 2)}
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}

