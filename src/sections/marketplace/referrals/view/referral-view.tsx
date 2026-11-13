'use client';

import { useRef, useState, useEffect } from 'react';
import {
  LineIcon,
  EmailIcon,
  WhatsappIcon,
  FacebookIcon,
  LineShareButton,
  EmailShareButton,
  WhatsappShareButton,
  FacebookShareButton,
} from 'react-share';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { apiFetch as fetch } from 'src/lib/api-fetch';

import {
  RiLink,
  RiCheckLine,
  RiFileCopyLine,
  RiMoneyDollarCircleLine,
} from 'src/components/remix-icon';

type ReferralData = {
  enabled: boolean;
  settings: {
    rewardRate: number;
    attributionDays: number;
    holdDays: number;
    minimumPayout: number;
    maxRewardPerOrder: number;
  };
  code: { value: string; link: string } | null;
  summary: { clicks: number; pending: number; available: number; paid: number };
  rewards: Array<{
    id: string;
    order_id: string;
    reward_amount: number;
    currency: string;
    status: 'pending' | 'available' | 'paid' | 'cancelled';
    available_at: string;
    created_at: string;
    order?: { items?: Array<{ title?: string }> } | null;
  }>;
};

const moneyFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  currencyDisplay: 'narrowSymbol',
});
const money = (value: number, currency = 'THB') =>
  currency === 'THB'
    ? moneyFormatter.format(value)
    : new Intl.NumberFormat('th-TH', { style: 'currency', currency }).format(value);

