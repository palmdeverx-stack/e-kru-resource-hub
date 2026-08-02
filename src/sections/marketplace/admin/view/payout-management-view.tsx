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
import Pagination from '@mui/material/Pagination';
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
  isMock?: boolean;
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
  isMock?: boolean;
  transfer_reference?: string;
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
  payoutDay: number;
  isPayoutDay: boolean;
  nextPayoutAt: string | null;
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

const MOCK_AVAILABLE_SELLERS: AvailableSeller[] = [
  {
    sellerId: 'mock-seller-1',
    amount: 2450,
    isMock: true,
    seller: { display_name: 'ร้านครูมะลิ (ตัวอย่าง)' },
    account: {
      bank_code: '004',
      bank_name: 'ธนาคารกสิกรไทย',
      account_number: '1234567890',
      account_name: 'นางสาวมะลิ ใจดี',
    },
  },
  {
    sellerId: 'mock-seller-2',
    amount: 1890.5,
    isMock: true,
    seller: { display_name: 'สื่อการสอนครูต้น (ตัวอย่าง)' },
    account: {
      bank_code: '014',
      bank_name: 'ธนาคารไทยพาณิชย์',
      account_number: '9876543210',
      account_name: 'นายต้นกล้า รักเรียน',
    },
  },
  {
    sellerId: 'mock-seller-3',
    amount: 725,
    isMock: true,
    seller: { display_name: 'ห้องเรียนแสนสนุก (ตัวอย่าง)' },
    account: {
      bank_code: '006',
      bank_name: 'ธนาคารกรุงไทย',
      account_number: '4567890123',
      account_name: 'นางสาวแสนดี มีสุข',
    },
  },
  {
    sellerId: 'mock-seller-4',
    amount: 55,
    isMock: true,
    seller: { display_name: 'คลังใบงานคุณครู (ยอดยังไม่ถึง)' },
    account: {
      bank_code: '002',
      bank_name: 'ธนาคารกรุงเทพ',
      account_number: '2468013579',
      account_name: 'นางสาวใบงาน ตั้งใจ',
    },
  },
  {
    sellerId: 'mock-seller-5',
    amount: 980,
    isMock: true,
    seller: { display_name: 'ครูปั้นสื่อ (บัญชียังไม่ครบ)' },
    account: null,
  },
  ...Array.from(
    { length: 8 },
    (_, index): AvailableSeller => ({
      sellerId: `mock-seller-${index + 6}`,
      amount: 320 + index * 175,
      isMock: true,
      seller: { display_name: `ร้านสื่อการสอนตัวอย่าง ${index + 6}` },
      account: {
        bank_code: index % 2 === 0 ? '004' : '014',
        bank_name: index % 2 === 0 ? 'ธนาคารกสิกรไทย' : 'ธนาคารไทยพาณิชย์',
        account_number: `55550000${String(index + 1).padStart(2, '0')}`,
        account_name: `ผู้ขายตัวอย่าง ${index + 6}`,
      },
    })
  ),
];

const MOCK_PAYOUTS: Payout[] = [
  {
    id: 'mock-payout-pending',
    amount: 1320,
    status: 'pending',
    isMock: true,
    bank_code_snapshot: '004',
    bank_name_snapshot: 'ธนาคารกสิกรไทย',
    account_number_snapshot: '1111222233',
    account_name_snapshot: 'นางสาวสาธิต ระบบดี',
    created_at: new Date().toISOString(),
    seller: { display_name: 'ร้านตัวอย่างรอบปัจจุบัน' },
  },
  {
    id: 'mock-payout-paid',
    amount: 2150,
    status: 'paid',
    isMock: true,
    bank_code_snapshot: '014',
    bank_name_snapshot: 'ธนาคารไทยพาณิชย์',
    account_number_snapshot: '4444555566',
    account_name_snapshot: 'นายตัวอย่าง โอนสำเร็จ',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    seller: { display_name: 'ร้านตัวอย่างโอนสำเร็จ' },
  },
  {
    id: 'mock-payout-failed',
    amount: 640,
    status: 'failed',
    isMock: true,
    bank_code_snapshot: '006',
    bank_name_snapshot: 'ธนาคารกรุงไทย',
    account_number_snapshot: '7777888899',
    account_name_snapshot: 'นางสาวตัวอย่าง ตรวจบัญชี',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    seller: { display_name: 'ร้านตัวอย่างโอนไม่สำเร็จ' },
  },
];

