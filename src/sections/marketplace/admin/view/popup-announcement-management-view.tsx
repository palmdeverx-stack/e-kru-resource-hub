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
import { Container } from '@mui/material';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { formatThaiDateTime } from 'src/utils/timezone';

import {
  RiAddLine,
  RiEditLine,
  RiDeleteBinLine,
  RiNotification3Line,
} from 'src/components/remix-icon';

import {
  type PopupAnnouncement,
  PopupAnnouncementDialog,
  ANNOUNCEMENT_AUDIENCE_LABELS,
} from './popup-announcement-dialog';

async function parseResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'ไม่สามารถดำเนินการได้');
  return result;
}

export function PopupAnnouncementManagementView() {
  const [items, setItems] = useState<PopupAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PopupAnnouncement | null>(null);
  const [deleting, setDeleting] = useState<PopupAnnouncement | null>(null);

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
    setDialogOpen(true);
  };

  const openEdit = (item: PopupAnnouncement) => {
    setEditing(item);
    setDialogOpen(true);
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

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3 } }}>
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
              ประกาศ
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

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mt: 3 }}>
          {message}
        </Alert>
      )}

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
                    <TableCell>{ANNOUNCEMENT_AUDIENCE_LABELS[item.audience]}</TableCell>
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

      <PopupAnnouncementDialog
        open={dialogOpen}
        announcement={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={async (successMessage) => {
          setMessage(successMessage);
          setError('');
          await load();
        }}
      />

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>ลบประกาศนี้หรือไม่</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            ประกาศ “{deleting?.title}” จะหยุดแสดงและไม่สามารถกู้คืนได้
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleting(null)}>
            ยกเลิก
          </Button>
          <Button color="error" variant="contained" loading={saving} onClick={remove}>
            ลบประกาศ
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
