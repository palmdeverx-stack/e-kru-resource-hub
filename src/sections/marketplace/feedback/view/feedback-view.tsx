'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

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
import Pagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { apiFetch as fetch } from 'src/lib/api-fetch';

import {
  RiAddLine,
  RiBugLine,
  RiToolsLine,
  RiFeedbackLine,
  RiLightbulbLine,
  RiErrorWarningLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import {
  type FeedbackCategory,
  MarketplaceFeedbackDialog,
  FEEDBACK_CATEGORY_OPTIONS as CATEGORY_OPTIONS,
} from './feedback-dialog';

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

const STATUS_OPTIONS: Array<{ value: FeedbackStatus; label: string }> = [
  { value: 'new', label: 'รับเรื่องแล้ว' },
  { value: 'reviewing', label: 'กำลังตรวจสอบ' },
  { value: 'planned', label: 'อยู่ในแผน' },
  { value: 'resolved', label: 'ดำเนินการแล้ว' },
  { value: 'closed', label: 'ปิดเรื่อง' },
];

export function MarketplaceFeedbackView() {
  const { user } = useAuthContext();
  const isAdmin = user?.role === 'master_admin';
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [counts, setCounts] = useState({ all: 0, pending: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const draftsRef = useRef(new Map<string, FeedbackItem>());
  const saveInProgressRef = useRef(false);
  const changeFeedback = (updated: FeedbackItem) => {
    draftsRef.current.set(updated.id, updated);
    setFeedback((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
  };
  const requestRef = useRef<AbortController | null>(null);

  const loadFeedback = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        status: statusFilter,
        category: categoryFilter,
      });
      const response = await fetch(`/api/marketplace/feedback?${params}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result.message ?? 'โหลด Feedback ไม่สำเร็จ');
      if (page > Math.max(1, result.pagination?.totalPages ?? 0)) {
        setPage(Math.max(1, result.pagination?.totalPages ?? 0));
        return;
      }
      setFeedback(
        (result.feedback ?? []).map((item: FeedbackItem) => draftsRef.current.get(item.id) ?? item)
      );
      setTotalPages(result.pagination?.totalPages ?? 0);
      setCounts(result.counts ?? { all: 0, pending: 0 });
    } catch (loadError) {
      if (controller.signal.aborted) return;
      setError(loadError instanceof Error ? loadError.message : 'โหลด Feedback ไม่สำเร็จ');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [page, statusFilter, categoryFilter]);

  useEffect(() => {
    if (user?.id) void loadFeedback();
    return () => requestRef.current?.abort();
  }, [loadFeedback, user?.id]);

  const updateFeedback = async (item: FeedbackItem) => {
    if (saveInProgressRef.current) return;
    saveInProgressRef.current = true;
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
      draftsRef.current.delete(item.id);
      setFeedback((current) =>
        current.map((entry) => (entry.id === item.id ? result.feedback : entry))
      );
      setSuccess('อัปเดตสถานะ Feedback แล้ว');
      await loadFeedback();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'อัปเดต Feedback ไม่สำเร็จ');
    } finally {
      saveInProgressRef.current = false;
      setSavingId('');
    }
  };

  if (isAdmin) {
    return (
      <AdminFeedbackList
        feedback={feedback}
        counts={counts}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        statusFilter={statusFilter}
        categoryFilter={categoryFilter}
        onStatusFilterChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
        onCategoryFilterChange={(value) => {
          setCategoryFilter(value);
          setPage(1);
        }}
        loading={loading}
        savingId={savingId}
        error={error}
        success={success}
        onChange={changeFeedback}
        onSave={updateFeedback}
      />
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Stack
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
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
              Feedback
            </Typography>
            <Typography color="text.secondary">
              บอกเราว่าระบบปัจจุบันเป็นอย่างไร อยากเพิ่มหรือแก้ไขส่วนไหน และติดขัดตรงใด
            </Typography>
          </Box>
        </Stack>
        <Button
          variant="contained"
          startIcon={<RiAddLine />}
          onClick={() => {
            setError('');
            setSuccess('');
            setDialogOpen(true);
          }}
          sx={{ flexShrink: 0 }}
        >
          ส่งความคิดเห็น
        </Button>
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

      <MarketplaceFeedbackDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmitted={async () => {
          setError('');
          setSuccess('ส่งความคิดเห็นเรียบร้อยแล้ว สามารถติดตามสถานะได้จากรายการด้านล่าง');
          if (page !== 1) setPage(1);
          else await loadFeedback();
        }}
      />

      {loading ? (
        <Box sx={{ py: 8, textAlign: 'center', mt: 3 }}>
          <CircularProgress />
        </Box>
      ) : feedback.length ? (
        <Stack spacing={2} sx={{ mt: 3 }}>
          {feedback.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              saving={savingId === item.id}
              disabled={Boolean(savingId)}
              onChange={changeFeedback}
              onSave={() => updateFeedback(item)}
            />
          ))}
        </Stack>
      ) : (
        <Card
          variant="outlined"
          sx={{ py: 7, px: 3, textAlign: 'center', borderRadius: 3, borderStyle: 'dashed', mt: 3 }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              mx: 'auto',
              display: 'grid',
              borderRadius: 3,
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: 'primary.lighter',
            }}
          >
            <RiLightbulbLine size={44} />
          </Box>
          <Typography variant="h6" sx={{ mt: 3 }}>
            ยังไม่มี Feedback
          </Typography>
          <Typography color="text.secondary">
            กดปุ่มส่งความคิดเห็นเพื่อเริ่มแจ้งเรื่องแรก
          </Typography>
        </Card>
      )}
      {totalPages > 1 && (
        <Pagination
          count={totalPages}
          page={page}
          onChange={(_, value) => setPage(value)}
          disabled={loading}
          sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}
        />
      )}
    </Container>
  );
}

function AdminFeedbackList({
  feedback,
  counts,
  page,
  totalPages,
  onPageChange,
  statusFilter,
  categoryFilter,
  onStatusFilterChange,
  onCategoryFilterChange,
  loading,
  savingId,
  error,
  success,
  onChange,
  onSave,
}: {
  feedback: FeedbackItem[];
  counts: { all: number; pending: number };
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  statusFilter: string;
  categoryFilter: string;
  onStatusFilterChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  loading: boolean;
  savingId: string;
  error: string;
  success: string;
  onChange: (item: FeedbackItem) => void;
  onSave: (item: FeedbackItem) => void;
}) {
  return (
    <Container maxWidth={false} sx={{ py: { xs: 3 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
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
          <Chip label={`ทั้งหมด ${counts.all}`} variant="soft" color="primary" />
          <Chip label={`รอตรวจ ${counts.pending}`} variant="soft" color="warning" />
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
            onChange={(event) => onStatusFilterChange(event.target.value)}
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
            onChange={(event) => onCategoryFilterChange(event.target.value)}
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
      ) : feedback.length ? (
        <Stack spacing={2} sx={{ mt: 3 }}>
          {feedback.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              isAdmin
              saving={savingId === item.id}
              disabled={Boolean(savingId)}
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
          <Typography color="text.secondary">ยังไม่มีรายการที่ตรงกับตัวกรองที่เลือก</Typography>
        </Card>
      )}
      {totalPages > 1 && (
        <Pagination
          count={totalPages}
          page={page}
          onChange={(_, value) => onPageChange(value)}
          disabled={loading}
          sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}
        />
      )}
    </Container>
  );
}

function FeedbackCard({
  item,
  isAdmin,
  saving,
  disabled,
  onChange,
  onSave,
}: {
  item: FeedbackItem;
  isAdmin: boolean;
  saving: boolean;
  disabled: boolean;
  onChange: (item: FeedbackItem) => void;
  onSave: () => void;
}) {
  const category = CATEGORY_OPTIONS.find((option) => option.value === item.category);

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
            <Chip
              size="small"
              label={category?.label ?? item.category}
              variant="soft"
              color="primary"
            />
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
                  disabled={disabled}
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
                  disabled={disabled}
                  slotProps={{ htmlInput: { maxLength: 2000 } }}
                  label="หมายเหตุจากผู้ดูแลแพลตฟอร์ม"
                  value={item.admin_note ?? ''}
                  onChange={(event) => onChange({ ...item, admin_note: event.target.value })}
                />
              </Stack>
              <Button
                variant="contained"
                loading={saving}
                disabled={disabled}
                onClick={onSave}
                sx={{ alignSelf: 'flex-start' }}
              >
                บันทึกการติดตาม
              </Button>
            </Stack>
          ) : (
            <Alert severity="info">ผู้ดูแลแพลตฟอร์ม: {item.admin_note}</Alert>
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
        sx={{ mt: 0.75, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
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
