'use client';

import type { MarketplaceCategory } from '../../shared/types';

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
import Tooltip from '@mui/material/Tooltip';
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
  RiPriceTag3Line,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { getCategories } from '../../shared/api';

type CategoryForm = {
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyForm: CategoryForm = {
  name: '',
  description: '',
  sortOrder: '0',
  isActive: true,
};

async function parseMutation(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'ไม่สามารถดำเนินการได้');
  return result;
}

export function MarketplaceCategoryManagementView() {
  const { user } = useAuthContext();
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MarketplaceCategory | null>(null);
  const [deleting, setDeleting] = useState<MarketplaceCategory | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getCategories(true);
      setCategories(result.categories);
      if (result.setupRequired) {
        setError('กรุณารัน Marketplace schema เวอร์ชันล่าสุดใน Supabase');
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดหมวดหมู่ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'master_admin') loadCategories();
  }, [loadCategories, user?.role]);

  if (user?.role !== 'master_admin') {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">เมนูหมวดหมู่สำหรับ Super Admin เท่านั้น</Alert>
      </Box>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      sortOrder: String((categories.at(-1)?.sort_order ?? 0) + 10),
    });
    setDialogOpen(true);
  };

  const openEdit = (category: MarketplaceCategory) => {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description ?? '',
      sortOrder: String(category.sort_order),
      isActive: category.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(
        editing
          ? `/api/marketplace/categories/${editing.id}`
          : '/api/marketplace/categories',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            sortOrder: Number(form.sortOrder),
            isActive: form.isActive,
          }),
        }
      );
      await parseMutation(response);
      setDialogOpen(false);
      await loadCategories();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'บันทึกหมวดหมู่ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/marketplace/categories/${deleting.id}`, {
        method: 'DELETE',
      });
      await parseMutation(response);
      setDeleting(null);
      await loadCategories();
    } catch (deleteError) {
      setDeleting(null);
      setError(deleteError instanceof Error ? deleteError.message : 'ลบหมวดหมู่ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2.5, md: 4 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <RiPriceTag3Line size={30} />
            <Typography component="h1" variant="h3">
              หมวดหมู่
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            จัดการหมวดหมู่ที่ใช้กับสินค้าใน eKru Marketplace
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<RiAddLine />} onClick={openCreate}>
          เพิ่มหมวดหมู่
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
                  <TableCell />
                  <TableCell>หมวดหมู่</TableCell>
                  <TableCell align="center">ลำดับ</TableCell>
                  <TableCell align="center">สถานะ</TableCell>
                  <TableCell align="right">จัดการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id} hover>
                    <TableCell width={80}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          display: 'grid',
                          borderRadius: 2,
                          placeItems: 'center',
                          color: 'primary.main',
                          bgcolor: 'primary.lighter',
                        }}
                      >
                        <RiPriceTag3Line size={20} />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2">{category.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {category.description || 'ไม่มีคำอธิบาย'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" width={120}>
                      <Typography variant="body2">ลำดับ {category.sort_order}</Typography>
                    </TableCell>
                    <TableCell align="center" width={130}>
                      <Chip
                        label={category.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        color={category.is_active ? 'success' : 'default'}
                        size="small"
                        variant="soft"
                      />
                    </TableCell>
                    <TableCell align="right" width={110}>
                      <Tooltip title="แก้ไข">
                        <IconButton onClick={() => openEdit(category)}>
                          <RiEditLine size={19} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="ลบ">
                        <IconButton color="error" onClick={() => setDeleting(category)}>
                          <RiDeleteBinLine size={19} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!categories.length && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 10, textAlign: 'center' }}>
                      <Typography variant="h6">ยังไม่มีหมวดหมู่</Typography>
                      <Typography color="text.secondary">เริ่มต้นด้วยการเพิ่มหมวดหมู่ใหม่</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              required
              label="ชื่อหมวดหมู่"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
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
              <Box>
                <Typography variant="subtitle2">เปิดใช้งาน</Typography>
                <Typography variant="caption" color="text.secondary">
                  แสดงหมวดหมู่นี้ในหน้าร้านและฟอร์มลงสินค้า
                </Typography>
              </Box>
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
            disabled={form.name.trim().length < 2}
            onClick={save}
          >
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>ยืนยันการลบหมวดหมู่</DialogTitle>
        <DialogContent>
          <Typography>
            ต้องการลบหมวดหมู่ “{deleting?.name}” หรือไม่? หมวดหมู่ที่มีสินค้าใช้งานอยู่จะไม่สามารถลบได้
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleting(null)}>
            ยกเลิก
          </Button>
          <Button color="error" variant="contained" loading={saving} onClick={remove}>
            ลบหมวดหมู่
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
