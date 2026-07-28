'use client';

import type { SchoolFeatureKey } from 'src/lib/school-subscription-config';
import type {
  SubscriptionPlan,
  SubscriptionPlanInput,
  SubscriptionPlanBillingCycle,
} from '../subscription-plan-actions';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { SCHOOL_FEATURES, STARTER_FEATURE_KEYS } from 'src/lib/school-subscription-config';

// ----------------------------------------------------------------------

type Props = {
  plan: SubscriptionPlan | null;
  loading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (input: SubscriptionPlanInput) => void;
};

function initialForm(plan: SubscriptionPlan | null): SubscriptionPlanInput {
  if (!plan) {
    return {
      code: '',
      name: '',
      description: '',
      billingCycle: 'monthly',
      price: 0,
      maxSchoolAdmins: 1,
      maxTeachers: 20,
      maxStudents: 500,
      maxLineNotifications: 300,
      enabledFeatures: [...STARTER_FEATURE_KEYS],
      isActive: true,
      sortOrder: 0,
    };
  }
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description ?? '',
    billingCycle: plan.billing_cycle,
    price: Number(plan.price),
    maxSchoolAdmins: plan.max_school_admins,
    maxTeachers: plan.max_teachers,
    maxStudents: plan.max_students,
    maxLineNotifications: plan.max_line_notifications,
    enabledFeatures: [...plan.enabled_features],
    isActive: plan.is_active,
    sortOrder: plan.sort_order,
  };
}

