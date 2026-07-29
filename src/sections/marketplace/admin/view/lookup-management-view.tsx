'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import {
  RiAddLine,
  RiEditLine,
  RiDeleteBinLine,
  RiSettings3Line,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

type LookupItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  delivery_mode?: string;
  pricing_mode?: string;
  review_scope?: string;
  finance_scope?: string;
  reason_scope?: string;
  sort_order: number;
  is_active: boolean;
};

type Props = {
  title: string;
  description: string;
  endpoint: string;
  behaviorKey?:
    | 'delivery_mode'
    | 'pricing_mode'
    | 'review_scope'
    | 'finance_scope'
    | 'reason_scope';
  behaviorLabel?: string;
  behaviorOptions?: Array<{ value: string; label: string }>;
};

const initialForm = {
  code: '',
  name: '',
  description: '',
  behavior: '',
  sortOrder: '0',
  isActive: true,
};

async function parseResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'ไม่สามารถดำเนินการได้');
  return result;
}

export function MarketplaceLookupManagementView({
  title,
  description,
  endpoint,
  behaviorKey,
  behaviorLabel,
  behaviorOptions,
}: Props) {
  const { user } = useAuthContext();
  const [items, setItems] = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<LookupItem | null>(null);
  const [deleting, setDeleting] = useState<LookupItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...initialForm, behavior: behaviorOptions?.[0]?.value ?? '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await parseResponse(await fetch(`${endpoint}?all=1`));
      setItems(result.items);
      if (result.setupRequired) setError('กรุณารัน Marketplace schema เวอร์ชันล่าสุด');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : `โหลด${title}ไม่สำเร็จ`);
    } finally {
      setLoading(false);
    }
  }, [endpoint, title]);

  useEffect(() => {
    if (user?.role === 'master_admin') load();
  }, [load, user?.role]);

  if (user?.role !== 'master_admin') {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">เมนูนี้สำหรับ Super Admin เท่านั้น</Alert>
      </Box>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...initialForm,
      behavior: behaviorOptions?.[0]?.value ?? '',
      sortOrder: String((items.at(-1)?.sort_order ?? 0) + 10),
    });
    setDialogOpen(true);
  };

  const openEdit = (item: LookupItem) => {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description ?? '',
      behavior: (behaviorKey && item[behaviorKey]) || behaviorOptions?.[0]?.value || '',
      sortOrder: String(item.sort_order),
      isActive: item.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await parseResponse(
        await fetch(editing ? `${endpoint}/${editing.id}` : endpoint, {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, sortOrder: Number(form.sortOrder) }),
        })
      );
      setDialogOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `บันทึก${title}ไม่สำเร็จ`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await parseResponse(await fetch(`${endpoint}/${deleting.id}`, { method: 'DELETE' }));
      setDeleting(null);
      await load();
    } catch (deleteError) {
      setDeleting(null);
      setError(deleteError instanceof Error ? deleteError.message : `ลบ${title}ไม่สำเร็จ`);
    } finally {
      setSaving(false);
    }
  };

  const behaviorName = (value: string | undefined) =>
    behaviorOptions?.find((option) => option.value === value)?.label ?? value;

  return (
    <Box sx={{ p: { xs: 2.5, md: 4 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
      >
        <Box>
          <Typography component="h1" variant="h3">
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<RiAddLine />} onClick={openCreate}>
          เพิ่ม{title}
        </Button>
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mt: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card sx={{ mt: 3 }}>
        {loading ? (
          <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{title}</TableCell>
                  {behaviorKey && <TableCell>{behaviorLabel}</TableCell>}
                  <TableCell align="center">ลำดับ</TableCell>
                  <TableCell align="center">สถานะ</TableCell>
                  <TableCell align="right">จัดการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                          sx={{
                            width: 42,
                            height: 42,
                            display: 'grid',
                            borderRadius: 2,
                            placeItems: 'center',
                            color: 'primary.main',
                            bgcolor: 'primary.lighter',
                          }}
                        >
                          <RiSettings3Line size={20} />
                        </Box>
                        <Box>
                          <Typography variant="subtitle2">{item.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.code} · {item.description || 'ไม่มีคำอธิบาย'}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    {behaviorKey && <TableCell>{behaviorName(item[behaviorKey])}</TableCell>}
                    <TableCell align="center">{item.sort_order}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={item.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        color={item.is_active ? 'success' : 'default'}
                        size="small"
                        variant="soft"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={() => openEdit(item)}>
                        <RiEditLine size={19} />
                      </IconButton>
                      <IconButton color="error" onClick={() => setDeleting(item)}>
                        <RiDeleteBinLine size={19} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!items.length && (
                  <TableRow>
                    <TableCell colSpan={behaviorKey ? 5 : 4} sx={{ py: 10, textAlign: 'center' }}>
                      ยังไม่มีข้อมูล
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? `แก้ไข${title}` : `เพิ่ม${title}`}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              required
              label="รหัส"
              placeholder="ใช้ตัวอักษรอังกฤษ เช่น digital"
              value={form.code}
              onChange={(event) =>
                setForm((current) => ({ ...current, code: event.target.value }))
              }
            />
            <TextField
              required
              label="ชื่อ"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
            {behaviorKey && (
              <TextField
                select
                label={behaviorLabel}
                value={form.behavior}
                onChange={(event) =>
                  setForm((current) => ({ ...current, behavior: event.target.value }))
                }
              >
                {behaviorOptions?.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              multiline
              minRows={3}
              label="คำอธิบาย"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
            <TextField
              type="number"
              label="ลำดับการแสดง"
              value={form.sortOrder}
              slotProps={{ htmlInput: { min: 0 } }}
              onChange={(event) =>
                setForm((current) => ({ ...current, sortOrder: event.target.value }))
              }
            />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">เปิดใช้งาน</Typography>
              <Switch
                checked={form.isActive}
                onChange={(_, checked) =>
                  setForm((current) => ({ ...current, isActive: checked }))
                }
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDialogOpen(false)}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            loading={saving}
            disabled={form.code.trim().length < 2 || form.name.trim().length < 2}
            onClick={save}
          >
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} fullWidth maxWidth="xs">
        <DialogTitle>ยืนยันการลบ</DialogTitle>
        <DialogContent>
          <Typography>
            ต้องการลบ “{deleting?.name}” หรือไม่? ข้อมูลที่มีสินค้าใช้งานอยู่จะไม่สามารถลบได้
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleting(null)}>
            ยกเลิก
          </Button>
          <Button color="error" variant="contained" loading={saving} onClick={remove}>
            ลบ
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
