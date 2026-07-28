'use client';

import type { SchoolFeatureKey } from 'src/lib/school-subscription-config';
import type { SubscriptionPlan } from 'src/sections/subscription-plan/subscription-plan-actions';
import type {
  BillingCycle,
  SubscriptionStatus,
  UpdateSchoolSubscriptionParams,
} from '../school-subscription-actions';

import dayjs from 'dayjs';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { SCHOOL_FEATURES, SUBSCRIPTION_STATUS_LABEL } from 'src/lib/school-subscription-config';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';

import { listSubscriptionPlans } from 'src/sections/subscription-plan/subscription-plan-actions';

import { getSchoolSubscription, updateSchoolSubscription } from '../school-subscription-actions';

// ----------------------------------------------------------------------

type FormState = UpdateSchoolSubscriptionParams;

const STATUS_COLOR: Record<
  SubscriptionStatus,
  'success' | 'info' | 'warning' | 'error' | 'default'
> = {
  trialing: 'info',
  active: 'success',
  past_due: 'warning',
  suspended: 'error',
  canceled: 'default',
};

const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: 'เดือน',
  yearly: 'ปี',
  custom: 'ตามสัญญา',
};

function toForm(data: Awaited<ReturnType<typeof getSchoolSubscription>>): FormState {
  const subscription = data.subscription;
  return {
    planName: subscription.plan_name,
    status: subscription.status,
    billingCycle: subscription.billing_cycle,
    price: Number(subscription.price),
    startsAt: subscription.starts_at,
    endsAt: subscription.ends_at,
    maxSchoolAdmins: subscription.max_school_admins,
    maxTeachers: subscription.max_teachers,
    maxStudents: subscription.max_students,
    maxLineNotifications: subscription.max_line_notifications,
    enabledFeatures: subscription.enabled_features,
    notes: subscription.notes ?? '',
  };
}

