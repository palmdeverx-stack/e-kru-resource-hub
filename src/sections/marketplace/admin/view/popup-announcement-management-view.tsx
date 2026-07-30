'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
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
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { formatThaiDateTime, formatBangkokDateTimeInput } from 'src/utils/timezone';

import {
  RiAddLine,
  RiEditLine,
  RiImageAddLine,
  RiDeleteBinLine,
  RiNotification3Line,
} from 'src/components/remix-icon';

type Audience = 'all' | 'authenticated' | 'guests' | 'roles';
type AppRole = 'master_admin' | 'school_admin' | 'teacher' | 'student' | 'marketplace_user';

type Announcement = {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  link_url: string | null;
  button_label: string | null;
  audience: Audience;
  role_targets: AppRole[];
  priority: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
};

type FormState = {
  title: string;
  message: string;
  imageUrl: string;
  linkUrl: string;
  buttonLabel: string;
  audience: Audience;
  roleTargets: AppRole[];
  priority: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

const EMPTY_FORM: FormState = {
  title: '',
  message: '',
  imageUrl: '',
  linkUrl: '',
  buttonLabel: '',
  audience: 'all',
  roleTargets: [],
  priority: 0,
  isActive: false,
  startsAt: '',
  endsAt: '',
};

const AUDIENCE_LABELS: Record<Audience, string> = {
  all: 'ทุกคน',
  authenticated: 'ผู้ที่เข้าสู่ระบบ',
  guests: 'ผู้เยี่ยมชม',
  roles: 'เลือกตาม Role',
};

const ROLE_OPTIONS: Array<{ value: AppRole; label: string }> = [
  { value: 'master_admin', label: 'Super Admin' },
  { value: 'school_admin', label: 'ผู้ดูแลโรงเรียน' },
  { value: 'teacher', label: 'ครู' },
  { value: 'student', label: 'นักเรียน' },
  { value: 'marketplace_user', label: 'ผู้ใช้ Marketplace' },
];

async function parseResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'ไม่สามารถดำเนินการได้');
  return result;
}

