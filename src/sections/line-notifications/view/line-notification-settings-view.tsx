'use client';

import type { LineNotificationSettingsInput } from '../line-notification-actions';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';

import { LineRichMenuCard } from '../components/line-rich-menu-card';
import {
  testLineConnection,
  getLineNotificationSettings,
  saveLineNotificationSettings,
} from '../line-notification-actions';

// ----------------------------------------------------------------------

const EMPTY_FORM: LineNotificationSettingsInput = {
  channelId: '',
  oaBasicId: '',
  webhookUrl: '',
  channelSecret: '',
  accessToken: '',
  isEnabled: false,
  notifyAbsent: true,
  notifyLeave: true,
  notifyLate: true,
  notifyClassAbsent: true,
};

const EVENT_LABEL = {
  absent: 'ขาด',
  leave: 'ลา',
  late: 'สาย',
  class_absent: 'ไม่เข้าเรียนรายคาบ',
  announcement: 'ประกาศ',
};

const STATUS_COLOR = {
  pending: 'warning',
  processing: 'info',
  sent: 'success',
  failed: 'error',
  skipped: 'default',
} as const;

export function LineNotificationSettingsView() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [copied, setCopied] = useState(false);
  const [editingCredentials, setEditingCredentials] = useState(false);

  const query = useQuery({
    queryKey: ['line-notification-settings'],
    queryFn: getLineNotificationSettings,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 10000,
  });
  const saveMutation = useMutation({
    mutationFn: saveLineNotificationSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['line-notification-settings'] });
      setForm((current) => ({ ...current, channelSecret: '', accessToken: '' }));
      setEditingCredentials(false);
    },
  });
  const testMutation = useMutation({ mutationFn: testLineConnection });

  useEffect(() => {
    if (!query.data) return;
    setForm({
      channelId: query.data.integration.channelId,
      oaBasicId: query.data.integration.oaBasicId,
      webhookUrl: query.data.webhookUrl,
      channelSecret: '',
      accessToken: '',
      isEnabled: query.data.integration.isEnabled,
      notifyAbsent: query.data.integration.notifyAbsent,
      notifyLeave: query.data.integration.notifyLeave,
      notifyLate: query.data.integration.notifyLate,
      notifyClassAbsent: query.data.integration.notifyClassAbsent,
    });
  }, [query.data]);

  const setField = <K extends keyof LineNotificationSettingsInput>(
    key: K,
    value: LineNotificationSettingsInput[K]
  ) => setForm((current) => ({ ...current, [key]: value }));

  if (query.isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <Typography sx={{ color: 'text.secondary' }}>กำลังโหลดการตั้งค่า LINE...</Typography>
      </Container>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="error">{query.error?.message ?? 'ไม่สามารถโหลดการตั้งค่า LINE ได้'}</Alert>
      </Container>
    );
  }

  const { integration, usage, recentDeliveries, webhookUrl } = query.data;
  const connectionLocked = Boolean(integration.channelId) && !editingCredentials;
  const secretLocked = integration.hasChannelSecret && !editingCredentials;
  const tokenLocked = integration.hasAccessToken && !editingCredentials;
  const percent =
    usage.limit === 0 ? 0 : Math.min(100, Math.round((usage.sent / usage.limit) * 100));

  return (
    <Container maxWidth={false} sx={{ pb: 6 }}>
      <Box
        sx={{
          mb: 4,
          gap: 2,
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            แจ้งเตือนผู้ปกครองผ่าน LINE
          </Typography>
          <Typography sx={{ mt: 0.75, color: 'text.secondary' }}>
            ส่งเฉพาะเหตุการณ์สำคัญเพื่อลดค่าใช้จ่าย: ขาด ลา สาย และไม่เข้าเรียนรายคาบ
          </Typography>
        </Box>
        <Chip
          color={integration.isEnabled ? 'success' : 'default'}
          icon={
            <RemixIcon
              icon={integration.isEnabled ? 'solar:check-circle-bold' : 'solar:close-circle-bold'}
            />
          }
          label={integration.isEnabled ? 'เปิดใช้งาน' : 'ยังไม่เปิดใช้งาน'}
        />
      </Box>

      {(saveMutation.error ||
        saveMutation.isSuccess ||
        testMutation.error ||
        testMutation.isSuccess) && (
        <Alert
          severity={saveMutation.error || testMutation.error ? 'error' : 'success'}
          sx={{ mb: 3 }}
        >
          {saveMutation.error?.message ??
            testMutation.error?.message ??
            (testMutation.isSuccess
              ? `เชื่อมต่อ ${testMutation.data.bot.displayName ?? 'LINE Official Account'} สำเร็จ`
              : 'บันทึกการตั้งค่าเรียบร้อยแล้ว')}
        </Alert>
      )}

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
        }}
      >
        <Box sx={{ gap: 3, display: 'grid' }}>
          <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
            <Box
              sx={{
                gap: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="h6">เชื่อม LINE Official Account</Typography>
              {(integration.channelId ||
                integration.hasChannelSecret ||
                integration.hasAccessToken) &&
                (editingCredentials ? (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => {
                      setEditingCredentials(false);
                      setForm((current) => ({
                        ...current,
                        channelId: integration.channelId,
                        oaBasicId: integration.oaBasicId,
                        webhookUrl,
                        channelSecret: '',
                        accessToken: '',
                      }));
                    }}
                  >
                    ยกเลิกแก้ไข
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RemixIcon icon="solar:pen-bold" />}
                    onClick={() => setEditingCredentials(true)}
                  >
                    แก้ไขข้อมูลเชื่อมต่อ
                  </Button>
                ))}
            </Box>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              กดแก้ไขเมื่อต้องการเปลี่ยน Channel, Credentials หรือ Webhook URL
            </Typography>
            <Box
              sx={{
                gap: 2,
                mt: 3,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              <TextField
                required
                label="Channel ID"
                value={form.channelId}
                onChange={(event) => setField('channelId', event.target.value)}
                slotProps={{ input: { readOnly: connectionLocked } }}
              />
              <TextField
                label="LINE OA Basic ID"
                placeholder="@school"
                value={form.oaBasicId}
                onChange={(event) => setField('oaBasicId', event.target.value)}
                slotProps={{ input: { readOnly: connectionLocked } }}
              />
              <TextField
                type={secretLocked ? 'text' : 'password'}
                label="Channel secret"
                placeholder="กรอก Channel secret"
                value={secretLocked ? '************' : form.channelSecret}
                onChange={(event) => setField('channelSecret', event.target.value)}
                helperText={
                  secretLocked
                    ? 'บันทึกไว้แล้ว · กดแก้ไขเมื่อต้องการเปลี่ยน'
                    : integration.hasChannelSecret
                      ? 'กรอกค่าใหม่ หรือเว้นว่างเพื่อใช้ค่าเดิม'
                      : 'ยังไม่ได้บันทึก'
                }
                slotProps={{
                  inputLabel: { shrink: true },
                  input: { readOnly: secretLocked },
                  htmlInput: { autoComplete: 'new-password' },
                }}
              />
              <TextField
                type={tokenLocked ? 'text' : 'password'}
                label="Channel access token"
                placeholder="กรอก Access token"
                value={tokenLocked ? '************' : form.accessToken}
                onChange={(event) => setField('accessToken', event.target.value)}
                helperText={
                  tokenLocked
                    ? 'บันทึกไว้แล้ว · กดแก้ไขเมื่อต้องการเปลี่ยน'
                    : integration.hasAccessToken
                      ? 'กรอกค่าใหม่ หรือเว้นว่างเพื่อใช้ค่าเดิม'
                      : 'ยังไม่ได้บันทึก'
                }
                slotProps={{
                  inputLabel: { shrink: true },
                  input: { readOnly: tokenLocked },
                  htmlInput: { autoComplete: 'new-password' },
                }}
              />
              <TextField
                fullWidth
                label="Webhook URL"
                value={form.webhookUrl}
                onChange={(event) => setField('webhookUrl', event.target.value)}
                helperText={
                  connectionLocked
                    ? 'บันทึกไว้แล้ว · กดแก้ไขข้อมูลเชื่อมต่อเมื่อต้องการเปลี่ยน'
                    : 'ต้องเป็น HTTPS และมีเครื่องหมาย / ต่อท้าย URL เพื่อไม่ให้ LINE ได้รับ 308'
                }
                slotProps={{ input: { readOnly: connectionLocked } }}
                sx={{ gridColumn: { sm: '1 / -1' } }}
              />
            </Box>
            {(!form.webhookUrl.startsWith('https://') ||
              form.webhookUrl.includes('localhost') ||
              form.webhookUrl.includes('127.0.0.1')) && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Webhook นี้เป็น Local URL ซึ่ง LINE เรียกกลับไม่ได้ กรุณาใช้โดเมน HTTPS ที่ Deploy
                แล้ว หรือเปิด HTTPS Tunnel สำหรับทดสอบ
              </Alert>
            )}
            <Box sx={{ gap: 1, mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                color="inherit"
                startIcon={
                  <RemixIcon icon={copied ? 'solar:check-circle-bold' : 'solar:copy-bold'} />
                }
                onClick={async () => {
                  await navigator.clipboard.writeText(form.webhookUrl);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? 'คัดลอกแล้ว' : 'คัดลอก Webhook'}
              </Button>
              <Button
                variant="outlined"
                loading={testMutation.isPending}
                disabled={!integration.hasAccessToken && !form.accessToken}
                onClick={() =>
                  form.accessToken
                    ? saveMutation.mutate(form, {
                        onSuccess: () => testMutation.mutate(),
                      })
                    : testMutation.mutate()
                }
              >
                ทดสอบการเชื่อมต่อ
              </Button>
            </Box>
          </Card>

          <LineRichMenuCard hasAccessToken={integration.hasAccessToken} />

          <Alert
            severity="info"
            action={
              <Button
                size="small"
                color="inherit"
                component={RouterLink}
                href={paths.admin.schoolHolidays}
              >
                จัดการวันหยุด
              </Button>
            }
          >
            ระบบจะไม่ส่งแจ้งเตือนขาด/ลา/สาย ผ่าน LINE ในวันหยุดโรงเรียน — ตั้งค่าวันหยุดได้ที่เมนู
            “วันหยุดโรงเรียน”
          </Alert>

          <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h6">เหตุการณ์ที่ส่งแจ้งเตือน</Typography>
            <Box sx={{ mt: 2 }}>
              {[
                ['notifyAbsent', 'ขาดเข้าแถว', 'แจ้งเมื่อบันทึกว่าขาดช่วงเช้าหรือเย็น'],
                ['notifyLeave', 'ลา', 'แจ้งเมื่อครูบันทึกสถานะลา'],
                ['notifyLate', 'สาย', 'แจ้งเมื่อครูบันทึกว่าสายหรือสแกนหลังเวลาที่กำหนด'],
                [
                  'notifyClassAbsent',
                  'ไม่เข้าเรียนรายคาบ',
                  'แจ้งเมื่อขาดวิชาหรือไม่สแกนก่อนปิดรอบรายคาบ',
                ],
              ].map(([key, label, description]) => (
                <Box
                  key={key}
                  sx={{
                    py: 1.25,
                    gap: 2,
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2">{label}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {description}
                    </Typography>
                  </Box>
                  <Switch
                    checked={Boolean(form[key as keyof LineNotificationSettingsInput])}
                    onChange={(event) =>
                      setField(
                        key as 'notifyAbsent' | 'notifyLeave' | 'notifyLate' | 'notifyClassAbsent',
                        event.target.checked
                      )
                    }
                  />
                </Box>
              ))}
            </Box>
            <Divider sx={{ my: 2.5 }} />
            <FormControlLabel
              label="เปิดส่งแจ้งเตือนอัตโนมัติ"
              control={
                <Switch
                  checked={form.isEnabled}
                  onChange={(event) => setField('isEnabled', event.target.checked)}
                />
              }
            />
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                loading={saveMutation.isPending}
                disabled={!form.channelId}
                onClick={() => saveMutation.mutate(form)}
              >
                บันทึกการตั้งค่า
              </Button>
            </Box>
          </Card>
        </Box>

        <Box sx={{ gap: 3, display: 'grid' }}>
          <Card variant="outlined" sx={{ p: 3 }}>
            <Typography variant="subtitle1">การใช้งานเดือนนี้</Typography>
            <Typography variant="h3" sx={{ mt: 1 }}>
              {usage.sent.toLocaleString('th-TH')}
              <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
                / {usage.limit === 0 ? 'ไม่จำกัด' : usage.limit.toLocaleString('th-TH')} ข้อความ
              </Typography>
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              นับเฉพาะข้อความที่ LINE รับและส่งสำเร็จแล้ว
            </Typography>
            <Box sx={{ gap: 1, mt: 1.5, display: 'flex', flexWrap: 'wrap' }}>
              <Chip
                size="small"
                color={usage.pending ? 'warning' : 'default'}
                label={`รอส่ง ${usage.pending.toLocaleString('th-TH')}`}
                variant="soft"
              />
              <Chip
                size="small"
                color={usage.failed ? 'error' : 'default'}
                label={`กำลังลองใหม่ ${usage.failed.toLocaleString('th-TH')}`}
                variant="soft"
              />
              <Chip
                size="small"
                color={usage.skipped ? 'error' : 'default'}
                label={`ไม่สำเร็จ ${usage.skipped.toLocaleString('th-TH')}`}
                variant="soft"
              />
            </Box>
            {usage.limit > 0 && (
              <LinearProgress
                variant="determinate"
                value={percent}
                color={percent >= 90 ? 'error' : percent >= 70 ? 'warning' : 'primary'}
                sx={{ mt: 2, height: 7, borderRadius: 1 }}
              />
            )}
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2">
              ผู้ปกครองเชื่อม LINE แล้ว {usage.linkedGuardians.toLocaleString('th-TH')} คน
            </Typography>
          </Card>

          <Card variant="outlined" sx={{ p: 3 }}>
            <Typography variant="subtitle1">ประวัติล่าสุด</Typography>
            <Box sx={{ mt: 1.5 }}>
              {!recentDeliveries.length && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  ยังไม่มีรายการแจ้งเตือน
                </Typography>
              )}
              {recentDeliveries.slice(0, 8).map((item) => {
                const student = Array.isArray(item.student) ? item.student[0] : item.student;
                const guardian = Array.isArray(item.guardian) ? item.guardian[0] : item.guardian;
                const studentName = student
                  ? `${student.name_prefix ?? ''}${student.first_name ?? ''} ${
                      student.last_name ?? ''
                    }`.trim() || student.username
                  : 'นักเรียน';
                return (
                  <Box
                    key={item.id}
                    sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Box sx={{ gap: 1, display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="subtitle2">{studentName}</Typography>
                      <Chip
                        size="small"
                        color={STATUS_COLOR[item.status]}
                        label={item.status === 'sent' ? 'ส่งแล้ว' : item.status}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {EVENT_LABEL[item.event_type]} · {guardian?.full_name ?? 'ผู้ปกครอง'}
                    </Typography>
                    {item.last_error && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'error.main' }}>
                        {item.last_error}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Card>
        </Box>
      </Box>
    </Container>
  );
}
