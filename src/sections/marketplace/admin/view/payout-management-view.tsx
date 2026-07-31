'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { formatPrice } from '../../shared/api';
import { ThaiBankLogo } from '../../shared/bank-logo';

type AvailableSeller = {
  sellerId: string;
  amount: number;
  seller: { display_name: string } | null;
  account: {
    bank_code: string;
    bank_name: string;
    account_number: string;
    account_name: string;
  } | null;
};
type Payout = {
  id: string;
  amount: number;
  status: string;
  bank_code_snapshot?: string;
  bank_name_snapshot: string;
  account_number_snapshot: string;
  account_name_snapshot: string;
  created_at: string;
  seller: { display_name: string } | null;
};
type PayoutPolicy = {
  holdDays: number;
  minimumPayout: number;
};
type PayoutOperator = {
  id: string;
  username: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
};
type PayoutSourceAccount = {
  bankCode: string;
  bankName: string;
  accountName: string;
  accountNumberMasked: string;
};

const KBIZ_GROUP_LIMIT = 10;

type Props = {
  accessGranted?: boolean;
};

export function MarketplacePayoutManagementView({ accessGranted = true }: Props) {
  const [available, setAvailable] = useState<AvailableSeller[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutPolicy, setPayoutPolicy] = useState<PayoutPolicy>({
    holdDays: 0,
    minimumPayout: 0,
  });
  const [operator, setOperator] = useState<PayoutOperator | null>(null);
  const [payoutSourceAccount, setPayoutSourceAccount] = useState<PayoutSourceAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<{ payout: Payout; status: 'paid' | 'failed' } | null>(
    null
  );
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedSellerIds, setSelectedSellerIds] = useState<string[]>([]);
  const [bulkReviewOpen, setBulkReviewOpen] = useState(false);
  const [kbizDemoOpen, setKBizDemoOpen] = useState(false);
  const [stripeConnectOpen, setStripeConnectOpen] = useState(false);
  const [payoutFlowOpen, setPayoutFlowOpen] = useState(false);
  const [listTab, setListTab] = useState<'ready' | 'history'>('ready');

  const load = useCallback(() => {
    if (!accessGranted) {
      setLoading(true);
      return;
    }
    setLoading(true);
    fetch('/api/marketplace/admin/payouts')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setAvailable(result.availableSellers);
        setPayouts(result.payouts);
        setPayoutPolicy(result.payoutPolicy ?? { holdDays: 0, minimumPayout: 0 });
        setOperator(result.operator ?? null);
        setPayoutSourceAccount(result.payoutSourceAccount ?? null);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [accessGranted]);
  useEffect(() => load(), [load]);

  const createPayout = async (sellerId: string) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/marketplace/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'สร้างรอบโอนไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const eligibleSellers = available.filter(
    (item) => item.account && item.amount >= payoutPolicy.minimumPayout
  );
  const eligibleGroup = eligibleSellers.slice(0, KBIZ_GROUP_LIMIT);
  const selectedSellers = eligibleSellers.filter((item) =>
    selectedSellerIds.includes(item.sellerId)
  );
  const allEligibleSelected =
    eligibleGroup.length > 0 &&
    eligibleGroup.every((item) => selectedSellerIds.includes(item.sellerId));
  const readyAmount = eligibleSellers.reduce((sum, item) => sum + item.amount, 0);
  const pendingPayouts = payouts.filter((payout) => payout.status === 'pending');
  const pendingAmount = pendingPayouts.reduce((sum, payout) => sum + Number(payout.amount), 0);

  const toggleSeller = (sellerId: string) => {
    setSelectedSellerIds((current) => {
      if (current.includes(sellerId)) {
        return current.filter((currentId) => currentId !== sellerId);
      }
      return current.length < KBIZ_GROUP_LIMIT ? [...current, sellerId] : current;
    });
  };

  const toggleAllEligible = () => {
    setSelectedSellerIds(allEligibleSelected ? [] : eligibleGroup.map((item) => item.sellerId));
  };

  const escapeCsvCell = (cellValue: string | number) => {
    const text = String(cellValue);
    const isSafeAccountNumber = /^="\d+"$/.test(text);
    const safeText = /^[=+\-@]/.test(text) && !isSafeAccountNumber ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  };

  const downloadKBizReviewFile = (
    rows: Array<{
      payout: Payout;
      source: AvailableSeller;
    }>
  ) => {
    const header = [
      'ลำดับ',
      'รหัสธนาคาร',
      'ธนาคารผู้รับ',
      'เลขบัญชีผู้รับ',
      'ชื่อบัญชีผู้รับ',
      'จำนวนเงิน (บาท)',
      'ชื่อร้าน / ผู้ขาย',
      'หมายเหตุ',
      'Payout ID',
    ];
    const csvRows = rows.map(({ payout, source }, index) => {
      const accountNumber = payout.account_number_snapshot.replace(/\D/g, '');
      return [
        index + 1,
        source.account?.bank_code || '',
        payout.bank_name_snapshot,
        `="${accountNumber}"`,
        payout.account_name_snapshot,
        Number(payout.amount).toFixed(2),
        source.seller?.display_name || source.sellerId,
        `E-KRU Payout ${payout.id.slice(0, 8)}`,
        payout.id,
      ];
    });
    const csv = `\uFEFF${[header, ...csvRows]
      .map((row) => row.map(escapeCsvCell).join(','))
      .join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `kbiz-group-transfer-${date}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const createBulkPayouts = async () => {
    if (!selectedSellers.length) return;
    setSaving(true);
    setError('');
    const created: Array<{ payout: Payout; source: AvailableSeller }> = [];
    const failed: string[] = [];

    for (const source of selectedSellers) {
      try {
        const response = await fetch('/api/marketplace/admin/payouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sellerId: source.sellerId }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        created.push({ payout: result.payout, source });
      } catch (submitError) {
        failed.push(
          `${source.seller?.display_name || source.sellerId}: ${
            submitError instanceof Error ? submitError.message : 'สร้างรายการไม่สำเร็จ'
          }`
        );
      }
    }

    if (created.length) downloadKBizReviewFile(created);
    if (failed.length) {
      setError(
        `สร้างสำเร็จ ${created.length} รายการ แต่ไม่สำเร็จ ${failed.length} รายการ: ${failed.join(
          ' / '
        )}`
      );
    }
    setBulkReviewOpen(false);
    setSelectedSellerIds([]);
    setSaving(false);
    load();
  };

  const finishPayout = async () => {
    if (!reviewing) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/marketplace/admin/payouts/${reviewing.payout.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: reviewing.status,
          ...(reviewing.status === 'paid'
            ? { transferReference: value }
            : { failureReason: value }),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setReviewing(null);
      setValue('');
      load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'บันทึกผลการโอนไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        sx={{ mb: 4 }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            โอนเงินให้ผู้ขาย
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            สร้างรายการจากยอดที่พ้นระยะพัก แล้วบันทึกผลหลังโอนผ่านธนาคาร
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="outlined" onClick={() => setStripeConnectOpen(true)}>
            Stripe Connect
          </Button>
          <Button color="warning" variant="outlined" onClick={() => setPayoutFlowOpen(true)}>
            วิธีทำ Payout
          </Button>
        </Stack>
      </Stack>

      <Dialog
        open={stripeConnectOpen}
        onClose={() => setStripeConnectOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>Stripe Connect — โอนอัตโนมัติ</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Card
            variant="outlined"
            sx={{
              p: { xs: 2.5, md: 3 },
              overflow: 'hidden',
              position: 'relative',
              borderRadius: 3,
              borderColor: 'primary.light',
              background:
                'linear-gradient(135deg, rgba(21,101,245,0.08) 0%, rgba(83,162,255,0.03) 100%)',
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
              spacing={2}
            >
              <Box>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                  <Typography variant="h4">Stripe Connect — โอนอัตโนมัติ</Typography>
                  <Chip size="small" color="info" variant="soft" label="ตัวอย่าง UI" />
                  <Chip size="small" color="warning" variant="soft" label="ความยาก: สูง" />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  ตัวอย่าง Flow ที่จะใช้แทนการโอนผ่านธนาคารด้วยตนเอง
                </Typography>
              </Box>
              <Button variant="contained" disabled>
                ยังไม่เปิดใช้งาน
              </Button>
            </Stack>

            <Box
              sx={{
                gap: 2,
                mt: 3,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1.25fr 1fr 1fr' },
              }}
            >
              <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                <Typography variant="h6">Flow เมื่อเปิดใช้งาน</Typography>
                <Stack spacing={1.75} sx={{ mt: 2 }}>
                  {[
                    ['1', 'ผู้ขายเชื่อม Stripe', 'กรอกข้อมูลและยืนยันตัวตนผ่าน Stripe Connect'],
                    ['2', 'ลูกค้าชำระเงิน', 'หนึ่ง Checkout ชำระสินค้าได้จากหนึ่งร้าน'],
                    ['3', 'แบ่งเงินอัตโนมัติ', 'ค่าคอมมิชชันเข้า E-KRU ส่วนที่เหลือเข้าร้าน'],
                    ['4', 'Stripe โอนเข้าธนาคาร', 'Stripe จัดรอบ Payout และแจ้งผลผ่าน Webhook'],
                  ].map(([number, title, description]) => (
                    <Stack key={number} direction="row" spacing={1.5} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 30,
                          height: 30,
                          display: 'grid',
                          flexShrink: 0,
                          borderRadius: '50%',
                          placeItems: 'center',
                          color: 'primary.contrastText',
                          bgcolor: 'primary.main',
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {number}
                      </Box>
                      <Box>
                        <Typography variant="subtitle2">{title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {description}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Card>

              <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                <Typography variant="h6">สถานะความพร้อม</Typography>
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                  {[
                    ['Stripe Connect Platform', 'ยังไม่ได้ตั้งค่า'],
                    ['Seller Connect Onboarding', 'ยังไม่มี'],
                    ['Connected Account Webhook', 'ยังไม่มี'],
                    ['Automatic Payout Tracking', 'ยังไม่มี'],
                  ].map(([title, status]) => (
                    <Stack
                      key={title}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            flexShrink: 0,
                            borderRadius: '50%',
                            bgcolor: 'warning.main',
                          }}
                        />
                        <Typography variant="body2">{title}</Typography>
                      </Stack>
                      <Typography variant="caption" color="warning.dark" sx={{ flexShrink: 0 }}>
                        {status}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Card>

              <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                <Typography variant="h6">ส่วนที่ต้องปรับ</Typography>
                <Box component="ul" sx={{ pl: 2.25, mb: 0, mt: 1.5 }}>
                  {[
                    'เพิ่ม Stripe Connected Account ให้ผู้ขาย',
                    'ปรับตะกร้าเป็นหนึ่งร้านต่อ Checkout',
                    'เปลี่ยน Checkout เป็น Direct Charge',
                    'คำนวณ Application Fee ของ E-KRU',
                    'รองรับ Webhook, Refund และ Payout Failed',
                    'ปรับรายงานการเงินและการกระทบยอด',
                  ].map((item) => (
                    <li key={item}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                        {item}
                      </Typography>
                    </li>
                  ))}
                </Box>
              </Card>
            </Box>

            <Alert severity="info" sx={{ mt: 2.5 }}>
              <Typography variant="subtitle2">สรุปความยาก</Typography>
              <Typography variant="body2">
                เป็นการปรับระดับระบบ ไม่ใช่แค่เพิ่มปุ่ม เพราะกระทบ Checkout, การรับเงิน, KYC ผู้ขาย,
                ค่าคอมมิชชัน, การคืนเงิน และการกระทบยอด ควรทำเป็นขั้นตอนและทดสอบใน Stripe Test Mode
                ก่อนเปิดเงินจริง
              </Typography>
            </Alert>
          </Card>
        </DialogContent>
        <Divider />
        <DialogActions>
          <Button color="inherit" onClick={() => setStripeConnectOpen(false)}>
            ปิด
          </Button>
        </DialogActions>
      </Dialog>

      {!!error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {loading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box
          sx={{
            gap: 4,
            display: 'grid',
            alignItems: 'start',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(380px, 0.65fr)' },
          }}
        >
          <Box
            sx={{
              gap: 2,
              display: 'grid',
              gridColumn: '1 / -1',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            }}
          >
            {[
              {
                label: 'ยอดพร้อมทำรอบ',
                value: formatPrice(readyAmount),
                detail: `${eligibleSellers.length.toLocaleString('th-TH')} ร้านพร้อมโอน`,
                color: 'success.main',
              },
              {
                label: 'รอผลการโอน',
                value: formatPrice(pendingAmount),
                detail: `${pendingPayouts.length.toLocaleString('th-TH')} รายการ`,
                color: 'warning.main',
              },
              {
                label: 'ยอดขั้นต่ำต่อรอบ',
                value: formatPrice(payoutPolicy.minimumPayout),
                detail: `พักยอด ${payoutPolicy.holdDays.toLocaleString('th-TH')} วัน`,
                color: 'primary.main',
              },
            ].map((summary) => (
              <Card key={summary.label} variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {summary.label}
                </Typography>
                <Typography variant="h4" sx={{ mt: 0.5, color: summary.color }}>
                  {summary.value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {summary.detail}
                </Typography>
              </Card>
            ))}
          </Box>

          <Card
            variant="outlined"
            sx={{
              p: 0,
              borderRadius: 3,
              borderColor: 'success.light',
              bgcolor: 'success.lighter',
              gridColumn: { lg: '2' },
              gridRow: { lg: '2' },
              position: { lg: 'sticky' },
              top: { lg: 96 },
              maxHeight: { lg: 'calc(100vh - 120px)' },
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Stack
              direction="column"
              alignItems="flex-start"
              spacing={2}
              sx={{
                p: { xs: 2.5, md: 3 },
                pb: 2,
                zIndex: 1,
                flexShrink: 0,
                bgcolor: 'success.lighter',
                borderBottom: '1px solid',
                borderColor: 'success.light',
              }}
            >
              <Box>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                  <Typography variant="h5">K BIZ Group Transfer</Typography>
                  <Chip size="small" color="success" variant="soft" label="แนะนำสำหรับเริ่มต้น" />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  เลือกผู้ขายได้สูงสุด {KBIZ_GROUP_LIMIT} ร้านต่อรอบ แล้วนำรายการไปโอนแบบกลุ่มผ่าน K
                  BIZ
                </Typography>
              </Box>
              <Stack
                direction="row"
                spacing={1}
                width={1}
                sx={{ '& .MuiButton-root': { width: 1 } }}
              >
                <Button
                  sx={{ width: '100px' }}
                  color="success"
                  onClick={() => setKBizDemoOpen(true)}
                >
                  ดูตัวอย่าง
                </Button>
                <Button
                  component="a"
                  href="https://kbiz.kasikornbank.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  color="success"
                  sx={{ width: '100px' }}
                >
                  เปิด K BIZ
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  disabled={!selectedSellers.length}
                  onClick={() => setBulkReviewOpen(true)}
                >
                  สร้างรอบและ CSV ({selectedSellers.length})
                </Button>
              </Stack>
            </Stack>

            <Box
              sx={{
                px: { xs: 2.5, md: 3 },
                pb: { xs: 2.5, md: 3 },
                minHeight: 0,
                overflowY: { lg: 'auto' },
                overscrollBehavior: 'contain',
              }}
            >
              <Box
                sx={{
                  gap: 2,
                  mt: 2.5,
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                }}
              >
                {[
                  ['1. เลือกร้าน', 'เลือกรายการที่ยอดพ้นระยะพักและมีบัญชีรับเงินแล้ว'],
                  ['2. สร้างและจองยอด', 'ระบบสร้าง Payout แยกร้าน ป้องกันยอดถูกนำไปทำรอบซ้ำ'],
                  [
                    '3. โอนผ่าน K BIZ',
                    'ใช้ CSV ตรวจสอบข้อมูล แล้วกรอกรายการในเมนูโอนเงินเป็นกลุ่ม',
                  ],
                ].map(([title, description]) => (
                  <Box key={title}>
                    <Typography variant="subtitle2">{title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {description}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Alert severity="info" sx={{ mt: 2.5, bgcolor: 'background.paper' }}>
                K BIZ ใช้เมนู “โอนเงินเป็นกลุ่ม” จึงไม่ต้องใช้ไฟล์ DCT ระบบจะดาวน์โหลด CSV
                เป็นใบงานสำหรับตรวจเลขบัญชี ชื่อบัญชี และยอดก่อนกรอกใน K BIZ
              </Alert>

              <Box
                sx={{
                  gap: 2,
                  mt: 2,
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                }}
              >
                {operator && (
                  <Card
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 2.5, bgcolor: 'background.paper' }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      ผู้ดำเนินการรอบนี้
                    </Typography>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
                      <Avatar src={operator.avatar_url || undefined} alt={operator.username}>
                        {(operator.first_name || operator.username).slice(0, 1).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" noWrap>
                          {[operator.first_name, operator.last_name].filter(Boolean).join(' ') ||
                            operator.username}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          @{operator.username}
                          {operator.email ? ` · ${operator.email}` : ''}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                      <Chip size="small" color="primary" variant="soft" label="Master Admin" />
                      <Chip size="small" variant="outlined" label="สร้างรอบและบันทึกผล" />
                    </Stack>
                  </Card>
                )}

                <Card
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 2.5, bgcolor: 'background.paper' }}
                >
                  <Typography variant="caption" color="text.secondary">
                    บัญชีต้นทางที่ใช้โอน
                  </Typography>
                  {payoutSourceAccount ? (
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
                      <ThaiBankLogo
                        bankCode={payoutSourceAccount.bankCode}
                        bankName={payoutSourceAccount.bankName}
                        size={44}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" noWrap>
                          {payoutSourceAccount.bankName} · {payoutSourceAccount.bankCode}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {payoutSourceAccount.accountNumberMasked} ·{' '}
                          {payoutSourceAccount.accountName}
                        </Typography>
                      </Box>
                    </Stack>
                  ) : (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      ยังไม่ได้ตั้งค่าบัญชีต้นทาง
                    </Alert>
                  )}
                  <Button
                    component="a"
                    href="/dashboard/settings/finance"
                    size="small"
                    variant="outlined"
                    color={payoutSourceAccount ? 'inherit' : 'warning'}
                    sx={{ mt: 1.5 }}
                  >
                    {payoutSourceAccount ? 'แก้ไขข้อมูลการเงิน' : 'ตั้งค่าข้อมูลการเงิน'}
                  </Button>
                </Card>
              </Box>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1.5 }}
              >
                ระบบบันทึกผู้ดำเนินการเพื่อการตรวจสอบ แต่ไม่จัดเก็บ User ID, รหัสผ่าน หรือ OTP ของ K
                BIZ
              </Typography>

              <Card
                variant="outlined"
                sx={{ p: 2, mt: 2, borderRadius: 2.5, bgcolor: 'background.paper' }}
              >
                <Typography variant="subtitle1">เวลาปฏิบัติงาน Payout</Typography>
                <Box
                  sx={{
                    gap: 1.5,
                    mt: 1.5,
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                  }}
                >
                  {[
                    {
                      color: 'success.main',
                      label: 'เวลาที่แนะนำ',
                      value: 'จันทร์–ศุกร์ 09:00–16:00 น.',
                    },
                    {
                      color: 'warning.main',
                      label: 'ยังพอเหมาะ',
                      value: 'วันทำการ ก่อน 18:00 น.',
                    },
                    {
                      color: 'error.main',
                      label: 'ควรหลีกเลี่ยง',
                      value: '00:00–06:00 น. คืนวันศุกร์ และวันหยุด',
                    },
                  ].map((period) => (
                    <Box key={period.label} sx={{ display: 'flex', gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          mt: 0.75,
                          flexShrink: 0,
                          borderRadius: '50%',
                          bgcolor: period.color,
                        }}
                      />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {period.label}
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {period.value}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1.5 }}
                >
                  ควรตรวจประกาศปิดปรับปรุงบนหน้าเข้าสู่ระบบ K BIZ ก่อนเริ่มทำรายการทุกครั้ง
                </Typography>
              </Card>
            </Box>
          </Card>

          <Dialog
            open={payoutFlowOpen}
            onClose={() => setPayoutFlowOpen(false)}
            fullWidth
            maxWidth="lg"
          >
            <DialogTitle>Flow การโอนเงินให้ผู้ขาย</DialogTitle>
            <DialogContent sx={{ pt: 1 }}>
              <Card
                variant="outlined"
                sx={{
                  p: { xs: 2.5, md: 3 },
                  borderRadius: 3,
                  borderColor: 'warning.light',
                  bgcolor: 'warning.lighter',
                }}
              >
                <Typography variant="h5">Note: Flow การโอนเงินให้ผู้ขาย</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  ระบบรวบรวมและจองยอด ส่วนการโอนผ่านธนาคารยังต้องดำเนินการโดยผู้ดูแล
                </Typography>

                <Alert severity="warning" sx={{ mt: 2, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle2">การโอนเงินเป็นแบบ Manual</Typography>
                  <Box component="ul" sx={{ pl: 2.5, my: 0.75 }}>
                    <li>
                      <Typography variant="body2">
                        ผู้โอนคือ Super Admin หรือเจ้าหน้าที่การเงินที่เข้าถึงบัญชีธนาคารของ E-KRU
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="body2">
                        เปิด K BIZ แล้วใช้เมนู “โอนเงินเป็นกลุ่ม”
                        เพื่อโอนไปยังบัญชีผู้ขายตามรายการที่ระบบเตรียมไว้
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="body2">
                        ปุ่ม “สร้างรายการโอน” เป็นเพียงการจองยอด ยังไม่มีเงินจริงถูกโอนออกจากบัญชี
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="body2">
                        หลังโอนสำเร็จ ต้องกลับมากด “บันทึกว่าโอนแล้ว” และกรอกเลขอ้างอิงจากธนาคาร
                      </Typography>
                    </li>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    ระบบยังไม่ได้เชื่อม Bank API หรือระบบโอนเงินอัตโนมัติ
                  </Typography>
                </Alert>

                <Box
                  sx={{
                    gap: 2,
                    mt: 2.5,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(5, minmax(0, 1fr))',
                    },
                  }}
                >
                  {[
                    {
                      title: 'ลูกค้าชำระเงิน',
                      description: 'ระบบหักค่าชำระเงินและค่าคอมมิชชันก่อนบันทึกรายได้สุทธิ',
                    },
                    {
                      title: 'พักยอด',
                      description: `รอ ${payoutPolicy.holdDays.toLocaleString('th-TH')} วัน เพื่อรองรับการตรวจสอบหรือคืนเงิน`,
                    },
                    {
                      title: 'ยอดพร้อมทำรอบ',
                      description: `รวมยอดที่พ้นระยะพัก และต้องไม่น้อยกว่า ${formatPrice(
                        payoutPolicy.minimumPayout
                      )}`,
                    },
                    {
                      title: 'สร้างรายการโอน',
                      description: 'ระบบจองยอดและบันทึกสำเนาบัญชี แต่ยังไม่ได้โอนเงินจริง',
                    },
                    {
                      title: 'โอนและบันทึกผล',
                      description: 'โอนผ่านธนาคาร แล้วบันทึกเลขอ้างอิง หรือระบุสาเหตุหากไม่สำเร็จ',
                    },
                  ].map((step, index) => (
                    <Box key={step.title} sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          display: 'grid',
                          borderRadius: '50%',
                          placeItems: 'center',
                          color: 'warning.contrastText',
                          bgcolor: 'warning.main',
                          fontWeight: 700,
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Typography variant="subtitle2" sx={{ mt: 1.25 }}>
                        {step.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {step.description}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Alert severity="warning" sx={{ mt: 2.5 }}>
                  หากบันทึกว่าโอนไม่สำเร็จ ยอดที่จองไว้จะถูกปล่อยกลับไปยัง “ยอดพร้อมทำรอบ”
                  เพื่อแก้ไขข้อมูลบัญชีและสร้างรายการโอนใหม่
                </Alert>
              </Card>
            </DialogContent>
            <Divider />
            <DialogActions>
              <Button color="inherit" onClick={() => setPayoutFlowOpen(false)}>
                ปิด
              </Button>
            </DialogActions>
          </Dialog>

          <Box
            sx={{
              minWidth: 0,
              gridColumn: { lg: '1' },
              gridRow: { lg: '2' },
            }}
          >
            <Tabs
              value={listTab}
              onChange={(_, nextTab: 'ready' | 'history') => setListTab(nextTab)}
              variant="fullWidth"
              sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Tab value="ready" label={`ยอดพร้อมทำรอบ (${available.length})`} />
              <Tab value="history" label={`รายการโอนล่าสุด (${payouts.length})`} />
            </Tabs>
            <Card
              variant="outlined"
              sx={{
                p: { xs: 2, md: 2.5 },
                minWidth: 0,
                borderRadius: 3,
                display: listTab === 'ready' ? 'flex' : 'none',
                flexDirection: 'column',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 2 }}
              >
                <Typography variant="h5">ยอดพร้อมทำรอบ</Typography>
                {!!eligibleSellers.length && (
                  <Button
                    color="inherit"
                    startIcon={
                      <Checkbox
                        checked={allEligibleSelected}
                        indeterminate={
                          selectedSellers.length > 0 &&
                          selectedSellers.length < eligibleGroup.length
                        }
                        sx={{ p: 0 }}
                      />
                    }
                    onClick={toggleAllEligible}
                  >
                    {allEligibleSelected
                      ? 'ยกเลิกทั้งหมด'
                      : eligibleSellers.length > KBIZ_GROUP_LIMIT
                        ? `เลือก ${KBIZ_GROUP_LIMIT} รายการแรก`
                        : 'เลือกทั้งหมด'}
                  </Button>
                )}
              </Stack>
              <Stack
                spacing={1.5}
                sx={{
                  minHeight: 0,
                  maxHeight: { lg: 620 },
                  overflowY: { lg: 'auto' },
                  pr: { lg: 0.75 },
                }}
              >
                {available.length ? (
                  available.map((item) => (
                    <Card key={item.sellerId} variant="outlined" sx={{ p: 2, flexShrink: 0 }}>
                      <Stack
                        direction={{ xs: 'column', xl: 'row' }}
                        justifyContent="space-between"
                        spacing={2}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                          <Checkbox
                            checked={selectedSellerIds.includes(item.sellerId)}
                            disabled={
                              !item.account ||
                              item.amount < payoutPolicy.minimumPayout ||
                              saving ||
                              (selectedSellerIds.length >= KBIZ_GROUP_LIMIT &&
                                !selectedSellerIds.includes(item.sellerId))
                            }
                            onChange={() => toggleSeller(item.sellerId)}
                            inputProps={{
                              'aria-label': `เลือกรายการของ ${
                                item.seller?.display_name || item.sellerId
                              }`,
                            }}
                          />
                          <div>
                            <Typography variant="h6">
                              {item.seller?.display_name || item.sellerId}
                            </Typography>
                            {item.account ? (
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                sx={{ mt: 0.5 }}
                              >
                                <ThaiBankLogo
                                  bankCode={item.account.bank_code}
                                  bankName={item.account.bank_name}
                                  size={28}
                                />
                                <Typography color="text.secondary">
                                  {item.account.bank_name} · {item.account.account_number} ·{' '}
                                  {item.account.account_name}
                                </Typography>
                              </Stack>
                            ) : (
                              <Typography color="text.secondary">ยังไม่มีบัญชีรับเงิน</Typography>
                            )}
                          </div>
                        </Stack>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Typography variant="h5" color="success.main">
                            {formatPrice(item.amount)}
                          </Typography>
                          <Button
                            variant="contained"
                            disabled={!item.account}
                            loading={saving}
                            onClick={() => createPayout(item.sellerId)}
                          >
                            สร้างรายการโอน
                          </Button>
                        </Stack>
                      </Stack>
                    </Card>
                  ))
                ) : (
                  <Alert severity="info">ยังไม่มียอดที่พร้อมทำรอบ</Alert>
                )}
              </Stack>
            </Card>

            <Card
              variant="outlined"
              sx={{
                p: { xs: 2, md: 2.5 },
                minWidth: 0,
                borderRadius: 3,
                display: listTab === 'history' ? 'flex' : 'none',
                flexDirection: 'column',
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 2 }}
              >
                <Typography variant="h5">รายการโอนล่าสุด</Typography>
                <Chip size="small" variant="soft" label={`${payouts.length} รายการ`} />
              </Stack>
              <Stack
                spacing={1.5}
                sx={{
                  minHeight: 0,
                  maxHeight: { lg: 620 },
                  overflowY: { lg: 'auto' },
                  pr: { lg: 0.75 },
                }}
              >
                {payouts.length ? (
                  payouts.map((payout) => (
                    <Card key={payout.id} variant="outlined" sx={{ p: 2, flexShrink: 0 }}>
                      <Stack
                        direction={{ xs: 'column', xl: 'row' }}
                        justifyContent="space-between"
                        spacing={2}
                      >
                        <div>
                          <Typography variant="h6">
                            {payout.seller?.display_name || 'ผู้ขาย'} ·{' '}
                            {formatPrice(Number(payout.amount))}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                            <ThaiBankLogo
                              bankCode={payout.bank_code_snapshot}
                              bankName={payout.bank_name_snapshot}
                              size={28}
                            />
                            <Typography color="text.secondary">
                              {payout.bank_name_snapshot} · {payout.account_number_snapshot} ·{' '}
                              {payout.account_name_snapshot}
                            </Typography>
                          </Stack>
                        </div>
                        {payout.status === 'pending' ? (
                          <Stack direction="row" spacing={1}>
                            <Button
                              color="error"
                              onClick={() => {
                                setReviewing({ payout, status: 'failed' });
                                setValue('');
                              }}
                            >
                              โอนไม่สำเร็จ
                            </Button>
                            <Button
                              variant="contained"
                              onClick={() => {
                                setReviewing({ payout, status: 'paid' });
                                setValue('');
                              }}
                            >
                              บันทึกว่าโอนแล้ว
                            </Button>
                          </Stack>
                        ) : (
                          <Chip
                            color={payout.status === 'paid' ? 'success' : 'error'}
                            label={payout.status === 'paid' ? 'โอนแล้ว' : 'ไม่สำเร็จ'}
                          />
                        )}
                      </Stack>
                    </Card>
                  ))
                ) : (
                  <Alert severity="info">ยังไม่มีประวัติการโอน</Alert>
                )}
              </Stack>
            </Card>
          </Box>
        </Box>
      )}

      <Dialog open={Boolean(reviewing)} onClose={() => setReviewing(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {reviewing?.status === 'paid' ? 'ยืนยันการโอน' : 'บันทึกว่าโอนไม่สำเร็จ'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline={reviewing?.status === 'failed'}
            minRows={reviewing?.status === 'failed' ? 3 : undefined}
            label={reviewing?.status === 'paid' ? 'เลขอ้างอิงการโอน' : 'สาเหตุ'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <Divider />
        <DialogActions>
          <Button color="inherit" onClick={() => setReviewing(null)}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            loading={saving}
            disabled={value.trim().length < 3}
            onClick={finishPayout}
          >
            ยืนยัน
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={bulkReviewOpen}
        onClose={() => !saving && setBulkReviewOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>ยืนยันสร้างรอบโอนผ่าน K BIZ</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            ระบบจะสร้างและจองยอด {selectedSellers.length.toLocaleString('th-TH')} ร้าน รวม{' '}
            {formatPrice(selectedSellers.reduce((sum, item) => sum + item.amount, 0))}
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            หลังยืนยัน ระบบจะ Map ธนาคาร เลขบัญชี ชื่อบัญชี และจำนวนเงินของผู้ขายลง CSV ให้อัตโนมัติ
            แต่ยังไม่มีเงินถูกโอนออกจากบัญชีธนาคาร
          </Alert>
        </DialogContent>
        <Divider />
        <DialogActions>
          <Button color="inherit" disabled={saving} onClick={() => setBulkReviewOpen(false)}>
            ยกเลิก
          </Button>
          <Button variant="contained" color="success" loading={saving} onClick={createBulkPayouts}>
            สร้างรอบและดาวน์โหลด CSV
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={kbizDemoOpen} onClose={() => setKBizDemoOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <span>ตัวอย่างการโอนผ่าน K BIZ</span>
            <Chip size="small" color="info" variant="soft" label="UI จำลอง" />
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack sx={{ py: 2 }}>
            <Alert severity="info" sx={{ mb: 2.5 }}>
              หน้านี้ใช้สาธิต Flow เท่านั้น หน้าจอและชื่อเมนูจริงอาจเปลี่ยนแปลงตาม K BIZ
            </Alert>

            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.35fr) minmax(260px, 0.65fr)' },
              }}
            >
              <Card variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2.5 }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography variant="h6">โอนเงินเป็นกลุ่ม</Typography>
                    <Typography variant="caption" color="text.secondary">
                      คัดลอกข้อมูลจากไฟล์ kbiz-group-transfer.csv
                    </Typography>
                  </Box>
                  <Chip size="small" color="success" variant="soft" label="สูงสุด 10 ผู้รับ" />
                </Stack>

                <Box
                  sx={{
                    p: 2,
                    mt: 2,
                    borderRadius: 2,
                    bgcolor: 'background.neutral',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    บัญชีต้นทาง
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <ThaiBankLogo
                      bankCode={payoutSourceAccount?.bankCode}
                      bankName={payoutSourceAccount?.bankName}
                      size={30}
                    />
                    <Typography variant="subtitle2">
                      {payoutSourceAccount
                        ? `${payoutSourceAccount.bankName} · ${payoutSourceAccount.accountNumberMasked}`
                        : 'บัญชี E-KRU · •••• 6544'}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    ยอดคงเหลือจะแสดงใน K BIZ
                  </Typography>
                </Box>

                <Stack spacing={1.25} sx={{ mt: 2 }}>
                  {(selectedSellers.length
                    ? selectedSellers.slice(0, 3).map((item) => ({
                        id: item.sellerId,
                        name: item.account?.account_name || item.seller?.display_name || 'ผู้ขาย',
                        bank: item.account?.bank_name || 'ธนาคาร',
                        bankCode: item.account?.bank_code || '',
                        account: item.account?.account_number || '',
                        amount: item.amount,
                      }))
                    : [
                        {
                          id: 'example-1',
                          name: 'ร้านสื่อการสอนตัวอย่าง',
                          bank: 'กสิกรไทย',
                          bankCode: '004',
                          account: 'xxx-x-x1234-x',
                          amount: 980,
                        },
                        {
                          id: 'example-2',
                          name: 'ครูผู้สร้างตัวอย่าง',
                          bank: 'ธนาคารตัวอย่าง',
                          bankCode: '',
                          account: 'xxx-x-x5678-x',
                          amount: 450,
                        },
                      ]
                  ).map((item, index) => (
                    <Stack
                      key={item.id}
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      justifyContent="space-between"
                      sx={{
                        p: 1.75,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Stack direction="row" spacing={1.25}>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            display: 'grid',
                            flexShrink: 0,
                            borderRadius: '50%',
                            placeItems: 'center',
                            color: 'success.contrastText',
                            bgcolor: 'success.main',
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {index + 1}
                        </Box>
                        <Box>
                          <Typography variant="subtitle2">{item.name}</Typography>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <ThaiBankLogo bankCode={item.bankCode} bankName={item.bank} size={22} />
                            <Typography variant="caption" color="text.secondary">
                              {item.bank} · {item.account}
                            </Typography>
                          </Stack>
                        </Box>
                      </Stack>
                      <Typography variant="subtitle2" color="success.main">
                        {formatPrice(item.amount)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>

                <Button fullWidth variant="contained" color="success" disabled sx={{ mt: 2 }}>
                  ตรวจสอบรายการใน K BIZ
                </Button>
              </Card>

              <Stack spacing={2}>
                <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                  <Typography variant="h6">สรุปรอบตัวอย่าง</Typography>
                  <Stack spacing={1.25} sx={{ mt: 2 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        จำนวนผู้รับ
                      </Typography>
                      <Typography variant="subtitle2">
                        {selectedSellers.length || 2} รายการ
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        ยอดรวม
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        {formatPrice(
                          selectedSellers.length
                            ? selectedSellers.reduce((sum, item) => sum + item.amount, 0)
                            : 1430
                        )}
                      </Typography>
                    </Stack>
                    <Divider />
                    <Typography variant="caption" color="text.secondary">
                      ตรวจชื่อบัญชี เลขบัญชี และยอดให้ตรงกับ CSV ก่อนยืนยันด้วย K PLUS หรือ OTP
                    </Typography>
                  </Stack>
                </Card>

                <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                  <Typography variant="h6">หลังธนาคารยืนยัน</Typography>
                  <Stack spacing={1.5} sx={{ mt: 2 }}>
                    {['ดาวน์โหลดหรือเก็บ e-Slip', 'คัดลอกเลขอ้างอิง', 'กลับมาบันทึกว่าโอนแล้ว'].map(
                      (item, index) => (
                        <Stack key={item} direction="row" spacing={1.25} alignItems="center">
                          <Chip size="small" color="success" label={index + 1} />
                          <Typography variant="body2">{item}</Typography>
                        </Stack>
                      )
                    )}
                  </Stack>
                </Card>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions>
          <Stack spacing={2} sx={{ display: 'flex', flexDirection: 'row' }}>
            <Button color="inherit" onClick={() => setKBizDemoOpen(false)}>
              ปิด
            </Button>
            <Button
              component="a"
              href="https://kbiz.kasikornbank.com/"
              target="_blank"
              rel="noopener noreferrer"
              variant="contained"
              color="success"
            >
              เปิด K BIZ
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