export function SchoolSubscriptionView({ schoolId }: { schoolId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [featureGroup, setFeatureGroup] = useState('ผู้ดูแลโรงเรียน');

  const subscriptionQuery = useQuery({
    queryKey: ['school-subscription-management', schoolId],
    queryFn: () => getSchoolSubscription(schoolId),
  });
  const plansQuery = useQuery({
    queryKey: ['subscription-plans', 'active'],
    queryFn: () => listSubscriptionPlans(false),
  });
  const updateMutation = useMutation({
    mutationFn: (values: FormState) => updateSchoolSubscription(schoolId, values),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['school-subscription-management', schoolId],
        }),
        queryClient.invalidateQueries({ queryKey: ['school-subscription-access', schoolId] }),
      ]);
    },
  });

  useEffect(() => {
    if (subscriptionQuery.data) setForm(toForm(subscriptionQuery.data));
  }, [subscriptionQuery.data]);

  if (subscriptionQuery.isLoading) {
    return (
      <Box sx={{ py: 12, display: 'grid', placeItems: 'center' }}>
        <Typography sx={{ color: 'text.secondary' }}>กำลังโหลดแพ็กเกจ...</Typography>
      </Box>
    );
  }

  if (subscriptionQuery.isError || !subscriptionQuery.data) {
    return (
      <Container maxWidth="md">
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => subscriptionQuery.refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          {subscriptionQuery.error?.message ?? 'ไม่สามารถโหลดแพ็กเกจโรงเรียนได้'}
        </Alert>
      </Container>
    );
  }

  if (!form) {
    return (
      <Box sx={{ py: 12, display: 'grid', placeItems: 'center' }}>
        <Typography sx={{ color: 'text.secondary' }}>กำลังเตรียมข้อมูลแพ็กเกจ...</Typography>
      </Box>
    );
  }

  const { school } = subscriptionQuery.data;
  const usage = subscriptionQuery.data.usage ?? {
    schoolAdmins: 0,
    teachers: 0,
    students: 0,
  };
  const validDates = !form.endsAt || form.endsAt >= form.startsAt;
  const hasFeatures = form.enabledFeatures.length > 0;
  const groups = Array.from(new Set(SCHOOL_FEATURES.map((feature) => feature.group)));
  const currentGroupFeatures = SCHOOL_FEATURES.filter((feature) => feature.group === featureGroup);
  const currentGroupKeys = currentGroupFeatures.map((feature) => feature.key);
  const currentGroupAllEnabled = currentGroupKeys.every((key) =>
    form.enabledFeatures.includes(key)
  );
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const applyTemplate = (template: SubscriptionPlan) => {
    setForm((current) =>
      current
        ? {
            ...current,
            planName: template.name,
            price: Number(template.price),
            billingCycle: template.billing_cycle,
            maxSchoolAdmins: template.max_school_admins,
            maxTeachers: template.max_teachers,
            maxStudents: template.max_students,
            maxLineNotifications: template.max_line_notifications,
            enabledFeatures: [...template.enabled_features],
          }
        : current
    );
  };

  const toggleFeature = (feature: SchoolFeatureKey) => {
    setForm((current) => {
      if (!current) return current;
      const enabled = current.enabledFeatures.includes(feature);
      return {
        ...current,
        enabledFeatures: enabled
          ? current.enabledFeatures.filter((item) => item !== feature)
          : [...current.enabledFeatures, feature],
      };
    });
  };

  return (
    <Container maxWidth="xl" sx={{ pb: 7 }}>
      <Button
        component={RouterLink}
        href={paths.master.school.root}
        color="inherit"
        startIcon={<RemixIcon icon="solar:reply-bold" />}
        sx={{ mb: 2 }}
      >
        กลับหน้ารายชื่อโรงเรียน
      </Button>

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
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          <Avatar
            src={school.logo_url ?? undefined}
            variant="rounded"
            sx={{ width: 64, height: 64 }}
          >
            {school.name.charAt(0)}
          </Avatar>
          <Box>
            <Box sx={{ gap: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography component="h1" variant="h3">
                แพ็กเกจและสิทธิ์ใช้งาน
              </Typography>
              <Label color={STATUS_COLOR[form.status]}>
                {SUBSCRIPTION_STATUS_LABEL[form.status]}
              </Label>
            </Box>
            <Typography sx={{ mt: 0.5, color: 'text.secondary' }}>
              {school.name} · {school.code}
            </Typography>
          </Box>
        </Box>
        <Button
          size="large"
          variant="contained"
          disabled={!validDates || !hasFeatures}
          loading={updateMutation.isPending}
          onClick={() => updateMutation.mutate(form)}
          startIcon={<RemixIcon icon="solar:check-circle-bold" />}
        >
          บันทึกแพ็กเกจ
        </Button>
      </Box>

      {updateMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          บันทึกแพ็กเกจและสิทธิ์ใช้งานแล้ว
        </Alert>
      )}
      {updateMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {updateMutation.error.message}
        </Alert>
      )}
      {!validDates && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น
        </Alert>
      )}
      {!hasFeatures && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          กรุณาเปิดใช้งานอย่างน้อย 1 ฟีเจอร์
        </Alert>
      )}

      <Typography variant="h5" sx={{ mb: 2 }}>
        เลือกแพ็กเกจเริ่มต้น
      </Typography>
      {plansQuery.isError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          โหลดแพ็กเกจกลางไม่สำเร็จ แต่ยังสามารถกำหนดค่าโรงเรียนนี้ด้วยตนเองได้
        </Alert>
      )}
      {!plansQuery.isLoading && !plansQuery.isError && plansQuery.data?.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          ยังไม่มีแพ็กเกจที่เปิดใช้งาน กรุณาสร้างหรือเปิดแพ็กเกจจากเมนูตั้งค่าแพ็กเกจ
        </Alert>
      )}
      <Box
        sx={{
          mb: 4,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
        }}
      >
        {(plansQuery.data ?? []).map((template) => (
          <Card
            key={template.id}
            variant="outlined"
            sx={{
              p: 2.5,
              borderColor: form.planName === template.name ? 'primary.main' : 'divider',
              bgcolor: form.planName === template.name ? 'primary.lighter' : 'background.paper',
            }}
          >
            <Typography variant="h6">{template.name}</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              {template.description || 'ไม่มีคำอธิบาย'}
            </Typography>
            <Typography variant="h4" sx={{ mt: 2 }}>
              {Number(template.price)
                ? `฿${Number(template.price).toLocaleString('th-TH')}/${
                    BILLING_CYCLE_LABEL[template.billing_cycle]
                  }`
                : 'ราคาตามสัญญา'}
            </Typography>
            <Button
              fullWidth
              variant={form.planName === template.name ? 'contained' : 'outlined'}
              onClick={() => applyTemplate(template)}
              sx={{ mt: 2 }}
            >
              ใช้แพ็กเกจนี้
            </Button>
          </Card>
        ))}
      </Box>

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, .8fr) minmax(0, 1.2fr)' },
        }}
      >
        <Box sx={{ gap: 3, display: 'grid' }}>
          <Card variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6">สัญญาและการเรียกเก็บเงิน</Typography>
            <Box
              sx={{
                gap: 2,
                mt: 2.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              <TextField
                size="small"
                label="ชื่อแพ็กเกจ"
                value={form.planName}
                onChange={(event) => setField('planName', event.target.value)}
              />
              <TextField
                select
                size="small"
                label="สถานะ"
                value={form.status}
                onChange={(event) => setField('status', event.target.value as SubscriptionStatus)}
              >
                {Object.entries(SUBSCRIPTION_STATUS_LABEL).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="รอบเรียกเก็บ"
                value={form.billingCycle}
                onChange={(event) => setField('billingCycle', event.target.value as BillingCycle)}
              >
                <MenuItem value="monthly">รายเดือน</MenuItem>
                <MenuItem value="yearly">รายปี</MenuItem>
                <MenuItem value="custom">ตามสัญญา</MenuItem>
              </TextField>
              <TextField
                size="small"
                type="number"
                label="ราคา (บาท)"
                value={form.price}
                onChange={(event) => setField('price', Math.max(0, Number(event.target.value)))}
                slotProps={{ htmlInput: { min: 0 } }}
              />
              <DatePicker
                label="วันเริ่มต้น"
                value={dayjs(form.startsAt)}
                onChange={(value) => {
                  if (value?.isValid()) setField('startsAt', value.format('YYYY-MM-DD'));
                }}
                format="DD/MM/YYYY"
                slotProps={{ textField: { size: 'small' } }}
              />
              <DatePicker
                label="วันสิ้นสุด"
                value={form.endsAt ? dayjs(form.endsAt) : null}
                onChange={(value) =>
                  setField('endsAt', value?.isValid() ? value.format('YYYY-MM-DD') : null)
                }
                format="DD/MM/YYYY"
                slotProps={{
                  field: { clearable: true },
                  textField: { size: 'small', helperText: 'เว้นว่าง = ไม่หมดอายุ' },
                }}
              />
            </Box>
          </Card>

          <Card variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6">โควตาผู้ใช้งาน</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              กำหนด 0 หมายถึงไม่จำกัด เฉพาะบัญชีที่เปิดใช้งานจะนับโควตา
            </Typography>
            <Box sx={{ gap: 2, mt: 2.5, display: 'grid' }}>
              <UsageLimit
                label="ผู้ดูแลโรงเรียน"
                used={usage.schoolAdmins}
                value={form.maxSchoolAdmins}
                onChange={(value) => setField('maxSchoolAdmins', value)}
              />
              <UsageLimit
                label="ครูและบุคลากร"
                used={usage.teachers}
                value={form.maxTeachers}
                onChange={(value) => setField('maxTeachers', value)}
              />
              <UsageLimit
                label="นักเรียน"
                used={usage.students}
                value={form.maxStudents}
                onChange={(value) => setField('maxStudents', value)}
              />
              <TextField
                size="small"
                type="number"
                label="แจ้งเตือน LINE ต่อเดือน"
                value={form.maxLineNotifications}
                onChange={(event) =>
                  setField(
                    'maxLineNotifications',
                    Math.max(0, Math.floor(Number(event.target.value)))
                  )
                }
                helperText="0 = ไม่จำกัดจากระบบ (โควตาของ LINE OA ยังมีผล)"
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
              />
            </Box>
          </Card>

          <Card variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6">หมายเหตุภายใน</Typography>
            <TextField
              multiline
              fullWidth
              minRows={4}
              value={form.notes}
              onChange={(event) => setField('notes', event.target.value)}
              placeholder="เลขที่สัญญา เงื่อนไขพิเศษ ผู้ติดต่อ หรือข้อมูลการชำระเงิน"
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              sx={{ mt: 2 }}
            />
          </Card>
        </Box>

        <Card variant="outlined">
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Box
              sx={{
                gap: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography variant="h6">เมนูและความสามารถที่เปิดใช้</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                  เปิดแล้ว {form.enabledFeatures.length} จาก {SCHOOL_FEATURES.length} รายการ
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => {
                  const currentKeys = new Set(currentGroupKeys);
                  setField(
                    'enabledFeatures',
                    currentGroupAllEnabled
                      ? form.enabledFeatures.filter((key) => !currentKeys.has(key))
                      : Array.from(new Set([...form.enabledFeatures, ...currentGroupKeys]))
                  );
                }}
              >
                {currentGroupAllEnabled ? 'ปิดทั้งหมดใน Tab' : 'เปิดทั้งหมดใน Tab'}
              </Button>
            </Box>
          </Box>
          <Divider />
          <Tabs
            value={featureGroup}
            onChange={(_event, value: string) => setFeatureGroup(value)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="กลุ่มเมนูและความสามารถ"
            sx={{ px: { xs: 1, md: 2 }, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            {groups.map((group) => {
              const features = SCHOOL_FEATURES.filter((feature) => feature.group === group);
              const enabledCount = features.filter((feature) =>
                form.enabledFeatures.includes(feature.key)
              ).length;
              return (
                <Tab
                  key={group}
                  value={group}
                  label={`${group} (${enabledCount}/${features.length})`}
                />
              );
            })}
          </Tabs>
          <Box role="tabpanel" aria-label={featureGroup}>
            {currentGroupFeatures.map((feature) => (
              <Box
                key={feature.key}
                sx={{
                  px: { xs: 2, md: 3 },
                  py: 1.75,
                  gap: 2,
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Typography variant="subtitle2">{feature.label}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {feature.description}
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.enabledFeatures.includes(feature.key)}
                      onChange={() => toggleFeature(feature.key)}
                    />
                  }
                  label=""
                  sx={{ m: 0 }}
                />
              </Box>
            ))}
          </Box>
        </Card>
      </Box>
    </Container>
  );
}

function UsageLimit({
  label,
  used,
  value,
  onChange,
}: {
  label: string;
  used: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const percent = value === 0 ? 0 : Math.min((used / value) * 100, 100);
  const exceeded = value > 0 && used > value;

  return (
    <Box>
      <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2">{label}</Typography>
          <Typography variant="caption" sx={{ color: exceeded ? 'error.main' : 'text.secondary' }}>
            ใช้แล้ว {used.toLocaleString('th-TH')} /{' '}
            {value === 0 ? 'ไม่จำกัด' : value.toLocaleString('th-TH')}
          </Typography>
          <LinearProgress
            variant="determinate"
            color={exceeded ? 'error' : percent >= 80 ? 'warning' : 'primary'}
            value={percent}
            sx={{ mt: 0.75, height: 6, borderRadius: 1 }}
          />
        </Box>
        <TextField
          size="small"
          type="number"
          value={value}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value)))}
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
          sx={{ width: 120 }}
        />
      </Box>
    </Box>
  );
}
