'use client';

import type { MarketplaceLandingBanner } from '../../shared/landing-banner-types';

import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
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

import { RiAddLine, RiEditLine, RiImageLine, RiDeleteBinLine } from 'src/components/remix-icon';

import { LandingBannerDialog } from './landing-banner-dialog';

async function parseResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'ไม่สามารถดำเนินการได้');
  return result;
}

function displayPeriod(item: MarketplaceLandingBanner) {
  if (!item.starts_at && !item.ends_at) return 'แสดงตลอดเวลา';
  return `${item.starts_at ? formatThaiDateTime(item.starts_at) : 'ทันที'} – ${
    item.ends_at ? formatThaiDateTime(item.ends_at) : 'ไม่กำหนด'
  }`;
}

export function LandingBannerManagementView() {
  const [items, setItems] = useState<MarketplaceLandingBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MarketplaceLandingBanner | null>(null);
  const [deleting, setDeleting] = useState<MarketplaceLandingBanner | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await parseResponse(
        await fetch('/api/marketplace/landing-banners?all=1', { cache: 'no-store' })
      );
      setItems(result.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดแบนเนอร์ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    setError('');
    try {
      await parseResponse(
        await fetch(`/api/marketplace/landing-banners/${deleting.id}`, { method: 'DELETE' })
      );
      setDeleting(null);
      setMessage('ลบแบนเนอร์แล้ว');
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'ลบแบนเนอร์ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'center' }}
        spacing={2}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <RiImageLine size={30} />
            <Typography component="h1" variant="h3">
              แบนเนอร์หน้าหลัก
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Hero เดิมเป็นสไลด์แรกเสมอ และรูปที่เปิดใช้งานจะแสดงเป็นสไลด์ถัดไป
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<RiAddLine />}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          เพิ่มแบนเนอร์
        </Button>
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
      {!!message && (
        <Alert severity="success" sx={{ mt: 3 }}>
          {message}
        </Alert>
      )}

      <Card sx={{ mt: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ภาพและชื่อ</TableCell>
                <TableCell>ช่วงเวลา</TableCell>
                <TableCell>ลำดับ</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : items.length ? (
                items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ width: 96, height: 46, position: 'relative', flexShrink: 0 }}>
                          <Image
                            fill
                            unoptimized
                            src={item.desktop_image_url}
                            alt=""
                            sizes="96px"
                            style={{ objectFit: 'cover', borderRadius: 8 }}
                          />
                        </Box>
                        <Box>
                          <Typography variant="subtitle2">{item.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            แก้ไข {formatThaiDateTime(item.updated_at)}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{displayPeriod(item)}</TableCell>
                    <TableCell>{item.sort_order}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={item.is_active ? 'success' : 'default'}
                        label={item.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        aria-label="แก้ไข"
                        onClick={() => {
                          setEditing(item);
                          setDialogOpen(true);
                        }}
                      >
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
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    ยังไม่มีแบนเนอร์ หน้าหลักจะแสดงเฉพาะ Hero เดิม
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <LandingBannerDialog
        open={dialogOpen}
        banner={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={async (successMessage) => {
          setMessage(successMessage);
          setError('');
          await load();
        }}
      />

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>ลบแบนเนอร์นี้หรือไม่</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            แบนเนอร์ “{deleting?.title}” และรูปใน Storage จะถูกลบถาวร
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleting(null)}>
            ยกเลิก
          </Button>
          <Button color="error" variant="contained" loading={saving} onClick={remove}>
            ลบแบนเนอร์
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