type Props = {
  accessGranted?: boolean;
};

export function MarketplacePayoutManagementView({ accessGranted = true }: Props) {
  const [available, setAvailable] = useState<AvailableSeller[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutPolicy, setPayoutPolicy] = useState<PayoutPolicy>({
    holdDays: 0,
    minimumPayout: 0,
    payoutDay: 5,
    isPayoutDay: false,
    nextPayoutAt: null,
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
  const [payoutPage, setPayoutPage] = useState(1);
  const [mockMode, setMockMode] = useState(false);
  const [referenceCheck, setReferenceCheck] = useState<
    'idle' | 'checking' | 'available' | 'duplicate' | 'error'
  >('idle');

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
        setPayoutPolicy(
          result.payoutPolicy ?? {
            holdDays: 0,
            minimumPayout: 0,
            payoutDay: 5,
            isPayoutDay: false,
            nextPayoutAt: null,
          }
        );
        setOperator(result.operator ?? null);
        setPayoutSourceAccount(result.payoutSourceAccount ?? null);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [accessGranted]);
  useEffect(() => load(), [load]);

  useEffect(() => {
    const reference = value.trim().toUpperCase();
    if (reviewing?.status !== 'paid' || reference.length < 4) {
      setReferenceCheck('idle');
      return undefined;
    }

    if (reviewing.payout.isMock) {
      const duplicate = payouts.some(
        (payout) =>
          payout.id !== reviewing.payout.id &&
          payout.status === 'paid' &&
          payout.transfer_reference?.toUpperCase() === reference
      );
      setReferenceCheck(duplicate ? 'duplicate' : 'available');
      return undefined;
    }

    setReferenceCheck('checking');
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ reference, excludeId: reviewing.payout.id });
        const response = await fetch(
          `/api/marketplace/admin/payouts/reference-check?${params.toString()}`,
          { cache: 'no-store', signal: controller.signal }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setReferenceCheck(result.available ? 'available' : 'duplicate');
      } catch (checkError) {
        if (!(checkError instanceof Error && checkError.name === 'AbortError')) {
          setReferenceCheck('error');
        }
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [payouts, reviewing, value]);

  const createMockPayout = (source: AvailableSeller, index = 0): Payout => ({
    id: `mock-created-${Date.now()}-${index}`,
    amount: source.amount,
    status: 'pending',
    isMock: true,
    bank_code_snapshot: source.account?.bank_code,
    bank_name_snapshot: source.account?.bank_name ?? '-',
    account_number_snapshot: source.account?.account_number ?? '-',
    account_name_snapshot: source.account?.account_name ?? '-',
    created_at: new Date().toISOString(),
    seller: source.seller,
  });

  const showMockData = () => {
    setMockMode(true);
    setAvailable(MOCK_AVAILABLE_SELLERS);
    setPayouts(MOCK_PAYOUTS);
    setPayoutPolicy({
      holdDays: 7,
      minimumPayout: 100,
      payoutDay: new Date().getDay(),
      isPayoutDay: true,
      nextPayoutAt: new Date().toISOString(),
    });
    setPayoutSourceAccount({
      bankCode: '004',
      bankName: 'ธนาคารกสิกรไทย',
      accountName: 'บัญชีกลาง E-KRU (ตัวอย่าง)',
      accountNumberMasked: '•••• 6789',
    });
    setSelectedSellerIds([]);
    setPayoutPage(1);
    setListTab('ready');
    setError('');
  };

  const clearMockData = () => {
    setMockMode(false);
    setSelectedSellerIds([]);
    setPayoutPage(1);
    load();
  };

  const createPayout = async (sellerId: string) => {
    const mockSource = available.find((item) => item.sellerId === sellerId && item.isMock);
    if (mockSource) {
      const mockPayout = createMockPayout(mockSource);
      setAvailable((current) => current.filter((item) => item.sellerId !== sellerId));
      setPayouts((current) => [mockPayout, ...current]);
      setListTab('history');
      return;
    }
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
  const sortedAvailable = [...available].sort((left, right) => {
    const leftReady = Boolean(left.account && left.amount >= payoutPolicy.minimumPayout);
    const rightReady = Boolean(right.account && right.amount >= payoutPolicy.minimumPayout);
    return Number(rightReady) - Number(leftReady) || right.amount - left.amount;
  });
  const payoutPageCount = Math.max(1, Math.ceil(sortedAvailable.length / KBIZ_GROUP_LIMIT));
  const activePayoutPage = Math.min(payoutPage, payoutPageCount);
  const pageStart = (activePayoutPage - 1) * KBIZ_GROUP_LIMIT;
  const pageItems = sortedAvailable.slice(pageStart, pageStart + KBIZ_GROUP_LIMIT);
  const pageEligibleSellers = pageItems.filter(
    (item) => item.account && item.amount >= payoutPolicy.minimumPayout
  );
  const selectedSellers = eligibleSellers.filter((item) =>
    selectedSellerIds.includes(item.sellerId)
  );
  const allPageEligibleSelected =
    pageEligibleSellers.length > 0 &&
    pageEligibleSellers.every((item) => selectedSellerIds.includes(item.sellerId));
  const readyAmount = eligibleSellers.reduce((sum, item) => sum + item.amount, 0);
  const pendingPayouts = payouts.filter((payout) => payout.status === 'pending');
  const pendingAmount = pendingPayouts.reduce((sum, payout) => sum + Number(payout.amount), 0);
  const needsAttentionCount = available.length - eligibleSellers.length;
  const nextPayoutLabel = payoutPolicy.nextPayoutAt
    ? new Intl.DateTimeFormat('th-TH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Bangkok',
      }).format(new Date(payoutPolicy.nextPayoutAt))
    : '-';

  const prepareCurrentRound = () => {
    const firstPageEligible = sortedAvailable
      .slice(0, KBIZ_GROUP_LIMIT)
      .filter((item) => item.account && item.amount >= payoutPolicy.minimumPayout);
    setListTab('ready');
    setPayoutPage(1);
    setSelectedSellerIds(firstPageEligible.map((item) => item.sellerId));
  };

  const toggleSeller = (sellerId: string) => {
    setSelectedSellerIds((current) => {
      if (current.includes(sellerId)) {
        return current.filter((currentId) => currentId !== sellerId);
      }
      return current.length < KBIZ_GROUP_LIMIT ? [...current, sellerId] : current;
    });
  };

  const toggleAllOnPage = () => {
    setSelectedSellerIds(
      allPageEligibleSelected ? [] : pageEligibleSellers.map((item) => item.sellerId)
    );
  };

  const changePayoutPage = (_event: React.ChangeEvent<unknown>, page: number) => {
    setPayoutPage(page);
    setSelectedSellerIds([]);
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
    if (mockMode) {
      const created = selectedSellers.map((source, index) => ({
        source,
        payout: createMockPayout(source, index),
      }));
      const createdIds = new Set(selectedSellers.map((item) => item.sellerId));
      downloadKBizReviewFile(created);
      setAvailable((current) => current.filter((item) => !createdIds.has(item.sellerId)));
      setPayouts((current) => [...created.map((item) => item.payout), ...current]);
      setBulkReviewOpen(false);
      setSelectedSellerIds([]);
      setListTab('history');
      return;
    }
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
    if (reviewing.payout.isMock) {
      setPayouts((current) =>
        current.map((payout) =>
          payout.id === reviewing.payout.id
            ? {
                ...payout,
                status: reviewing.status,
                ...(reviewing.status === 'paid'
                  ? { transfer_reference: value.trim().toUpperCase() }
                  : {}),
              }
            : payout
        )
      );
      setReviewing(null);
      setValue('');
      return;
    }
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
          {mockMode ? (
            <Button color="error" variant="outlined" disabled={loading} onClick={clearMockData}>
              ล้างข้อมูลตัวอย่าง
            </Button>
          ) : (
            <Button color="info" variant="outlined" disabled={loading} onClick={showMockData}>
              แสดงข้อมูลตัวอย่าง
            </Button>
          )}
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
      {mockMode && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">กำลังแสดงข้อมูลตัวอย่าง</Typography>
          <Typography variant="body2">
            ทดลองเลือกผู้ขาย สร้างรอบ ดาวน์โหลด CSV และบันทึกผลได้ครบ
            โดยไม่บันทึกฐานข้อมูลหรือโอนเงินจริง
          </Typography>
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
          <Card
            variant="outlined"
            sx={{
              p: { xs: 2.5, md: 3 },
              gridColumn: '1 / -1',
              borderRadius: 3,
              borderColor: payoutPolicy.isPayoutDay ? 'success.main' : 'info.light',
              bgcolor: payoutPolicy.isPayoutDay ? 'success.lighter' : 'info.lighter',
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ md: 'center' }}
              spacing={2}
            >
              <Box>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                  <Typography variant="h4" fontWeight={400}>
                    {payoutPolicy.isPayoutDay ? 'ถึงรอบโอนวันนี้' : 'เตรียมรอบโอนถัดไป'} :
                  </Typography>
                  <Typography variant="h4">
                    {payoutPolicy.isPayoutDay ? 'ควรดำเนินการวันนี้' : nextPayoutLabel}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  มี {eligibleSellers.length.toLocaleString('th-TH')} ร้านพร้อมโอน รวม{' '}
                  {formatPrice(readyAmount)}
                  {needsAttentionCount > 0
                    ? ` · อีก ${needsAttentionCount.toLocaleString('th-TH')} ร้านยังไม่ถึงขั้นต่ำหรือข้อมูลบัญชีไม่ครบ`
                    : ''}
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                {pendingPayouts.length > 0 && (
                  <Button color="warning" variant="outlined" onClick={() => setListTab('history')}>
                    ปิดงานค้าง {pendingPayouts.length} รายการ
                  </Button>
                )}
                <Button
                  color={payoutPolicy.isPayoutDay ? 'success' : 'info'}
                  variant="contained"
                  disabled={!eligibleSellers.length}
                  onClick={prepareCurrentRound}
                >
                  {mockMode
                    ? 'ดูรายการตัวอย่าง'
                    : payoutPolicy.isPayoutDay
                      ? 'เริ่มทำรอบวันนี้'
                      : 'เตรียมรายการล่วงหน้า'}
                </Button>
              </Stack>
            </Stack>

            <Box
              sx={{
                gap: 1,
                mt: 2.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
              }}
            >
              {[
                ['1', 'ตรวจรายการ', 'เช็กชื่อ บัญชี และยอด'],
                ['2', 'สร้างรอบ', 'จองยอดและดาวน์โหลด CSV'],
                ['3', 'โอนผ่าน K BIZ', 'ทำ Group Transfer ตามใบงาน'],
                ['4', 'บันทึกผล', 'ใส่เลขอ้างอิงหรือแจ้งไม่สำเร็จ'],
              ].map(([step, title, detail]) => (
                <Stack
                  key={step}
                  direction="row"
                  spacing={1.25}
                  sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.paper' }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      display: 'grid',
                      flexShrink: 0,
                      borderRadius: '50%',
                      placeItems: 'center',
                      color: 'primary.contrastText',
                      bgcolor: payoutPolicy.isPayoutDay ? 'success.main' : 'info.main',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {step}
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">{title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {detail}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Box>
          </Card>

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
              gridRow: { lg: '3' },
              position: { lg: 'sticky' },
              top: { lg: 96 },
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
                // overflowY: { lg: 'auto' },
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
                        ผู้โอนคือผู้ดูแล Marketplace หรือเจ้าหน้าที่การเงินที่เข้าถึงบัญชีธนาคารของ
                        E-KRU
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
              gridRow: { lg: '3' },
            }}
          >
            <Tabs
              value={listTab}
              onChange={(_, nextTab: 'ready' | 'history') => setListTab(nextTab)}
              variant="fullWidth"
              sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Tab value="ready" label={`รายการรอบโอน (${eligibleSellers.length} พร้อม)`} />
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
                <Box>
                  <Typography variant="h5">รายการรอบโอน</Typography>
                  <Typography variant="caption" color="text.secondary">
                    รายการพร้อมโอนอยู่ด้านบน รายการที่ต้องแก้หรือรอสะสมยอดอยู่ด้านล่าง
                  </Typography>
                </Box>
                {!!pageEligibleSellers.length && (
                  <Button
                    color="inherit"
                    startIcon={
                      <Checkbox
                        checked={allPageEligibleSelected}
                        indeterminate={
                          selectedSellers.length > 0 &&
                          selectedSellers.length < pageEligibleSellers.length
                        }
                        sx={{ p: 0 }}
                      />
                    }
                    onClick={toggleAllOnPage}
                  >
                    {allPageEligibleSelected ? 'ยกเลิกที่เลือกในหน้านี้' : 'เลือกทั้งหมดในหน้านี้'}
                  </Button>
                )}
              </Stack>
              <Stack
                spacing={1.5}
                sx={{
                  minHeight: 0,
                  // maxHeight: { lg: 620 },
                  overflowY: { lg: 'auto' },
                  pr: { lg: 0.75 },
                }}
              >
                {available.length ? (
                  pageItems.map((item) => (
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
                            <Stack
                              direction="row"
                              spacing={1}
                              useFlexGap
                              flexWrap="wrap"
                              alignItems="center"
                            >
                              <Typography variant="h6">
                                {item.seller?.display_name || item.sellerId}
                              </Typography>
                              <Chip
                                size="small"
                                variant="soft"
                                color={
                                  item.account && item.amount >= payoutPolicy.minimumPayout
                                    ? 'success'
                                    : 'warning'
                                }
                                label={
                                  !item.account
                                    ? 'ข้อมูลบัญชีไม่ครบ'
                                    : item.amount < payoutPolicy.minimumPayout
                                      ? `ขาดอีก ${formatPrice(payoutPolicy.minimumPayout - item.amount)}`
                                      : 'พร้อมโอน'
                                }
                              />
                            </Stack>
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
                            disabled={
                              item.isMock ||
                              !item.account ||
                              item.amount < payoutPolicy.minimumPayout
                            }
                            loading={saving}
                            onClick={() => createPayout(item.sellerId)}
                          >
                            {item.isMock ? 'สร้างรายการตัวอย่าง' : 'สร้างรายการโอน'}
                          </Button>
                        </Stack>
                      </Stack>
                    </Card>
                  ))
                ) : (
                  <Alert severity="info">ยังไม่มียอดที่พร้อมทำรอบ</Alert>
                )}
              </Stack>
              {available.length > 0 && (
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1.5}
                  sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}
                >
                  <Typography variant="caption" color="text.secondary">
                    แสดง {pageStart + 1}–{Math.min(pageStart + KBIZ_GROUP_LIMIT, available.length)}{' '}
                    จาก {available.length.toLocaleString('th-TH')} รายการ · หน้าละ{' '}
                    {KBIZ_GROUP_LIMIT}
                  </Typography>
                  <Pagination
                    page={activePayoutPage}
                    count={payoutPageCount}
                    color="primary"
                    shape="rounded"
                    siblingCount={0}
                    onChange={changePayoutPage}
                  />
                </Stack>
              )}
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
          <Stack sx={{ py: 2 }}>
            <TextField
              autoFocus
              fullWidth
              multiline={reviewing?.status === 'failed'}
              minRows={reviewing?.status === 'failed' ? 3 : undefined}
              label={reviewing?.status === 'paid' ? 'เลขอ้างอิงการโอน' : 'สาเหตุ'}
              value={value}
              onChange={(event) =>
                setValue(
                  reviewing?.status === 'paid'
                    ? event.target.value.toUpperCase().slice(0, 100)
                    : event.target.value
                )
              }
              helperText={
                reviewing?.status === 'paid'
                  ? 'ใช้เลขอ้างอิงจาก e-Slip หรือรายการเดินบัญชีธนาคาร'
                  : undefined
              }
              sx={{ mt: 1 }}
            />
            {reviewing?.status === 'paid' && value.trim().length >= 4 && (
              <Alert
                severity={
                  referenceCheck === 'available'
                    ? 'success'
                    : referenceCheck === 'duplicate'
                      ? 'error'
                      : 'info'
                }
                sx={{ mt: 2 }}
              >
                {referenceCheck === 'checking' && 'กำลังตรวจเลขอ้างอิง…'}
                {referenceCheck === 'available' &&
                  'เลขอ้างอิงนี้ยังไม่เคยใช้ในระบบ สามารถบันทึกได้'}
                {referenceCheck === 'duplicate' &&
                  'เลขอ้างอิงนี้ถูกใช้กับรายการอื่นแล้ว กรุณาตรวจสอบ'}
                {referenceCheck === 'error' &&
                  'ตรวจเลขซ้ำไม่สำเร็จ ระบบจะตรวจอีกครั้งเมื่อกดยืนยัน'}
              </Alert>
            )}
            {reviewing?.status === 'paid' && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5 }}>
                ระบบตรวจรูปแบบและเลขซ้ำเท่านั้น การยืนยันผลกับธนาคารต้องใช้ Bank API หรือ e-Slip
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions>
          <Button color="inherit" onClick={() => setReviewing(null)}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            loading={saving}
            disabled={
              value.trim().length < (reviewing?.status === 'paid' ? 4 : 3) ||
              referenceCheck === 'checking' ||
              referenceCheck === 'duplicate'
            }
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
        maxWidth="md"
      >
        <DialogTitle>ยืนยันสร้างรอบโอนผ่าน K BIZ</DialogTitle>
        <DialogContent>
          <Stack sx={{ py: 2 }}>
            <Typography color="text.secondary">
              ระบบจะสร้างและจองยอด {selectedSellers.length.toLocaleString('th-TH')} ร้าน รวม{' '}
              {formatPrice(selectedSellers.reduce((sum, item) => sum + item.amount, 0))}
            </Typography>
            <Box
              sx={{
                mt: 2.5,
                pr: { md: 0.75 },
                // maxHeight: { xs: 360, md: 420 },
                overflowY: 'auto',
              }}
            >
              <Stack spacing={1.25}>
                {selectedSellers.map((item, index) => (
                  <Card key={item.sellerId} variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ sm: 'center' }}
                      spacing={2}
                    >
                      <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="flex-start"
                        sx={{ minWidth: 0 }}
                      >
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
                          {index + 1}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            flexWrap="wrap"
                            alignItems="center"
                          >
                            <Typography variant="subtitle1">
                              {item.seller?.display_name || item.sellerId}
                            </Typography>
                            {item.isMock && (
                              <Chip size="small" color="info" variant="soft" label="ตัวอย่าง" />
                            )}
                          </Stack>
                          {item.account && (
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              sx={{ mt: 0.75 }}
                            >
                              <ThaiBankLogo
                                bankCode={item.account.bank_code}
                                bankName={item.account.bank_name}
                                size={28}
                              />
                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ wordBreak: 'break-word' }}
                                >
                                  {item.account.bank_name} · {item.account.account_number}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {item.account.account_name}
                                </Typography>
                              </Box>
                            </Stack>
                          )}
                        </Box>
                      </Stack>
                      <Box sx={{ flexShrink: 0, textAlign: { sm: 'right' } }}>
                        <Typography variant="caption" color="text.secondary">
                          จำนวนเงิน
                        </Typography>
                        <Typography variant="h6" color="success.main">
                          {formatPrice(item.amount)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Box>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}
            >
              <Typography variant="subtitle1">
                รวม {selectedSellers.length.toLocaleString('th-TH')} รายการ
              </Typography>
              <Typography variant="h5" color="success.main">
                {formatPrice(selectedSellers.reduce((sum, item) => sum + item.amount, 0))}
              </Typography>
            </Stack>
            <Alert severity="info" sx={{ mt: 2 }}>
              หลังยืนยัน ระบบจะ Map ธนาคาร เลขบัญชี ชื่อบัญชี และจำนวนเงินของผู้ขายลง CSV
              ให้อัตโนมัติ แต่ยังไม่มีเงินถูกโอนออกจากบัญชีธนาคาร
            </Alert>
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions>
          <Button color="inherit" disabled={saving} onClick={() => setBulkReviewOpen(false)}>
            ยกเลิก
          </Button>
          <Button variant="contained" color="success" loading={saving} onClick={createBulkPayouts}>
            {mockMode ? 'สร้างรอบตัวอย่างและดาวน์โหลด CSV' : 'สร้างรอบและดาวน์โหลด CSV'}
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
