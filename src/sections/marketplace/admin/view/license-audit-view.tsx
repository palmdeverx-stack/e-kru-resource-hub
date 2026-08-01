'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import Pagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { SCHOOL_FEATURES } from 'src/lib/school-subscription-config';

import { RiKey2Line, RiSearchLine, RiShieldCheckLine } from 'src/components/remix-icon';

type AuditLicense = {
  id: string;
  scope: 'individual' | 'school' | 'teacher' | 'platform';
  status: string;
  featureKeys: string[];
  startsAt: string;
  expiresAt: string | null;
  seatCount: number;
  buyer: {
    id: string;
    username: string;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    role?: string;
  };
  product: {
    id: string;
    title: string;
    license_target_system?: string;
    license_billing_cycle?: 'one_time' | 'monthly' | 'yearly' | 'contract';
  } | null;
  order: {
    id: string;
    status: string;
    total: number;
    currency: string;
    created_at: string;
    paid_at?: string | null;
    seller?: { id: string; display_name: string } | null;
  } | null;
  payment: {
    status: string;
    payment_method: string;
    amount: number;
    submitted_at: string | null;
    reviewed_at: string | null;
    bank_transaction_reference: string | null;
    stripe_payment_intent_id: string | null;
  } | null;
  subscription: {
    billing_cycle: 'monthly' | 'yearly';
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  payout: {
    netAmount: number;
    availableAt: string | null;
    scheduledAt: string | null;
    status: string;
    requestedAt: string | null;
    processedAt: string | null;
    transferReference: string | null;
  };
};

type Result = {
  licenses: AuditLicense[];
  summary: {
    total: number;
    active: number;
    perpetual: number;
    awaitingPayment: number;
    awaitingPayout: number;
  };
  payoutPolicy: { payoutDay: number; holdDays: number };
};

const PAGE_SIZE = 10;
const featureLabels = new Map<string, string>(
  SCHOOL_FEATURES.map((feature) => [feature.key, feature.label])
);
const scopeLabels = {
  individual: 'บุคคล',
  school: 'ทั้งโรงเรียน',
  teacher: 'รายครู',
  platform: 'ทุกคนในแพลตฟอร์ม',
};

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

function buyerName(buyer: AuditLicense['buyer']) {
  return [buyer.first_name, buyer.last_name].filter(Boolean).join(' ') || buyer.username;
}

function paymentState(license: AuditLicense) {
  if (
    license.payment?.status === 'verified' ||
    ['paid', 'completed'].includes(license.order?.status ?? '')
  ) {
    return { label: 'ชำระแล้ว', color: 'success' as const };
  }
  if (license.payment?.status === 'payment_review') {
    return { label: 'รอตรวจสอบ', color: 'warning' as const };
  }
  if (license.payment?.status === 'rejected') {
    return { label: 'ถูกปฏิเสธ', color: 'error' as const };
  }
  return { label: 'ยังไม่ชำระ', color: 'default' as const };
}

function payoutState(status: string) {
  if (status === 'paid') return { label: 'จ่ายผู้ขายแล้ว', color: 'success' as const };
  if (status === 'pending' || status === 'processing') {
    return {
      label: status === 'processing' ? 'กำลังโอน' : 'สร้างรอบแล้ว',
      color: 'warning' as const,
    };
  }
  if (status === 'failed') return { label: 'โอนไม่สำเร็จ', color: 'error' as const };
  if (status === 'not_created') return { label: 'รอสร้างรอบโอน', color: 'info' as const };
  return { label: 'ยังไม่ถึงวันพร้อมจ่าย', color: 'default' as const };
}

const purchaseFlowSteps = [
  {
    title: 'สร้างและอนุมัติสินค้า',
    detail:
      'ผู้ขายกำหนดระบบปลายทาง ขอบเขตผู้ใช้ ฟีเจอร์ ราคา และรูปแบบ License จากนั้นผู้ดูแลอนุมัติสินค้า',
  },
  {
    title: 'ผู้ซื้อเลือกสิทธิ์',
    detail:
      'ผู้ซื้อเลือกสินค้าหรือรับใบเสนอราคา ตรวจขอบเขตว่าเป็นบุคคล โรงเรียน รายครู หรือทุกคนในแพลตฟอร์ม',
  },
  {
    title: 'สร้างคำสั่งซื้อ',
    detail: 'ระบบล็อกราคา เงื่อนไขสัญญา ร้านผู้ขาย และผู้รับสิทธิ์ไว้ในคำสั่งซื้อก่อนพาไปชำระเงิน',
  },
  {
    title: 'รับและยืนยันเงิน',
    detail:
      'Stripe ยืนยันให้อัตโนมัติ ส่วนช่องทางที่ใช้หลักฐานการโอนต้องรอผู้ดูแลตรวจสอบ รายเดือนและรายปีใช้บัตรเท่านั้น',
  },
  {
    title: 'เปิด License',
    detail:
      'เมื่อสถานะชำระสำเร็จ ระบบออกสิทธิ์และกำหนดวันเริ่ม–สิ้นสุดให้ผู้ซื้อทันที พร้อมแสดงในหน้าแอปของฉัน',
  },
  {
    title: 'ต่ออายุหรือสิ้นสุด',
    detail:
      'ระบบต่ออายุหลังตัดบัตรสำเร็จ หากตัดไม่ผ่านจะแจ้งเตือนและคงสิทธิ์ถึงวันสิ้นรอบ การยกเลิกมีผลเมื่อจบรอบปัจจุบัน',
  },
];

function LicensePurchaseFlowNote({ payoutPolicy }: Pick<Result, 'payoutPolicy'>) {
  return (
    <Card variant="outlined" sx={{ mt: 2.5, p: { xs: 2, md: 2.5 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="h5">Flow การซื้อ License ตั้งแต่เริ่มจนจบ</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            ใช้ตรวจว่ารายการอยู่ขั้นตอนไหน และใครเป็นผู้ดำเนินการในแต่ละช่วง
          </Typography>
        </Box>
        <Chip color="primary" variant="soft" label="ชำระสำเร็จแล้วจึงเปิดสิทธิ์" />
      </Stack>

      <Grid container spacing={1.5} sx={{ mt: 1 }}>
        {purchaseFlowSteps.map((step, index) => (
          <Grid key={step.title} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Box
              sx={{
                p: 1.75,
                height: '100%',
                borderRadius: 1.5,
                bgcolor: 'background.neutral',
                border: (theme) => `1px solid ${theme.palette.divider}`,
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="flex-start">
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '50%',
                    color: 'primary.contrastText',
                    bgcolor: 'primary.main',
                    fontWeight: 700,
                  }}
                >
                  {index + 1}
                </Box>
                <Box>
                  <Typography variant="subtitle2">{step.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    {step.detail}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Typography variant="subtitle2" sx={{ mt: 2.5, mb: 1 }}>
        ผลลัพธ์ตามรูปแบบ License
      </Typography>
      <Grid container spacing={1.25}>
        {[
          ['ซื้อขาด', 'ชำระครั้งเดียว · ใช้ถาวร หรือกำหนดจำนวนวันได้'],
          ['รายเดือน', 'ตัดบัตรทุกเดือน · ต่อสิทธิ์ถึงวันสิ้นรอบใหม่'],
          ['รายปี', 'ตัดบัตรทุกปี · ต่อสิทธิ์ถึงวันสิ้นรอบใหม่'],
          ['ตามสัญญา', 'ใช้ราคา เงื่อนไข และจำนวนวันที่ระบุในสัญญา'],
        ].map(([label, detail]) => (
          <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                border: (theme) => `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="subtitle2" color="primary.main">
                {label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {detail}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Alert severity="success" sx={{ mt: 2 }}>
        หลังรับเงิน ระบบบันทึกรายได้ผู้ขาย → พักยอด {payoutPolicy.holdDays} วัน →
        เข้ารอบโอนตามวันจ่ายที่ตั้งค่า → ผู้ดูแลยืนยันการโอนและเลขอ้างอิง จึงถือว่าจบกระบวนการ
      </Alert>
      <Alert severity="warning" sx={{ mt: 1 }}>
        เงินเข้าแต่ยังไม่มี License ให้ตรวจ webhook/สถานะการชำระ
        หากเป็นรายเดือนหรือรายปีที่ตัดเงินไม่ผ่าน ให้ผู้ซื้ออัปเดตบัตร โดยไม่เปิดสิทธิ์รอบใหม่จนกว่า
        Stripe จะยืนยันการชำระสำเร็จ
      </Alert>
    </Card>
  );
}

export function MarketplaceLicenseAuditView() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [payment, setPayment] = useState('all');
  const [page, setPage] = useState(1);
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTime(Date.now());
    updateCurrentTime();
    const timer = window.setInterval(updateCurrentTime, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch('/api/marketplace/admin/licenses', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? 'โหลดข้อมูล License ไม่สำเร็จ');
        setResult(body);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูล License ไม่สำเร็จ')
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return (result?.licenses ?? []).filter((license) => {
      const state = paymentState(license).label;
      const haystack = [
        buyerName(license.buyer),
        license.buyer.username,
        license.buyer.email,
        license.product?.title,
        license.order?.id,
        license.order?.seller?.display_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return (
        (!keyword || haystack.includes(keyword)) &&
        (scope === 'all' || license.scope === scope) &&
        (payment === 'all' || state === payment)
      );
    });
  }, [payment, query, result?.licenses, scope]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount);
  const visible = filtered.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);

  if (loading) {
    return (
      <Box sx={{ py: 14, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ color: 'primary.main' }}>
          <RiKey2Line size={34} />
        </Box>
        <Box>
          <Typography component="h1" variant="h3">
            ตรวจสอบการซื้อ License
          </Typography>
          <Typography color="text.secondary">
            ตรวจผู้ซื้อ อายุสิทธิ์ การรับชำระ และรอบจ่ายเงินให้ผู้ขายจากหน้าเดียว
          </Typography>
        </Box>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
      {result && (
        <>
          <Grid container spacing={2} sx={{ mt: 2 }}>
            {[
              ['License ทั้งหมด', result.summary.total],
              ['ใช้งานอยู่', result.summary.active],
              ['ซื้อถาวร', result.summary.perpetual],
              ['รอจ่ายผู้ขาย', result.summary.awaitingPayout],
            ].map(([label, value]) => (
              <Grid key={String(label)} size={{ xs: 6, md: 3 }}>
                <Card variant="outlined" sx={{ p: 2.25 }}>
                  <Typography variant="body2" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="h3" sx={{ mt: 0.5 }}>
                    {value}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Alert severity="info" sx={{ mt: 2.5 }}>
            ระบบพักยอด {result.payoutPolicy.holdDays} วัน แล้วนำเข้ารอบโอนตามวันจ่ายที่ตั้งค่าไว้
            วันที่แสดงในคอลัมน์ “รอบจ่ายผู้ขาย” คำนวณจาก Ledger ของคำสั่งซื้อนั้น
          </Alert>

          <LicensePurchaseFlowNote payoutPolicy={result.payoutPolicy} />

          <Card variant="outlined" sx={{ mt: 2.5, overflow: 'hidden' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ p: 2 }}>
              <TextField
                fullWidth
                size="small"
                label="ค้นหาผู้ซื้อ สินค้า ร้านค้า หรือเลขคำสั่งซื้อ"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <Box sx={{ mr: 1, display: 'flex' }}>
                        <RiSearchLine />
                      </Box>
                    ),
                  },
                }}
              />
              <TextField
                select
                size="small"
                label="ขอบเขต"
                value={scope}
                sx={{ minWidth: 180 }}
                onChange={(event) => {
                  setScope(event.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value="all">ทั้งหมด</MenuItem>
                {Object.entries(scopeLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="การชำระเงิน"
                value={payment}
                sx={{ minWidth: 180 }}
                onChange={(event) => {
                  setPayment(event.target.value);
                  setPage(1);
                }}
              >
                {['ทั้งหมด', 'ชำระแล้ว', 'รอตรวจสอบ', 'ยังไม่ชำระ', 'ถูกปฏิเสธ'].map((label) => (
                  <MenuItem key={label} value={label === 'ทั้งหมด' ? 'all' : label}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <TableContainer>
              <Table sx={{ minWidth: 1220 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>ผู้ซื้อ / คำสั่งซื้อ</TableCell>
                    <TableCell>สินค้า / License</TableCell>
                    <TableCell>ระยะเวลาสิทธิ์</TableCell>
                    <TableCell>การชำระเงิน</TableCell>
                    <TableCell>รอบจ่ายผู้ขาย</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.map((license) => {
                    const paid = paymentState(license);
                    const payout = payoutState(license.payout.status);
                    const expiresAtTime = license.expiresAt
                      ? Date.parse(license.expiresAt)
                      : null;
                    const expired = Boolean(
                      currentTime !== null &&
                        expiresAtTime !== null &&
                        Number.isFinite(expiresAtTime) &&
                        expiresAtTime <= currentTime
                    );
                    return (
                      <TableRow key={license.id} hover>
                        <TableCell sx={{ verticalAlign: 'top', minWidth: 230 }}>
                          <Typography variant="subtitle2">{buyerName(license.buyer)}</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            @{license.buyer.username} · {license.buyer.role ?? 'marketplace_user'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {license.buyer.email || 'ไม่มีอีเมล'}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            sx={{ mt: 0.75 }}
                          >
                            Order: {license.order?.id.slice(0, 8) ?? '—'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ซื้อเมื่อ {formatDate(license.order?.created_at, true)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top', minWidth: 240 }}>
                          <Typography variant="subtitle2">
                            {license.product?.title ?? 'ไม่พบสินค้า'}
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            flexWrap="wrap"
                            useFlexGap
                            sx={{ mt: 0.75 }}
                          >
                            <Chip size="small" variant="soft" label={scopeLabels[license.scope]} />
                            <Chip
                              size="small"
                              variant="outlined"
                              label={
                                license.product?.license_target_system === 'marketplace'
                                  ? 'Marketplace'
                                  : 'E-KRU'
                              }
                            />
                          </Stack>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            sx={{ mt: 0.75 }}
                          >
                            ร้าน: {license.order?.seller?.display_name ?? '—'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {license.featureKeys
                              .slice(0, 2)
                              .map((key) => featureLabels.get(key) ?? key)
                              .join(', ')}
                            {license.featureKeys.length > 2
                              ? ` +${license.featureKeys.length - 2}`
                              : ''}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top', minWidth: 190 }}>
                          <Chip
                            size="small"
                            icon={<RiShieldCheckLine />}
                            color={expired || license.status !== 'active' ? 'default' : 'success'}
                            label={
                              expired ? 'หมดอายุ' : license.expiresAt ? 'ใช้งานอยู่' : 'ซื้อถาวร'
                            }
                          />
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            เริ่ม {formatDate(license.startsAt)}
                          </Typography>
                          <Typography
                            variant="body2"
                            color={expired ? 'error.main' : 'text.secondary'}
                          >
                            สิ้นสุด{' '}
                            {license.expiresAt ? formatDate(license.expiresAt) : 'ไม่มีวันหมดอายุ'}
                          </Typography>
                          {license.subscription && (
                            <Typography
                              variant="caption"
                              color="primary.main"
                              display="block"
                              sx={{ mt: 0.5 }}
                            >
                              ต่ออายุ
                              {license.subscription.billing_cycle === 'yearly'
                                ? 'รายปี'
                                : 'รายเดือน'}{' '}
                              ·{' '}
                              {license.subscription.cancel_at_period_end
                                ? 'ยกเลิกเมื่อสิ้นรอบ'
                                : `รอบถัดไป ${formatDate(license.subscription.current_period_end)}`}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top', minWidth: 190 }}>
                          <Chip size="small" color={paid.color} label={paid.label} />
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            {Number(license.order?.total ?? 0).toLocaleString('th-TH', {
                              style: 'currency',
                              currency: license.order?.currency ?? 'THB',
                            })}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            ช่องทาง {license.payment?.payment_method?.toUpperCase() ?? '—'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            ยืนยัน{' '}
                            {formatDate(
                              license.payment?.reviewed_at ?? license.order?.paid_at,
                              true
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top', minWidth: 220 }}>
                          <Chip size="small" color={payout.color} label={payout.label} />
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            สุทธิผู้ขาย{' '}
                            {Number(license.payout.netAmount).toLocaleString('th-TH', {
                              style: 'currency',
                              currency: license.order?.currency ?? 'THB',
                            })}
                          </Typography>
                          <Typography variant="body2">
                            พร้อมจ่าย {formatDate(license.payout.availableAt)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            รอบโอน {formatDate(license.payout.scheduledAt)}
                          </Typography>
                          {license.payout.processedAt && (
                            <Typography variant="caption" color="success.main" display="block">
                              โอนจริง {formatDate(license.payout.processedAt, true)}
                            </Typography>
                          )}
                          {license.payout.transferReference && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              อ้างอิง {license.payout.transferReference}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!visible.length && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 7 }}>
                        ไม่พบ License ตามตัวกรอง
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                พบ {filtered.length.toLocaleString('th-TH')} รายการ
              </Typography>
              <Pagination
                count={pageCount}
                page={activePage}
                onChange={(_event, value) => setPage(value)}
                color="primary"
              />
            </Stack>
          </Card>
        </>
      )}
    </Container>
  );
}