export function MarketplaceReferralView() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState('');

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/marketplace/referrals', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'โหลดข้อมูลแนะนำเพื่อนไม่สำเร็จ');
        return result as ReferralData;
      })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error ? loadError.message : 'โหลดข้อมูลแนะนำเพื่อนไม่สำเร็จ'
          );
        }
      });
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <Container maxWidth={false} sx={{ py: 5 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }
  if (!data)
    return (
      <Box sx={{ py: 8, textAlign: 'center', mt: 3 }}>
        <CircularProgress />
      </Box>
    );
  if (!data.enabled) {
    return (
      <Container maxWidth={false} sx={{ py: { xs: 5, md: 8 } }}>
        <Alert severity="info">
          ขณะนี้ระบบแนะนำเพื่อนยังไม่เปิดใช้งาน เมื่อเปิดอีกครั้ง เมนูนี้จะแสดงอัตโนมัติ
        </Alert>
      </Container>
    );
  }

  const copyLink = async () => {
    if (!data.code) return;
    try {
      await navigator.clipboard.writeText(data.code.link);
      setActionError('');
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setActionError('ไม่สามารถคัดลอกลิงก์ได้ กรุณาคัดลอกจากช่องลิงก์โดยตรง');
    }
  };
  const shareUrl = data.code?.link ?? '';
  const shareTitle = 'เลือกดูสื่อการสอนคุณภาพจาก E-KRU Marketplace';

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Typography component="h1" variant="h3">
        แนะนำเพื่อน
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.75 }}>
        แชร์ลิงก์ให้เพื่อน เมื่อเพื่อนซื้อสินค้าที่ร่วมรายการ คุณจะได้รับรางวัลจากค่าธรรมเนียม
        Marketplace
      </Typography>

      <Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, mt: 3, borderRadius: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.lighter',
              color: 'primary.main',
              flexShrink: 0,
            }}
          >
            <RiLink size={24} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6">ลิงก์แนะนำของคุณ</Typography>
            <Typography variant="body2" color="text.secondary">
              คัดลอกลิงก์หรือเลือกช่องทางเพื่อแชร์ให้เพื่อน
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, bgcolor: 'background.neutral' }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
            sx={{ mb: 1.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              รหัสแนะนำของคุณ
            </Typography>
            <Chip
              size="small"
              label={data.code?.value || '—'}
              variant="soft"
              color="primary"
              sx={{ fontWeight: 700, letterSpacing: 1 }}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              fullWidth
              size="small"
              label="ลิงก์สำหรับแชร์"
              value={shareUrl}
              slotProps={{
                input: { readOnly: true },
                htmlInput: { dir: 'ltr', 'aria-label': 'ลิงก์แนะนำสำหรับคัดลอก' },
              }}
              onFocus={(event) => event.target.select()}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
            />
            <Button
              variant="contained"
              color={copied ? 'success' : 'primary'}
              startIcon={copied ? <RiCheckLine /> : <RiFileCopyLine />}
              onClick={copyLink}
              disabled={!data.code}
              sx={{ flexShrink: 0, minWidth: 150, minHeight: 40 }}
            >
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
            </Button>
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            aria-live="polite"
            sx={{ display: 'block', mt: 1 }}
          >
            {copied
              ? 'คัดลอกลิงก์แล้ว นำไปวางในแชตหรือโพสต์ได้เลย'
              : 'ให้เพื่อนเปิดลิงก์นี้ก่อนซื้อสินค้า เพื่อให้ระบบบันทึกผู้แนะนำ'}
          </Typography>
        </Box>
        <Typography variant="subtitle2" sx={{ mt: 2.5, mb: 1.25 }}>
          แชร์ผ่านช่องทางที่สะดวก
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Box sx={{ textAlign: 'center' }}>
            <LineShareButton
              url={shareUrl}
              title={shareTitle}
              disabled={!data.code}
              aria-label="แชร์ลิงก์แนะนำผ่าน LINE"
            >
              <LineIcon size={44} round aria-hidden="true" />
            </LineShareButton>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              LINE
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <FacebookShareButton
              url={shareUrl}
              hashtag="#EKRU"
              disabled={!data.code}
              aria-label="แชร์ลิงก์แนะนำผ่าน Facebook"
            >
              <FacebookIcon size={44} round aria-hidden="true" />
            </FacebookShareButton>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Facebook
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <WhatsappShareButton
              url={shareUrl}
              title={shareTitle}
              disabled={!data.code}
              aria-label="แชร์ลิงก์แนะนำผ่าน WhatsApp"
            >
              <WhatsappIcon size={44} round aria-hidden="true" />
            </WhatsappShareButton>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              WhatsApp
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <EmailShareButton
              url={shareUrl}
              subject="ขอแนะนำ E-KRU Marketplace"
              body={shareTitle}
              disabled={!data.code}
              aria-label="แชร์ลิงก์แนะนำผ่าน อีเมล"
            >
              <EmailIcon size={44} round aria-hidden="true" />
            </EmailShareButton>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              อีเมล
            </Typography>
          </Box>
        </Stack>

        {actionError && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {actionError}
          </Alert>
        )}
      </Card>

      <Box
        sx={{
          mt: 3,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
        }}
      >
        <SummaryCard label="จำนวนคลิก" value={data.summary.clicks.toLocaleString('th-TH')} />
        <SummaryCard label="รอพักยอด" value={money(data.summary.pending)} />
        <SummaryCard label="พร้อมรับเงิน" value={money(data.summary.available)} />
        <SummaryCard label="จ่ายแล้ว" value={money(data.summary.paid)} />
      </Box>

      <Card sx={{ mt: 3 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ p: 3, pb: 1.5 }}>
          <Typography variant="h6">ประวัติรางวัล</Typography>
          <Typography variant="body2" color="text.secondary">
            ยอดพร้อมรับขั้นต่ำสำหรับรอบจ่าย {money(data.settings.minimumPayout)}
          </Typography>
        </Stack>
        {data.rewards.length ? (
          <TableContainer>
            <Table aria-label="ประวัติรางวัลจากการแนะนำ">
              <TableBody>
                {data.rewards.map((reward) => (
                  <TableRow key={reward.id}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {reward.order?.items?.[0]?.title ||
                          `คำสั่งซื้อ ${reward.order_id.slice(0, 8)}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(reward.created_at).toLocaleString('th-TH', {
                          timeZone: 'Asia/Bangkok',
                        })}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle2" color="success.main">
                        +{money(Number(reward.reward_amount), reward.currency)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <RewardStatus status={reward.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Stack alignItems="center" sx={{ px: 3, py: 7 }}>
            <RiMoneyDollarCircleLine size={48} color="#919EAB" />
            <Typography variant="h6" sx={{ mt: 1.5 }}>
              ยังไม่มีรางวัลจากการแนะนำ
            </Typography>
            <Typography color="text.secondary">แชร์ลิงก์ให้เพื่อนเพื่อเริ่มรับรางวัล</Typography>
          </Stack>
        )}
      </Card>
      <Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, mt: 3 }}>
        <Typography variant="h6">วิธีรับรางวัลและเงื่อนไข</Typography>
        <Box component="ol" sx={{ pl: 2.5, mb: 0, '& > li': { pl: 0.5, mt: 1.25 } }}>
          <Typography component="li" variant="body2">
            แชร์ลิงก์แนะนำของคุณด้านล่างให้เพื่อน เพื่อนต้องเปิดลิงก์และสร้างคำสั่งซื้อภายใน{' '}
            {data.settings.attributionDays} วัน
            โดยใช้เบราว์เซอร์ที่เปิดลิงก์และยังเก็บคุกกี้แนะนำไว้ หากเปิดลิงก์แนะนำของคนอื่นภายหลัง
            ระบบจะใช้ลิงก์ล่าสุด
          </Typography>
          <Typography component="li" variant="body2">
            ได้รางวัลเมื่อคำสั่งซื้อได้รับการยืนยันชำระเงินแล้ว การคลิกลิงก์ สมัครสมาชิก
            หรือสร้างคำสั่งซื้อโดยยังไม่ชำระ ยังไม่ทำให้ได้รับรางวัล
          </Typography>
          <Typography component="li" variant="body2">
            รางวัลเท่ากับ {data.settings.rewardRate}% ของค่าคอมมิชชันที่ E-KRU
            ได้รับจากคำสั่งซื้อนั้น ไม่ได้คิดจากราคาสินค้า และไม่รวมค่าธรรมเนียม Stripe
            หรือช่องทางชำระเงิน
            {data.settings.maxRewardPerOrder > 0 && (
              <> โดยรับได้สูงสุด {money(data.settings.maxRewardPerOrder)} ต่อคำสั่งซื้อ</>
            )}
          </Typography>
          <Typography component="li" variant="body2">
            ซื้อผ่านลิงก์ของตัวเอง หรือแนะนำให้ซื้อสินค้าจากร้านของตัวเอง จะไม่ได้รางวัล
            สินค้าฟรีหรือรายการที่ E-KRU ไม่ได้รับค่าคอมมิชชัน ก็ไม่มีรางวัล
          </Typography>
          <Typography component="li" variant="body2">
            รางวัลจะอยู่ใน “รอพักยอด” เป็นเวลา {data.settings.holdDays} วันหลังยืนยันการชำระ
            ก่อนเปลี่ยนเป็น “พร้อมรับเงิน” ยอดรอพักยังไม่นับรวมในยอดพร้อมรับ
          </Typography>
          <Typography component="li" variant="body2">
            ต้องสะสมยอด “พร้อมรับเงิน” อย่างน้อย {money(data.settings.minimumPayout)}{' '}
            จึงถึงเกณฑ์ขั้นต่ำสำหรับรอบจ่าย ตัวเลขนี้เป็นยอดขั้นต่ำที่ผู้ดูแลกำหนด
            ไม่ใช่รางวัลเริ่มต้นหรือเงินที่ต้องชำระ
            และการถึงขั้นต่ำไม่ได้หมายความว่าระบบโอนเงินให้ทันที
          </Typography>
        </Box>
        <Alert severity="info" sx={{ mt: 2 }}>
          ตัวอย่างสมมติ: เพื่อนซื้อสินค้า 1,000 บาท และ E-KRU ได้ค่าคอมมิชชัน 100 บาท
          รางวัลของคุณจะเท่ากับ 100 × {data.settings.rewardRate}% ={' '}
          {money(
            data.settings.maxRewardPerOrder > 0
              ? Math.min((100 * data.settings.rewardRate) / 100, data.settings.maxRewardPerOrder)
              : (100 * data.settings.rewardRate) / 100
          )}{' '}
          หลังใช้เพดานรางวัล ไม่ใช่ {data.settings.rewardRate}% ของยอดซื้อ 1,000 บาท
        </Alert>
      </Card>
    </Container>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ mt: 1 }}>
        {value}
      </Typography>
    </Card>
  );
}

function RewardStatus({ status }: { status: ReferralData['rewards'][number]['status'] }) {
  const config = {
    pending: { label: 'รอพักยอด', color: 'warning' },
    available: { label: 'พร้อมรับเงิน', color: 'success' },
    paid: { label: 'จ่ายแล้ว', color: 'info' },
    cancelled: { label: 'ยกเลิก', color: 'default' },
  } as const;
  const item = config[status];
  return <Chip size="small" label={item.label} color={item.color} variant="soft" />;
}
