'use client';

import type { LegalDocumentType, MarketplaceLegalDocument } from '../../legal/types';

import dayjs from 'dayjs';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
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
import TablePagination from '@mui/material/TablePagination';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { fDateTime } from 'src/utils/format-time';
import { formatBangkokDateTimeInput } from 'src/utils/timezone';

import { Editor } from 'src/components/editor';
import {
  RiAddLine,
  RiEditLine,
  RiFileTextLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import {
  LEGAL_DOCUMENT_TYPES,
  LEGAL_DOCUMENT_USAGE,
  LEGAL_DOCUMENT_LABELS,
} from '../../legal/types';

type LegalForm = {
  documentType: LegalDocumentType;
  title: string;
  summary: string;
  contentHtml: string;
  version: string;
  status: 'draft' | 'published';
  effectiveAt: string;
};

const initialForm: LegalForm = {
  documentType: 'terms_of_service',
  title: '',
  summary: '',
  contentHtml: '<p></p>',
  version: '1.0',
  status: 'draft',
  effectiveAt: '',
};

const PUBLIC_PATHS: Record<LegalDocumentType, string> = {
  terms_of_service: paths.legal.termsOfService,
  seller_agreement: paths.legal.sellerAgreement,
  privacy_policy: paths.legal.privacyPolicy,
  copyright_takedown: paths.legal.copyrightTakedown,
  refund_policy: paths.legal.refundPolicy,
  cookie_policy: paths.legal.cookiePolicy,
  digital_product_license: paths.legal.digitalProductLicense,
  payment_payout_policy: paths.legal.paymentPayoutPolicy,
  product_content_policy: paths.legal.productContentPolicy,
  complaint_dispute_policy: paths.legal.complaintDisputePolicy,
  child_data_policy: paths.legal.childDataPolicy,
  data_processing_agreement: paths.legal.dataProcessingAgreement,
  subscription_policy: paths.legal.subscriptionPolicy,
  product_submission_terms: paths.legal.productSubmissionTerms,
};

async function parseResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'ไม่สามารถดำเนินการได้');
  return result;
}

function toLocalDateTime(value: string | null) {
  return formatBangkokDateTimeInput(value);
}

