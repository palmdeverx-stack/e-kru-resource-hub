'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import {
  RiBugLine,
  RiToolsLine,
  RiFeedbackLine,
  RiLightbulbLine,
  RiSendPlaneLine,
  RiErrorWarningLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

type FeedbackCategory = 'feature' | 'improvement' | 'bug' | 'blocker' | 'general';
type FeedbackStatus = 'new' | 'reviewing' | 'planned' | 'resolved' | 'closed';

type FeedbackItem = {
  id: string;
  reporter_id: string;
  reporter_username: string;
  reporter_role: string;
  category: FeedbackCategory;
  title: string;
  system_area: string | null;
  current_behavior: string | null;
  requested_change: string | null;
  blocker_detail: string | null;
  page_url: string | null;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

const CATEGORY_OPTIONS: Array<{
  value: FeedbackCategory;
  label: string;
  description: string;
}> = [
  {
    value: 'feature',
    label: 'อยากให้เพิ่มฟีเจอร์',
    description: 'เสนอความสามารถหรือส่วนใหม่ที่ยังไม่มีในระบบ',
  },
  {
    value: 'improvement',
    label: 'อยากให้ปรับแก้',
    description: 'ส่วนเดิมใช้งานได้ แต่อยากให้สะดวกหรือชัดเจนขึ้น',
  },
  { value: 'bug', label: 'พบปัญหา', description: 'ระบบแสดงผลหรือทำงานไม่ถูกต้อง' },
  {
    value: 'blocker',
    label: 'ติดขัดการใช้งาน',
    description: 'มีขั้นตอนที่ทำให้ไม่สามารถทำงานต่อได้',
  },
  { value: 'general', label: 'ความคิดเห็นทั่วไป', description: 'บอกเล่าประสบการณ์ใช้งานระบบ' },
];

const STATUS_OPTIONS: Array<{ value: FeedbackStatus; label: string }> = [
  { value: 'new', label: 'รับเรื่องแล้ว' },
  { value: 'reviewing', label: 'กำลังตรวจสอบ' },
  { value: 'planned', label: 'อยู่ในแผน' },
  { value: 'resolved', label: 'ดำเนินการแล้ว' },
  { value: 'closed', label: 'ปิดเรื่อง' },
];

const EMPTY_FORM = {
  category: 'feature' as FeedbackCategory,
  title: '',
  systemArea: '',
  currentBehavior: '',
  requestedChange: '',
  blockerDetail: '',
  pageUrl: '',
};

export function MarketplaceFeedbackView() {
  const { user } = useAuthContext();
  const isAdmin = user?.role === 'master_admin';
  const [form, setForm] = useState(EMPTY_FORM);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/marketplace/feedback', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'โหลด Feedback ไม่สำเร็จ');
      setFeedback(result.feedback ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลด Feedback ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) void loadFeedback();
  }, [loadFeedback, user?.id]);

  const setField = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submitFeedback = async () => {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/marketplace/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'ส่ง Feedback ไม่สำเร็จ');
      setForm(EMPTY_FORM);
      setSuccess('ส่ง Feedback เรียบร้อยแล้ว ทีมงานสามารถติดตามเรื่องนี้ได้จากระบบ');
      await loadFeedback();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ส่ง Feedback ไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const updateFeedback = async (item: FeedbackItem) => {
    setSavingId(item.id);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/marketplace/feedback/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: item.status, adminNote: item.admin_note ?? '' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'อัปเดต Feedback ไม่สำเร็จ');
      setFeedback((current) =>
        current.map((entry) => (entry.id === item.id ? result.feedback : entry))
      );
      setSuccess('อัปเดตสถานะ Feedback แล้ว');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'อัปเดต Feedback ไม่สำเร็จ');
    } finally {
      setSavingId('');
    }
  };

  const selectedCategory = CATEGORY_OPTIONS.find((option) => option.value === form.category)!;
  const detailLength =
    form.currentBehavior.trim().length +
    form.requestedChange.trim().length +
    form.blockerDetail.trim().length;
  const canSubmit = form.title.trim().length >= 3 && detailLength >= 10;

  if (isAdmin) {
    return (
      <AdminFeedbackList
        feedback={feedback}
        loading={loading}
        savingId={savingId}
        error={error}
        success={success}
        onChange={(updated) =>
          setFeedback((current) =>
            current.map((entry) => (entry.id === updated.id ? updated : entry))
          )
        }
        onSave={updateFeedback}
      />
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 52,
            height: 52,
            display: 'grid',
            flexShrink: 0,
            borderRadius: 2,
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: 'primary.lighter',
          }}
        >
          <RiFeedbackLine size={28} />
        </Box>
        <Box>
          <Typography component="h1" variant="h3">
            Feedback
          </Typography>
          <Typography color="text.secondary">
            บอกเราว่าระบบปัจจุบันเป็นอย่างไร อยากเพิ่มหรือแก้ไขส่วนไหน และติดขัดตรงใด
          </Typography>
        </Box>
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
      {!!success && (
        <Alert severity="success" sx={{ mt: 3 }}>
          {success}
        </Alert>
      )}

      <Card variant="outlined" sx={{ p: { xs: 2.5, md: 4 }, mt: 3 }}>
        <Typography variant="h5">ส่งความคิดเห็นถึงทีมพัฒนา</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          ยิ่งระบุขั้นตอนและผลลัพธ์ที่ต้องการชัดเจน ทีมงานยิ่งตรวจสอบและนำไปพัฒนาต่อได้เร็ว
        </Typography>

        <Box
          sx={{
            gap: 2.5,
            mt: 3,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          <TextField
            select
            required
            label="ประเภท Feedback"
            value={form.category}
            onChange={(event) => setField('category', event.target.value as FeedbackCategory)}
            helperText={selectedCategory.description}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="ส่วนของระบบ"
            placeholder="เช่น ตะกร้า, Checkout, ร้านค้า, License"
            value={form.systemArea}
            onChange={(event) => setField('systemArea', event.target.value)}
          />
          <TextField
            required
            label="หัวข้อ"
            placeholder="สรุปเรื่องที่ต้องการแจ้ง"
            value={form.title}
            onChange={(event) => setField('title', event.target.value)}
            sx={{ gridColumn: { md: '1 / -1' } }}
          />
          <TextField
            multiline
            minRows={4}
            label="ระบบปัจจุบันเป็นอย่างไร"
            placeholder="อธิบายสิ่งที่เห็น ขั้นตอนที่ทำ และผลลัพธ์ที่เกิดขึ้น"
            value={form.currentBehavior}
            onChange={(event) => setField('currentBehavior', event.target.value)}
          />
          <TextField
            multiline
            minRows={4}
            label="อยากให้เพิ่มหรือแก้ไขอย่างไร"
            placeholder="อธิบายผลลัพธ์หรือรูปแบบที่ต้องการ"
            value={form.requestedChange}
            onChange={(event) => setField('requestedChange', event.target.value)}
          />
          <TextField
            multiline
            minRows={3}
            label="ติดขัดตรงไหน"
            placeholder="ระบุจุดที่ทำงานต่อไม่ได้ ข้อความ Error หรือสิ่งที่ทำให้สับสน"
            value={form.blockerDetail}
            onChange={(event) => setField('blockerDetail', event.target.value)}
            sx={{ gridColumn: { md: '1 / -1' } }}
          />
          <TextField
            label="URL หน้าที่เกี่ยวข้อง"
            placeholder="/dashboard/..."
            value={form.pageUrl}
            onChange={(event) => setField('pageUrl', event.target.value)}
            helperText="ไม่บังคับ ห้ามใส่รหัสผ่านหรือข้อมูลลับ"
            sx={{ gridColumn: { md: '1 / -1' } }}
          />
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
          <Button
            size="large"
            variant="contained"
            startIcon={<RiSendPlaneLine />}
            loading={submitting}
            disabled={!canSubmit}
            onClick={submitFeedback}
          >
            ส่ง Feedback
          </Button>
          <Button color="inherit" disabled={submitting} onClick={() => setForm(EMPTY_FORM)}>
            ล้างข้อมูล
          </Button>
        </Stack>
      </Card>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 5, mb: 2 }}>
        <Box>
          <Typography variant="h5">{isAdmin ? 'Feedback ทั้งหมด' : 'Feedback ของฉัน'}</Typography>
          <Typography variant="body2" color="text.secondary">
            {isAdmin
              ? 'ตรวจสอบข้อเสนอและอัปเดตสถานะให้ผู้ส่งติดตามได้'
              : 'ติดตามสถานะและคำตอบจากทีมงาน'}
          </Typography>
        </Box>
        <Chip label={`${feedback.length} รายการ`} variant="soft" color="primary" />
      </Stack>

      {loading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : feedback.length ? (
        <Stack spacing={2}>
          {feedback.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              saving={savingId === item.id}
              onChange={(updated) =>
                setFeedback((current) =>
                  current.map((entry) => (entry.id === updated.id ? updated : entry))
                )
              }
              onSave={() => updateFeedback(item)}
            />
          ))}
        </Stack>
      ) : (
        <Card variant="outlined" sx={{ py: 8, textAlign: 'center', borderStyle: 'dashed' }}>
          <RiLightbulbLine size={44} />
          <Typography variant="h6" sx={{ mt: 1.5 }}>
            ยังไม่มี Feedback
          </Typography>
          <Typography color="text.secondary">ความคิดเห็นรายการแรกสามารถเริ่มได้จากฟอร์มด้านบน</Typography>
        </Card>
      )}
    </Container>
  );
}

