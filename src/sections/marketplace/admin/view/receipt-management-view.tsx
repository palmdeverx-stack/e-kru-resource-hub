'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import GlobalStyles from '@mui/material/GlobalStyles';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { formatThaiDateTime } from 'src/utils/timezone';

import { Logo } from 'src/components/logo';
import {
  RiEyeLine,
  RiSearchLine,
  RiPrinterLine,
  RiReceiptLine,
  RiCloseCircleLine,
  RiCheckboxCircleLine,
} from 'src/components/remix-icon';

import { formatPrice } from '../../shared/api';

type ReceiptItem = {
  orderId: string;
  sellerName: string;
  title: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
};

type Receipt = {
  is_template?: boolean;
  id: string;
  payment_session_id: string;
  receipt_number: string;
  status: 'issued' | 'void';
  amount: number;
  currency: string;
  payment_method: 'promptpay' | 'stripe' | 'free';
  transaction_reference: string | null;
  items_snapshot: ReceiptItem[];
  buyer_name: string;
  buyer_email: string | null;
  buyer_tax_id: string | null;
  buyer_address: string | null;
  provider_name: string;
  provider_tax_id: string | null;
  provider_address: string | null;
  provider_email: string | null;
  notes: string | null;
  issued_at: string;
  voided_at: string | null;
  void_reason: string | null;
};

type PaymentItem = {
  id: string;
  buyer_id: string;
  amount: number;
  currency: string;
  payment_method: 'promptpay' | 'stripe' | 'free';
  reviewed_at: string | null;
  created_at: string;
  buyer: { id: string; name: string; email: string | null };
  orders: Array<{
    id: string;
    status: string;
    paid_at: string | null;
    seller?: { display_name?: string | null } | null;
    items?: Array<{ title: string; unit_price: number; quantity: number }>;
  }>;
  receipt: Receipt | null;
};

type ReceiptProvider = {
  provider_name: string | null;
  provider_tax_id: string | null;
  provider_address: string | null;
  provider_email: string | null;
};

type Filter = 'all' | 'pending' | 'issued' | 'void';

const emptyForm = {
  buyerName: '',
  buyerEmail: '',
  buyerTaxId: '',
  buyerAddress: '',
  notes: '',
};

const paymentLabels = {
  promptpay: 'QR PromptPay',
  stripe: 'Stripe',
  free: 'ไม่มีค่าใช้จ่าย',
};

function formatDate(value: string | null | undefined) {
  return formatThaiDateTime(value);
}