export function SubscriptionPlanFormDialog({ plan, loading, error, onClose, onSubmit }: Props) {
  const [form, setForm] = useState(() => initialForm(plan));
  const [featureGroup, setFeatureGroup] = useState('ผู้ดูแลโรงเรียน');

  const groups = Array.from(new Set(SCHOOL_FEATURES.map((feature) => feature.group)));
  const groupFeatures = SCHOOL_FEATURES.filter((feature) => feature.group === featureGroup);
  const groupKeys = groupFeatures.map((feature) => feature.key);
  const allGroupEnabled = groupKeys.every((key) => form.enabledFeatures.includes(key));
  const isValid =
    form.code.trim() &&
    form.name.trim() &&
    form.enabledFeatures.length > 0 &&
    form.price >= 0 &&
    [form.maxSchoolAdmins, form.maxTeachers, form.maxStudents, form.maxLineNotifications].every(
      (value) => Number.isInteger(value) && value >= 0
    );

  const setField = <K extends keyof SubscriptionPlanInput>(
    key: K,
    value: SubscriptionPlanInput[K]
  ) => setForm((current) => ({ ...current, [key]: value }));

  const toggleFeature = (key: SchoolFeatureKey) => {
    setField(
      'enabledFeatures',
      form.enabledFeatures.includes(key)
        ? form.enabledFeatures.filter((item) => item !== key)
        : [...form.enabledFeatures, key]
    );
  };

  return (
    <Dialog open fullWidth maxWidth="md" onClose={loading ? undefined : onClose}>
      <DialogTitle>{plan ? `แก้ไขแพ็กเกจ ${plan.name}` : 'สร้างแพ็กเกจใหม่'}</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="subtitle1">ข้อมูลแพ็กเกจ</Typography>
        <Box
          sx={{
            gap: 2,
            mt: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          <TextField
            required
            label="รหัสแพ็กเกจ"
            value={form.code}
            onChange={(event) => setField('code', event.target.value.toUpperCase())}
            helperText="ใช้ A-Z, 0-9, _ หรือ -"
            slotProps={{ htmlInput: { maxLength: 50 } }}
          />
          <TextField
            required
            label="ชื่อแพ็กเกจ"
            value={form.name}
            onChange={(event) => setField('name', event.target.value)}
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
          <TextField
            select
            label="รอบเรียกเก็บ"
            value={form.billingCycle}
            onChange={(event) =>
              setField('billingCycle', event.target.value as SubscriptionPlanBillingCycle)
            }
          >
            <MenuItem value="monthly">รายเดือน</MenuItem>
            <MenuItem value="yearly">รายปี</MenuItem>
            <MenuItem value="custom">ตามสัญญา</MenuItem>
          </TextField>
          <TextField
            type="number"
            label="ราคา (บาท)"
            value={form.price}
            onChange={(event) => setField('price', Math.max(0, Number(event.target.value)))}
            slotProps={{ htmlInput: { min: 0 } }}
          />
          <TextField
            multiline
            minRows={2}
            label="คำอธิบาย"
            value={form.description}
            onChange={(event) => setField('description', event.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            sx={{ gridColumn: { sm: '1 / -1' } }}
          />
        </Box>

        <TextField
          type="number"
          label="โควตาแจ้งเตือน LINE ต่อเดือน"
          value={form.maxLineNotifications}
          onChange={(event) =>
            setField('maxLineNotifications', Math.max(0, Math.floor(Number(event.target.value))))
          }
          helperText="ใส่ 0 เมื่อต้องการไม่จำกัด (โควตา LINE OA ยังมีผล)"
          slotProps={{ htmlInput: { min: 0 } }}
          sx={{ mt: 2, maxWidth: 360 }}
        />

        <Divider sx={{ my: 3 }} />
        <Typography variant="subtitle1">โควตาผู้ใช้งาน</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          ใส่ 0 เมื่อต้องการให้ใช้งานได้ไม่จำกัด
        </Typography>
        <Box
          sx={{
            gap: 2,
            mt: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {[
            ['maxSchoolAdmins', 'ผู้ดูแลโรงเรียน'],
            ['maxTeachers', 'ครูและบุคลากร'],
            ['maxStudents', 'นักเรียน'],
          ].map(([key, label]) => (
            <TextField
              key={key}
              type="number"
              label={label}
              value={form[key as 'maxSchoolAdmins' | 'maxTeachers' | 'maxStudents']}
              onChange={(event) =>
                setField(
                  key as 'maxSchoolAdmins' | 'maxTeachers' | 'maxStudents',
                  Math.max(0, Math.floor(Number(event.target.value)))
                )
              }
              slotProps={{ htmlInput: { min: 0 } }}
            />
          ))}
        </Box>

        <Divider sx={{ my: 3 }} />
        <Box
          sx={{
            gap: 2,
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="subtitle1">เมนูและความสามารถที่เปิดใช้</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              เลือกแล้ว {form.enabledFeatures.length} จาก {SCHOOL_FEATURES.length} รายการ
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => {
              const currentKeys = new Set(groupKeys);
              setField(
                'enabledFeatures',
                allGroupEnabled
                  ? form.enabledFeatures.filter((key) => !currentKeys.has(key))
                  : Array.from(new Set([...form.enabledFeatures, ...groupKeys]))
              );
            }}
          >
            {allGroupEnabled ? 'ปิดทั้งหมดในกลุ่ม' : 'เปิดทั้งหมดในกลุ่ม'}
          </Button>
        </Box>
        <Tabs
          value={featureGroup}
          onChange={(_event, value: string) => setFeatureGroup(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mt: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          {groups.map((group) => (
            <Tab
              key={group}
              value={group}
              label={`${group} (${
                SCHOOL_FEATURES.filter(
                  (feature) => feature.group === group && form.enabledFeatures.includes(feature.key)
                ).length
              })`}
            />
          ))}
        </Tabs>
        <Box>
          {groupFeatures.map((feature) => (
            <Box
              key={feature.key}
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
                <Typography variant="subtitle2">{feature.label}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {feature.description}
                </Typography>
              </Box>
              <Switch
                checked={form.enabledFeatures.includes(feature.key)}
                onChange={() => toggleFeature(feature.key)}
                inputProps={{ 'aria-label': `เปิดใช้งาน ${feature.label}` }}
              />
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            gap: 2,
            mt: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TextField
            type="number"
            size="small"
            label="ลำดับแสดงผล"
            value={form.sortOrder}
            onChange={(event) => setField('sortOrder', Math.floor(Number(event.target.value)))}
            sx={{ maxWidth: 180 }}
          />
          <FormControlLabel
            label="เปิดให้เลือกใช้งาน"
            control={
              <Switch
                checked={form.isActive}
                onChange={(event) => setField('isActive', event.target.checked)}
              />
            }
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" disabled={loading} onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          loading={loading}
          disabled={!isValid}
          onClick={() => onSubmit(form)}
        >
          {plan ? 'บันทึกการแก้ไข' : 'สร้างแพ็กเกจ'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