function AdminFeedbackList({
  feedback,
  loading,
  savingId,
  error,
  success,
  onChange,
  onSave,
}: {
  feedback: FeedbackItem[];
  loading: boolean;
  savingId: string;
  error: string;
  success: string;
  onChange: (item: FeedbackItem) => void;
  onSave: (item: FeedbackItem) => void;
}) {
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const visibleFeedback = feedback.filter(
    (item) =>
      (!statusFilter || item.status === statusFilter) &&
      (!categoryFilter || item.category === categoryFilter)
  );
  const pendingCount = feedback.filter((item) =>
    ['new', 'reviewing'].includes(item.status)
  ).length;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 52,
              height: 52,
              display: 'grid',
              flexShrink: 0,
              borderRadius: 2,
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: 'primary.lighter',
            }}
          >
            <RiFeedbackLine size={28} />
          </Box>
          <Box>
            <Typography component="h1" variant="h3">
              Feedback จากผู้ใช้งาน
            </Typography>
            <Typography color="text.secondary">
              ตรวจสอบรายละเอียด จัดลำดับ และแจ้งสถานะกลับไปยังผู้ส่ง
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={`ทั้งหมด ${feedback.length}`} variant="soft" color="primary" />
          <Chip label={`รอตรวจ ${pendingCount}`} variant="soft" color="warning" />
        </Stack>
      </Stack>

      {!!error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
      {!!success && (
        <Alert severity="success" sx={{ mt: 3 }}>
          {success}
        </Alert>
      )}

      <Card variant="outlined" sx={{ p: 2.5, mt: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            select
            label="สถานะ"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">ทุกสถานะ</MenuItem>
            {STATUS_OPTIONS.map((status) => (
              <MenuItem key={status.value} value={status.value}>
                {status.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="ประเภท Feedback"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            sx={{ minWidth: 240 }}
          >
            <MenuItem value="">ทุกประเภท</MenuItem>
            {CATEGORY_OPTIONS.map((category) => (
              <MenuItem key={category.value} value={category.value}>
                {category.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Card>

      {loading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : visibleFeedback.length ? (
        <Stack spacing={2} sx={{ mt: 3 }}>
          {visibleFeedback.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              isAdmin
              saving={savingId === item.id}
              onChange={onChange}
              onSave={() => onSave(item)}
            />
          ))}
        </Stack>
      ) : (
        <Card variant="outlined" sx={{ py: 8, mt: 3, textAlign: 'center', borderStyle: 'dashed' }}>
          <RiLightbulbLine size={44} />
          <Typography variant="h6" sx={{ mt: 1.5 }}>
            ไม่พบ Feedback
          </Typography>
          <Typography color="text.secondary">
            ยังไม่มีรายการที่ตรงกับตัวกรองที่เลือก
          </Typography>
        </Card>
      )}
    </Container>
  );
}

function FeedbackCard({
  item,
  isAdmin,
  saving,
  onChange,
  onSave,
}: {
  item: FeedbackItem;
  isAdmin: boolean;
  saving: boolean;
  onChange: (item: FeedbackItem) => void;
  onSave: () => void;
}) {
  const category = CATEGORY_OPTIONS.find((option) => option.value === item.category)!;

  return (
    <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'flex-start' }}
        spacing={2}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <CategoryIcon category={item.category} />
            <Chip size="small" label={category.label} variant="soft" color="primary" />
            <StatusChip status={item.status} />
            {item.system_area && <Chip size="small" label={item.system_area} variant="outlined" />}
          </Stack>
          <Typography variant="h6" sx={{ mt: 1.5 }}>
            {item.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isAdmin && `${item.reporter_username} (${item.reporter_role}) · `}
            {new Date(item.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          gap: 2,
          mt: 2.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        <FeedbackDetail label="ระบบปัจจุบัน" value={item.current_behavior} />
        <FeedbackDetail label="สิ่งที่อยากเพิ่มหรือแก้" value={item.requested_change} />
        <FeedbackDetail label="จุดที่ติดขัด" value={item.blocker_detail} />
      </Box>
      {item.page_url && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          หน้าที่เกี่ยวข้อง: {item.page_url}
        </Typography>
      )}

      {(isAdmin || item.admin_note) && (
        <>
          <Divider sx={{ my: 2.5 }} />
          {isAdmin ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  select
                  label="สถานะ"
                  value={item.status}
                  onChange={(event) =>
                    onChange({ ...item, status: event.target.value as FeedbackStatus })
                  }
                  sx={{ minWidth: { sm: 200 } }}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="หมายเหตุจากทีมงาน"
                  value={item.admin_note ?? ''}
                  onChange={(event) => onChange({ ...item, admin_note: event.target.value })}
                />
              </Stack>
              <Button
                variant="contained"
                loading={saving}
                onClick={onSave}
                sx={{ alignSelf: 'flex-start' }}
              >
                บันทึกการติดตาม
              </Button>
            </Stack>
          ) : (
            <Alert severity="info">ทีมงาน: {item.admin_note}</Alert>
          )}
        </>
      )}
    </Card>
  );
}

function FeedbackDetail({ label, value }: { label: string; value: string | null }) {
  return (
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.neutral' }}>
      <Typography variant="subtitle2">{label}</Typography>
      <Typography
        variant="body2"
        color={value ? 'text.secondary' : 'text.disabled'}
        sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}
      >
        {value || 'ไม่ได้ระบุ'}
      </Typography>
    </Box>
  );
}

function CategoryIcon({ category }: { category: FeedbackCategory }) {
  if (category === 'feature') return <RiLightbulbLine size={21} />;
  if (category === 'bug') return <RiBugLine size={21} />;
  if (category === 'blocker') return <RiErrorWarningLine size={21} />;
  if (category === 'improvement') return <RiToolsLine size={21} />;
  return <RiFeedbackLine size={21} />;
}

function StatusChip({ status }: { status: FeedbackStatus }) {
  const label = STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
  if (status === 'resolved') return <Chip size="small" color="success" label={label} />;
  if (status === 'planned') return <Chip size="small" color="info" label={label} />;
  if (status === 'reviewing') return <Chip size="small" color="warning" label={label} />;
  if (status === 'closed') return <Chip size="small" color="default" label={label} />;
  return <Chip size="small" color="primary" variant="outlined" label={label} />;
}