export function PopupAnnouncementManagementView() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await parseResponse(
        await fetch('/api/marketplace/announcements?all=1', { cache: 'no-store' })
      );
      setItems(result.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดประกาศไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item: Announcement) => {
    setEditing(item);
    setForm({
      title: item.title,
      message: item.message,
      imageUrl: item.image_url ?? '',
      linkUrl: item.link_url ?? '',
      buttonLabel: item.button_label ?? '',
      audience: item.audience,
      roleTargets: item.role_targets ?? [],
      priority: item.priority,
      isActive: item.is_active,
      startsAt: formatBangkokDateTimeInput(item.starts_at),
      endsAt: formatBangkokDateTimeInput(item.ends_at),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await parseResponse(
        await fetch(
          editing
            ? `/api/marketplace/announcements/${editing.id}`
            : '/api/marketplace/announcements',
          {
            method: editing ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...form,
              startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
              endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
            }),
          }
        )
      );
      setDialogOpen(false);
      setMessage(editing ? 'แก้ไขประกาศแล้ว' : 'สร้างประกาศแล้ว');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'บันทึกประกาศไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    setError('');
    try {
      await parseResponse(
        await fetch(`/api/marketplace/announcements/${deleting.id}`, { method: 'DELETE' })
      );
      setDeleting(null);
      setMessage('ลบประกาศแล้ว');
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'ลบประกาศไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const data = new FormData();
      data.set('file', file);
      const result = await parseResponse(
        await fetch('/api/marketplace/announcements/image', { method: 'POST', body: data })
      );
      setForm((current) => ({ ...current, imageUrl: result.url }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2.5, md: 4 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'center' }}
        spacing={2}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <RiNotification3Line size={30} />
            <Typography component="h1" variant="h3">
              Popup Banner ประกาศ
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            จัดการเนื้อหา รูป ช่วงเวลา กลุ่มผู้ชม และลำดับการแสดงประกาศ
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<RiAddLine />} onClick={openCreate}>
          สร้างประกาศ
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mt: 3 }}>{message}</Alert>}

      <Card sx={{ mt: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ประกาศ</TableCell>
                <TableCell>กลุ่มผู้ชม</TableCell>
                <TableCell>ช่วงเวลา</TableCell>
                <TableCell>ลำดับ</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : items.length ? (
                items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        {item.image_url && (
                          <Box
                            component="img"
                            src={item.image_url}
                            alt=""
                            sx={{ width: 64, height: 44, objectFit: 'cover', borderRadius: 1 }}
                          />
                        )}
                        <Box>
                          <Typography variant="subtitle2">{item.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            แก้ไข {formatThaiDateTime(item.updated_at)}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{AUDIENCE_LABELS[item.audience]}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {item.starts_at ? formatThaiDateTime(item.starts_at) : 'แสดงทันที'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ถึง {item.ends_at ? formatThaiDateTime(item.ends_at) : 'ไม่กำหนด'}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.priority}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={item.is_active ? 'success' : 'default'}
                        label={item.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton aria-label="แก้ไข" onClick={() => openEdit(item)}>
                        <RiEditLine />
                      </IconButton>
                      <IconButton color="error" aria-label="ลบ" onClick={() => setDeleting(item)}>
                        <RiDeleteBinLine />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    ยังไม่มีประกาศ
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? 'แก้ไขประกาศ' : 'สร้าง Popup Banner'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <TextField
              required
              label="หัวข้อประกาศ"
              value={form.title}
              inputProps={{ maxLength: 150 }}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
            <TextField
              required
              multiline
              minRows={4}
              label="รายละเอียด"
              value={form.message}
              inputProps={{ maxLength: 3000 }}
              helperText={`${form.message.length}/3,000`}
              onChange={(event) =>
                setForm((current) => ({ ...current, message: event.target.value }))
              }
            />
            {form.imageUrl && (
              <Box
                component="img"
                src={form.imageUrl}
                alt="ตัวอย่าง Banner"
                sx={{ width: 1, maxHeight: 300, objectFit: 'cover', borderRadius: 2 }}
              />
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                component="label"
                variant="outlined"
                loading={uploading}
                startIcon={<RiImageAddLine />}
              >
                อัปโหลดรูป Banner
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    void uploadImage(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </Button>
              {form.imageUrl && (
                <Button
                  color="error"
                  onClick={() => setForm((current) => ({ ...current, imageUrl: '' }))}
                >
                  นำรูปออก
                </Button>
              )}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="ลิงก์ปุ่ม"
                placeholder="/products หรือ https://..."
                value={form.linkUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, linkUrl: event.target.value }))
                }
              />
              <TextField
                fullWidth
                label="ข้อความบนปุ่ม"
                placeholder="ดูรายละเอียด"
                value={form.buttonLabel}
                onChange={(event) =>
                  setForm((current) => ({ ...current, buttonLabel: event.target.value }))
                }
              />
            </Stack>
            <TextField
              select
              label="กลุ่มผู้ชม"
              value={form.audience}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  audience: event.target.value as Audience,
                  roleTargets: event.target.value === 'roles' ? current.roleTargets : [],
                }))
              }
            >
              {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </TextField>
            {form.audience === 'roles' && (
              <TextField
                select
                label="Role ที่เห็นประกาศ"
                value={form.roleTargets}
                slotProps={{ select: { multiple: true } }}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    roleTargets:
                      typeof event.target.value === 'string'
                        ? (event.target.value.split(',') as AppRole[])
                        : (event.target.value as AppRole[]),
                  }))
                }
              >
                {ROLE_OPTIONS.map((role) => (
                  <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>
                ))}
              </TextField>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                type="datetime-local"
                label="เริ่มแสดง"
                value={form.startsAt}
                slotProps={{ inputLabel: { shrink: true } }}
                onChange={(event) =>
                  setForm((current) => ({ ...current, startsAt: event.target.value }))
                }
              />
              <TextField
                fullWidth
                type="datetime-local"
                label="สิ้นสุด"
                value={form.endsAt}
                slotProps={{ inputLabel: { shrink: true } }}
                onChange={(event) =>
                  setForm((current) => ({ ...current, endsAt: event.target.value }))
                }
              />
              <TextField
                type="number"
                label="ลำดับ"
                value={form.priority}
                inputProps={{ min: 0, max: 999 }}
                helperText="มากแสดงก่อน"
                onChange={(event) =>
                  setForm((current) => ({ ...current, priority: Number(event.target.value) }))
                }
                sx={{ width: { sm: 150 } }}
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                />
              }
              label="เปิดใช้งานประกาศ"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
          <Button
            variant="contained"
            loading={saving}
            disabled={uploading || form.title.trim().length < 3 || form.message.trim().length < 3}
            onClick={save}
          >
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>ลบประกาศนี้หรือไม่</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            ประกาศ “{deleting?.title}” จะหยุดแสดงและไม่สามารถกู้คืนได้
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleting(null)}>ยกเลิก</Button>
          <Button color="error" variant="contained" loading={saving} onClick={remove}>ลบประกาศ</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