export function MarketplaceReceiptManagementView() {
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [provider, setProvider] = useState<ReceiptProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [issuing, setIssuing] = useState<PaymentItem | null>(null);
  const [viewing, setViewing] = useState<Receipt | null>(null);
  const [voiding, setVoiding] = useState<Receipt | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetch('/api/marketplace/admin/receipts', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setItems(result.items ?? []);
        setProvider(result.provider ?? null);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลไม่สำเร็จ')
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  const counts = useMemo(
    () => ({
      all: items.length,
      pending: items.filter((item) => !item.receipt).length,
      issued: items.filter((item) => item.receipt?.status === 'issued').length,
      void: items.filter((item) => item.receipt?.status === 'void').length,
    }),
    [items]
  );

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const itemStatus = !item.receipt ? 'pending' : item.receipt.status;
      if (filter !== 'all' && filter !== itemStatus) return false;
      if (!normalized) return true;
      return [
        item.id,
        item.buyer.name,
        item.buyer.email,
        item.receipt?.receipt_number,
        item.receipt?.buyer_tax_id,
      ].some((value) => value?.toLowerCase().includes(normalized));
    });
  }, [filter, items, query]);

  const paginatedItems = useMemo(
    () => filteredItems.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredItems, page, rowsPerPage]
  );

  useEffect(() => {
    setPage(0);
  }, [filter, query]);

  const openIssue = (item: PaymentItem) => {
    setIssuing(item);
    setForm({
      buyerName: item.buyer.name,
      buyerEmail: item.buyer.email ?? '',
      buyerTaxId: '',
      buyerAddress: '',
      notes: '',
    });
  };

  const previewTemplate = () => {
    const currentYear = new Date().getFullYear();
    setViewing({
      is_template: true,
      id: 'receipt-template',
      payment_session_id: 'payment-template',
      receipt_number: `INV-${currentYear}XXXX`,
      status: 'issued',
      amount: 1500,
      currency: 'THB',
      payment_method: 'stripe',
      transaction_reference: 'ตัวอย่างเลขอ้างอิงการชำระเงิน',
      items_snapshot: [
        {
          orderId: 'order-template-1',
          sellerName: 'ร้านค้าตัวอย่าง',
          title: 'ชุดสื่อการเรียนรู้ตัวอย่าง',
          unitPrice: 1200,
          quantity: 1,
          subtotal: 1200,
        },
        {
          orderId: 'order-template-2',
          sellerName: 'ร้านค้าตัวอย่าง',
          title: 'ใบงานเสริมทักษะตัวอย่าง',
          unitPrice: 150,
          quantity: 2,
          subtotal: 300,
        },
      ],
      buyer_name: 'ชื่อบุคคล / ชื่อนิติบุคคล',
      buyer_email: 'buyer@example.com',
      buyer_tax_id: '1234567890123',
      buyer_address: 'ที่อยู่ผู้รับใบเสร็จ แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์',
      provider_name: provider?.provider_name || 'ยังไม่ได้ระบุชื่อผู้ออกในข้อมูลร้านค้า',
      provider_tax_id: provider?.provider_tax_id || null,
      provider_address: provider?.provider_address || null,
      provider_email: provider?.provider_email || null,
      notes: 'เอกสารนี้เป็นเพียงตัวอย่างรูปแบบใบเสร็จรับเงิน',
      issued_at: new Date().toISOString(),
      voided_at: null,
      void_reason: null,
    });
  };

  const issueReceipt = async () => {
    if (!issuing) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/marketplace/admin/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentSessionId: issuing.id, ...form }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setIssuing(null);
      setViewing(result.receipt);
      load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ออกใบเสร็จไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const voidReceipt = async () => {
    if (!voiding) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/marketplace/admin/receipts/${voiding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void', reason: voidReason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setVoiding(null);
      setViewing(result.receipt);
      setVoidReason('');
      load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ยกเลิกใบเสร็จไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <GlobalStyles
        styles={{
          '@media print': {
            'body *': { visibility: 'hidden !important' },
            '.receipt-print-area, .receipt-print-area *': {
              visibility: 'visible !important',
            },
            '.receipt-print-area': {
              position: 'absolute',
              inset: 0,
              width: '100%',
              boxShadow: 'none !important',
            },
            '.receipt-print-actions': { display: 'none !important' },
          },
        }}
      />
      <Container maxWidth={false} sx={{ py: { xs: 4, md: 6 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 4 }}
        >
          <Box>
            <Typography component="h1" variant="h3">
              ใบเสร็จรับเงิน
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              ออก ดู พิมพ์ และยกเลิกใบเสร็จจากรายการชำระเงินที่ยืนยันแล้ว
            </Typography>
          </Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
          >
            <Button
              variant="outlined"
              startIcon={<RiEyeLine />}
              disabled={loading}
              onClick={previewTemplate}
            >
              ดูตัวอย่างใบเสร็จ
            </Button>
            <Chip
              icon={<RiReceiptLine />}
              label={`รอออกใบเสร็จ ${counts.pending.toLocaleString('th-TH')} รายการ`}
              color={counts.pending ? 'warning' : 'success'}
            />
          </Stack>
        </Stack>

        {!!error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Card sx={{ p: 2.5, mb: 3 }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
            <TextField
              fullWidth
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาเลขใบเสร็จ ชื่อ อีเมล เลขผู้เสียภาษี หรือรหัสชำระเงิน"
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
            <ToggleButtonGroup
              exclusive
              value={filter}
              onChange={(_, value: Filter | null) => value && setFilter(value)}
              sx={{ flexShrink: 0 }}
            >
              <ToggleButton value="all">ทั้งหมด {counts.all}</ToggleButton>
              <ToggleButton value="pending">รอออก {counts.pending}</ToggleButton>
              <ToggleButton value="issued">ออกแล้ว {counts.issued}</ToggleButton>
              <ToggleButton value="void">ยกเลิก {counts.void}</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Card>

        {loading ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : filteredItems.length ? (
          <Card>
            <TableContainer>
              <Table sx={{ minWidth: 1180 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>เลขที่ใบเสร็จ / การชำระ</TableCell>
                    <TableCell>ผู้ซื้อ</TableCell>
                    <TableCell>วันที่</TableCell>
                    <TableCell>วิธีชำระ</TableCell>
                    <TableCell align="center">คำสั่งซื้อ</TableCell>
                    <TableCell align="right">ยอดเงิน</TableCell>
                    <TableCell>สถานะ</TableCell>
                    <TableCell align="right">จัดการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedItems.map((item) => {
                    const receipt = item.receipt;
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2">
                            {receipt?.receipt_number ?? `PAY-${item.id.slice(0, 8).toUpperCase()}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Payment #{item.id.slice(0, 12).toUpperCase()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{item.buyer.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.buyer.email || 'ไม่มีอีเมล'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                            {formatDate(receipt?.issued_at || item.reviewed_at || item.created_at)}
                          </Typography>
                        </TableCell>
                        <TableCell>{paymentLabels[item.payment_method]}</TableCell>
                        <TableCell align="center">{item.orders.length}</TableCell>
                        <TableCell align="right">
                          <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap' }}>
                            {formatPrice(Number(item.amount))}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {!receipt ? (
                            <Chip size="small" color="warning" label="ยังไม่ออกใบเสร็จ" />
                          ) : receipt.status === 'issued' ? (
                            <Chip
                              size="small"
                              color="success"
                              icon={<RiCheckboxCircleLine />}
                              label="ออกแล้ว"
                            />
                          ) : (
                            <Chip
                              size="small"
                              color="error"
                              icon={<RiCloseCircleLine />}
                              label="ยกเลิกแล้ว"
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {!receipt ? (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => openIssue(item)}
                            >
                              ออกใบเสร็จ
                            </Button>
                          ) : (
                            <Stack
                              direction="row"
                              spacing={0.5}
                              justifyContent="flex-end"
                              sx={{ whiteSpace: 'nowrap' }}
                            >
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<RiEyeLine />}
                                onClick={() => setViewing(receipt)}
                              >
                                ดู
                              </Button>
                              {receipt.status === 'issued' && (
                                <Button
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    setVoiding(receipt);
                                    setVoidReason('');
                                  }}
                                >
                                  ยกเลิก
                                </Button>
                              )}
                            </Stack>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredItems.length}
              page={page}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[10, 25, 50]}
              onPageChange={(_, nextPage) => setPage(nextPage)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(Number(event.target.value));
                setPage(0);
              }}
              labelRowsPerPage="แถวต่อหน้า:"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
            />
          </Card>
        ) : (
          <Card sx={{ py: 10, textAlign: 'center' }}>
            <RiReceiptLine size={52} />
            <Typography variant="h5" sx={{ mt: 2 }}>
              ไม่พบรายการ
            </Typography>
            <Typography color="text.secondary">
              ใบเสร็จจะแสดงเมื่อมีคำสั่งซื้อที่ยืนยันการชำระเงินแล้ว
            </Typography>
          </Card>
        )}
      </Container>

      <Dialog
        open={Boolean(issuing)}
        onClose={() => !saving && setIssuing(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>ออกใบเสร็จรับเงิน</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            ยอด {issuing ? formatPrice(Number(issuing.amount)) : '-'} · ข้อมูลที่บันทึกแล้วจะถูก
            snapshot ลงใบเสร็จ
          </Alert>
          <Stack spacing={2}>
            <TextField
              required
              label="ชื่อบุคคล/นิติบุคคล"
              value={form.buyerName}
              onChange={(event) => setForm({ ...form, buyerName: event.target.value })}
            />
            <TextField
              type="email"
              label="อีเมล"
              value={form.buyerEmail}
              onChange={(event) => setForm({ ...form, buyerEmail: event.target.value })}
            />
            <TextField
              label="เลขประจำตัวผู้เสียภาษี (ถ้ามี)"
              value={form.buyerTaxId}
              onChange={(event) =>
                setForm({ ...form, buyerTaxId: event.target.value.replace(/\D/g, '').slice(0, 13) })
              }
            />
            <TextField
              multiline
              minRows={3}
              label="ที่อยู่ผู้รับใบเสร็จ"
              value={form.buyerAddress}
              onChange={(event) => setForm({ ...form, buyerAddress: event.target.value })}
            />
            <TextField
              multiline
              minRows={2}
              label="หมายเหตุ"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setIssuing(null)} disabled={saving}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            loading={saving}
            disabled={form.buyerName.trim().length < 2}
            onClick={issueReceipt}
          >
            ยืนยันออกใบเสร็จ
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        fullWidth
        maxWidth="md"
        slotProps={{ paper: { className: 'receipt-print-area' } }}
      >
        {viewing && <ReceiptDocument receipt={viewing} />}
        <DialogActions className="receipt-print-actions">
          {viewing?.status === 'issued' && !viewing.is_template && (
            <Button
              color="error"
              onClick={() => {
                setVoiding(viewing);
                setVoidReason('');
              }}
            >
              ยกเลิกใบเสร็จ
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button color="inherit" onClick={() => setViewing(null)}>
            ปิด
          </Button>
          <Button variant="contained" startIcon={<RiPrinterLine />} onClick={() => window.print()}>
            พิมพ์ / บันทึก PDF
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(voiding)}
        onClose={() => !saving && setVoiding(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>ยกเลิกใบเสร็จ {voiding?.receipt_number}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            การยกเลิกจะเก็บประวัติใบเสร็จเดิมไว้ และไม่สามารถออกเลขใหม่ให้รายการชำระนี้ได้
          </Alert>
          <TextField
            autoFocus
            required
            fullWidth
            multiline
            minRows={3}
            label="เหตุผลที่ยกเลิก"
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setVoiding(null)} disabled={saving}>
            ปิด
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={saving}
            disabled={voidReason.trim().length < 3}
            onClick={voidReceipt}
          >
            ยืนยันยกเลิกใบเสร็จ
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function ReceiptDocument({ receipt }: { receipt: Receipt }) {
  return (
    <Box sx={{ p: { xs: 3, sm: 5 }, position: 'relative' }}>
      {(receipt.status === 'void' || receipt.is_template) && (
        <Typography
          sx={{
            position: 'absolute',
            top: '42%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-18deg)',
            fontSize: { xs: 60, sm: 100 },
            fontWeight: 800,
            color: receipt.is_template ? 'text.secondary' : 'error.main',
            opacity: receipt.is_template ? 0.09 : 0.12,
            pointerEvents: 'none',
          }}
        >
          {receipt.is_template ? 'ตัวอย่าง' : 'ยกเลิก'}
        </Typography>
      )}
      <Stack direction="row" justifyContent="space-between" spacing={3}>
        <Box>
          <Logo
            disabled
            isSingle={false}
            sx={{ width: '140px', height: '36px', mb: 1.5, justifyContent: 'flex-start' }}
          />
          <Typography variant="h4">ใบเสร็จรับเงิน</Typography>
          <Typography color="text.secondary">RECEIPT</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h6">{receipt.receipt_number}</Typography>
          <Typography variant="body2">วันที่ออก {formatDate(receipt.issued_at)}</Typography>
          <Chip
            size="small"
            color={
              receipt.is_template ? 'default' : receipt.status === 'issued' ? 'success' : 'error'
            }
            label={
              receipt.is_template
                ? 'ตัวอย่างเอกสาร'
                : receipt.status === 'issued'
                  ? 'ออกแล้ว'
                  : 'ยกเลิกแล้ว'
            }
            sx={{ mt: 1 }}
          />
        </Box>
      </Stack>
      <Divider sx={{ my: 3 }} />
      {receipt.is_template && (!receipt.provider_tax_id || !receipt.provider_address) && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          ข้อมูลผู้ออกใบเสร็จในร้านระบบยังไม่ครบ
          กรุณากรอกเลขผู้เสียภาษีและที่อยู่ในเมนูข้อมูลร้านค้า
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="overline" color="text.secondary">
            ออกโดย
          </Typography>
          <Typography variant="subtitle1">{receipt.provider_name}</Typography>
          {!!receipt.provider_tax_id && (
            <Typography variant="body2">เลขผู้เสียภาษี {receipt.provider_tax_id}</Typography>
          )}
          {!!receipt.provider_address && (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {receipt.provider_address}
            </Typography>
          )}
          {!!receipt.provider_email && (
            <Typography variant="body2">{receipt.provider_email}</Typography>
          )}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="overline" color="text.secondary">
            ผู้รับ
          </Typography>
          <Typography variant="subtitle1">{receipt.buyer_name}</Typography>
          {!!receipt.buyer_tax_id && (
            <Typography variant="body2">เลขผู้เสียภาษี {receipt.buyer_tax_id}</Typography>
          )}
          {!!receipt.buyer_address && (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {receipt.buyer_address}
            </Typography>
          )}
          {!!receipt.buyer_email && <Typography variant="body2">{receipt.buyer_email}</Typography>}
        </Box>
      </Stack>
      <Box sx={{ mt: 4, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <Stack direction="row" sx={{ px: 2, py: 1.5, bgcolor: 'grey.100' }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            รายการ
          </Typography>
          <Typography variant="subtitle2" sx={{ width: 80, textAlign: 'center' }}>
            จำนวน
          </Typography>
          <Typography variant="subtitle2" sx={{ width: 130, textAlign: 'right' }}>
            จำนวนเงิน
          </Typography>
        </Stack>
        {receipt.items_snapshot.map((item, index) => (
          <Stack
            key={`${item.orderId}-${index}`}
            direction="row"
            sx={{ px: 2, py: 1.5, borderTop: index ? 1 : 0, borderColor: 'divider' }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2">{item.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {item.sellerName} · {formatPrice(Number(item.unitPrice))}/รายการ
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ width: 80, textAlign: 'center' }}>
              {item.quantity}
            </Typography>
            <Typography variant="body2" sx={{ width: 130, textAlign: 'right' }}>
              {formatPrice(Number(item.subtotal))}
            </Typography>
          </Stack>
        ))}
      </Box>
      <Stack alignItems="flex-end" sx={{ mt: 3 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          sx={{ width: { xs: '100%', sm: 320 } }}
        >
          <Typography variant="h6">รวมทั้งสิ้น</Typography>
          <Typography variant="h5">{formatPrice(Number(receipt.amount))}</Typography>
        </Stack>
      </Stack>
      <Divider sx={{ my: 3 }} />
      <Typography variant="body2">วิธีชำระเงิน: {paymentLabels[receipt.payment_method]}</Typography>
      {!!receipt.transaction_reference && (
        <Typography variant="body2">เลขอ้างอิง: {receipt.transaction_reference}</Typography>
      )}
      {!!receipt.notes && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          หมายเหตุ: {receipt.notes}
        </Typography>
      )}
      {receipt.status === 'void' && (
        <Alert severity="error" sx={{ mt: 3 }}>
          ยกเลิกเมื่อ {formatDate(receipt.voided_at)} — {receipt.void_reason}
        </Alert>
      )}
    </Box>
  );
}