export function MarketplaceLegalDocumentManagementView() {
  const { user } = useAuthContext();
  const [items, setItems] = useState<MarketplaceLegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providerDisplayName, setProviderDisplayName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<MarketplaceLegalDocument | null>(null);
  const [deleting, setDeleting] = useState<MarketplaceLegalDocument | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<LegalForm>(initialForm);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await parseResponse(
        await fetch('/api/marketplace/legal-documents?all=1', { cache: 'no-store' })
      );
      setItems(result.items);
      if (result.setupRequired) setError('กรุณารัน Marketplace schema เวอร์ชันล่าสุดใน Supabase');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดเอกสารไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'master_admin' || user?.role === 'super_admin') load();
  }, [load, user?.role]);

  useEffect(() => {
    if (user?.role !== 'master_admin' && user?.role !== 'super_admin') return;
    fetch('/api/marketplace/admin/provider-settings', { cache: 'no-store' })
      .then(parseResponse)
      .then((result) => {
        const settings = result.settings as {
          providerType: 'individual' | 'company';
          firstName: string;
          lastName: string;
          companyName: string;
        };
        setProviderDisplayName(
          settings.providerType === 'company'
            ? settings.companyName
            : `${settings.firstName} ${settings.lastName}`.trim()
        );
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลผู้ให้บริการไม่สำเร็จ')
      );
  }, [user?.role]);

  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(items.length / rowsPerPage) - 1);
    setPage((current) => Math.min(current, lastPage));
  }, [items.length, rowsPerPage]);

  if (user?.role !== 'master_admin' && user?.role !== 'super_admin') {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">เมนูนี้สำหรับ Super Admin เท่านั้น</Alert>
      </Box>
    );
  }

  const missingTypes = LEGAL_DOCUMENT_TYPES.filter(
    (type) => !items.some((item) => item.document_type === type)
  );
  const paginatedItems = items.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...initialForm, documentType: missingTypes[0] ?? 'terms_of_service' });
    setDialogOpen(true);
  };

  const openEdit = (item: MarketplaceLegalDocument) => {
    setEditing(item);
    setForm({
      documentType: item.document_type,
      title: item.title,
      summary: item.summary ?? '',
      contentHtml: item.content_html,
      version: item.version,
      status: item.status,
      effectiveAt: toLocalDateTime(item.effective_at),
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
            ? `/api/marketplace/legal-documents/${editing.id}`
            : '/api/marketplace/legal-documents',
          {
            method: editing ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          }
        )
      );
      setDialogOpen(false);
      setMessage(
        form.status === 'published' ? 'บันทึกและเผยแพร่เอกสารแล้ว' : 'บันทึกเอกสารฉบับร่างแล้ว'
      );
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'บันทึกเอกสารไม่สำเร็จ');
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
        await fetch(`/api/marketplace/legal-documents/${deleting.id}`, { method: 'DELETE' })
      );
      setDeleting(null);
      setMessage('ลบเอกสารแล้ว สามารถสร้างประเภทนี้ใหม่ได้');
      await load();
    } catch (deleteError) {
      setDeleting(null);
      setError(deleteError instanceof Error ? deleteError.message : 'ลบเอกสารไม่สำเร็จ');
    } finally {
      setSaving(false);
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
            <RiFileTextLine size={30} />
            <Typography component="h1" variant="h3">
              เอกสารข้อกำหนด Marketplace
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            ศูนย์กลางเอกสารทุกจุดของระบบ แก้เนื้อหาที่นี่ครั้งเดียวแล้วเผยแพร่ไปยังหน้าที่เกี่ยวข้อง
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<RiAddLine />}
          disabled={!missingTypes.length}
          onClick={openCreate}
        >
          เพิ่มเอกสาร
        </Button>
      </Stack>

      <Alert
        severity="info"
        sx={{ mt: 3 }}
        action={
          <Button color="inherit" size="small" href={paths.marketplace.platformSettings}>
            แก้ไขข้อมูล
          </Button>
        }
      >
        ข้อมูลผู้ให้บริการเป็นค่ากลางของระบบ เมื่อแก้ไขแล้วเอกสารทุกฉบับจะอัปเดตตามอัตโนมัติ
        กรุณาให้ผู้เชี่ยวชาญด้านกฎหมายตรวจเนื้อหาก่อนเปลี่ยนสถานะเป็น “เผยแพร่”
      </Alert>
      {!!error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {!!message && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setMessage('')}>
          {message}
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
                  <TableCell>เอกสาร</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>ใช้ที่ส่วนใด</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>ผู้ให้บริการ</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>เวอร์ชัน / วันที่มีผล</TableCell>
                  <TableCell align="center">สถานะ</TableCell>
                  <TableCell align="right" sx={{ minWidth: 160 }}>
                    จัดการ
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedItems.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2">{item.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {LEGAL_DOCUMENT_LABELS[item.document_type]}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {LEGAL_DOCUMENT_USAGE[item.document_type]}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {item.provider_name || 'ยังไม่ระบุชื่อ'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.provider_type === 'company' ? 'นิติบุคคล / บริษัท' : 'บุคคลธรรมดา'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">เวอร์ชัน {item.version}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.effective_at
                          ? fDateTime(item.effective_at, 'DD MMM YYYY HH:mm')
                          : 'ยังไม่กำหนด'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={item.status === 'published' ? 'เผยแพร่' : 'ฉบับร่าง'}
                        color={item.status === 'published' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {item.status === 'published' && (
                        <IconButton
                          component="a"
                          href={PUBLIC_PATHS[item.document_type]}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="ดูหน้าสาธารณะ"
                        >
                          <RiExternalLinkLine />
                        </IconButton>
                      )}
                      <IconButton onClick={() => openEdit(item)} aria-label="แก้ไข">
                        <RiEditLine />
                      </IconButton>
                      <IconButton color="error" onClick={() => setDeleting(item)} aria-label="ลบ">
                        <RiDeleteBinLine />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {!loading && (
          <TablePagination
            component="div"
            count={items.length}
            page={page}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[5, 10, 25]}
            labelRowsPerPage="แถวต่อหน้า"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setPage(0);
            }}
          />
        )}
      </Card>

      <Dialog
        fullWidth
        maxWidth="lg"
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
      >
        <DialogTitle>{editing ? 'แก้ไขเอกสารข้อกำหนด' : 'เพิ่มเอกสารข้อกำหนด'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Alert severity="info">
              เอกสารนี้ใช้ที่: {LEGAL_DOCUMENT_USAGE[form.documentType]}
              <br />
              หน้าสาธารณะและจุดยอมรับข้อตกลงจะแสดงเฉพาะสถานะ “เผยแพร่” เท่านั้น
            </Alert>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                select
                fullWidth
                disabled={!!editing}
                label="ประเภทเอกสาร"
                value={form.documentType}
                onChange={(event) =>
                  setForm({ ...form, documentType: event.target.value as LegalDocumentType })
                }
              >
                {(editing ? LEGAL_DOCUMENT_TYPES : missingTypes).map((type) => (
                  <MenuItem key={type} value={type}>
                    {LEGAL_DOCUMENT_LABELS[type]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                label="สถานะ"
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status: event.target.value as LegalForm['status'],
                  })
                }
              >
                <MenuItem value="draft">ฉบับร่าง</MenuItem>
                <MenuItem value="published">เผยแพร่</MenuItem>
              </TextField>
            </Stack>
            <TextField
              required
              fullWidth
              label="ชื่อเอกสาร"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="คำอธิบายย่อ"
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                เนื้อหาเอกสาร *
              </Typography>
              <Editor
                key={editing?.id ?? form.documentType}
                value={form.contentHtml}
                onChange={(contentHtml) => setForm((current) => ({ ...current, contentHtml }))}
                placeholder="เขียนรายละเอียดข้อกำหนด..."
                sx={{ minHeight: 420 }}
              />
            </Box>

            <Alert severity={providerDisplayName ? 'success' : 'warning'}>
              {providerDisplayName
                ? `เอกสารนี้จะใช้ข้อมูลผู้ให้บริการส่วนกลาง: ${providerDisplayName}`
                : 'กรุณาบันทึกข้อมูลผู้ให้บริการส่วนกลางก่อนเผยแพร่เอกสาร'}
            </Alert>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                required
                fullWidth
                label="เวอร์ชัน"
                value={form.version}
                onChange={(event) => setForm({ ...form, version: event.target.value })}
                helperText="เช่น 1.0 หรือ 2026.07"
              />
              <DatePicker
                label="วันที่เริ่มมีผล"
                value={form.effectiveAt ? dayjs(form.effectiveAt) : null}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    effectiveAt: value?.isValid() ? value.format('YYYY-MM-DD') : '',
                  }))
                }
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: form.status === 'published',
                  },
                }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setDialogOpen(false)}>
            ยกเลิก
          </Button>
          <Button variant="contained" loading={saving} onClick={save}>
            {form.status === 'published' ? 'บันทึกและเผยแพร่' : 'บันทึกฉบับร่าง'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleting} onClose={() => !saving && setDeleting(null)}>
        <DialogTitle>ลบเอกสารนี้?</DialogTitle>
        <DialogContent>
          <Typography>
            หน้าสาธารณะของ “{deleting?.title}” จะไม่สามารถเปิดอ่านได้จนกว่าจะสร้างและเผยแพร่ใหม่
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>ยกเลิก</Button>
          <Button color="error" variant="contained" loading={saving} onClick={remove}>
            ลบเอกสาร
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
