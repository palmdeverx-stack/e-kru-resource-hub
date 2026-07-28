'use client';

import type { SubscriptionPlan, SubscriptionPlanInput } from '../subscription-plan-actions';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';

import { SubscriptionPlanFormDialog } from '../components/subscription-plan-form-dialog';
import {
  listSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
} from '../subscription-plan-actions';

// ----------------------------------------------------------------------

const CYCLE_LABEL = {
  monthly: 'รายเดือน',
  yearly: 'รายปี',
  custom: 'ตามสัญญา',
};

function quotaLabel(value: number) {
  return value === 0 ? 'ไม่จำกัด' : value.toLocaleString('th-TH');
}

export function SubscriptionPlanView() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<SubscriptionPlan | null>(null);

  const plansQuery = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => listSubscriptionPlans(true),
  });
  const saveMutation = useMutation({
    mutationFn: ({
      plan,
      input,
    }: {
      plan: SubscriptionPlan | null;
      input: SubscriptionPlanInput;
    }) => (plan ? updateSubscriptionPlan(plan.id, input) : createSubscriptionPlan(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      setFormOpen(false);
      setEditingPlan(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSubscriptionPlan(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      setDeletingPlan(null);
    },
  });

  const plans = plansQuery.data ?? [];
  const activePlans = plans.filter((plan) => plan.is_active);
  const enabledFeatureCount = new Set(activePlans.flatMap((plan) => plan.enabled_features)).size;

  return (
    <Container maxWidth="xl" sx={{ pb: 7 }}>
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
            ตั้งค่าแพ็กเกจ
          </Typography>
          <Typography sx={{ mt: 0.75, color: 'text.secondary' }}>
            สร้างแพ็กเกจกลาง กำหนดราคา โควตา และความสามารถสำหรับนำไปใช้กับแต่ละโรงเรียน
          </Typography>
        </Box>
        <Button
          size="large"
          variant="contained"
          startIcon={<RemixIcon icon="mingcute:add-line" />}
          onClick={() => {
            saveMutation.reset();
            setEditingPlan(null);
            setFormOpen(true);
          }}
        >
          สร้างแพ็กเกจ
        </Button>
      </Box>

      <Box
        sx={{
          mb: 4,
          gap: { xs: 1, sm: 3 },
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(3, 1fr)', md: 'repeat(3, minmax(0, 220px))' },
        }}
      >
        {(
          [
            ['แพ็กเกจทั้งหมด', plans.length, 'solar:box-minimalistic-bold'],
            ['กำลังเปิดใช้', activePlans.length, 'solar:check-circle-bold'],
            ['ความสามารถ', enabledFeatureCount, 'solar:settings-bold-duotone'],
          ] as const
        ).map(([label, value, icon]) => (
          <Box key={label} sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                flexShrink: 0,
                display: { xs: 'none', sm: 'grid' },
                borderRadius: 1.5,
                color: 'primary.main',
                placeItems: 'center',
                bgcolor: 'primary.lighter',
              }}
            >
              <RemixIcon icon={icon} width={24} />
            </Box>
            <Box>
              <Typography variant="h4">{String(value)}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {String(label)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {plansQuery.isLoading && (
        <Box sx={{ py: 12, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      )}
      {plansQuery.isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => plansQuery.refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          {plansQuery.error.message}
        </Alert>
      )}
      {!plansQuery.isLoading && !plansQuery.isError && plans.length === 0 && (
        <Box sx={{ py: 10, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
          <RemixIcon icon="solar:box-minimalistic-bold" width={56} color="text.disabled" />
          <Typography variant="h6" sx={{ mt: 2 }}>
            ยังไม่มีแพ็กเกจ
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            สร้างแพ็กเกจแรกเพื่อเริ่มกำหนดสิทธิ์ให้โรงเรียน
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          gap: 2.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {plans.map((plan) => (
          <Card
            key={plan.id}
            variant="outlined"
            sx={{
              p: { xs: 2.5, sm: 3 },
              opacity: plan.is_active ? 1 : 0.72,
              borderColor: plan.is_active ? 'divider' : 'text.disabled',
            }}
          >
            <Box sx={{ gap: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ gap: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="h5">{plan.name}</Typography>
                  <Label color={plan.is_active ? 'success' : 'default'}>
                    {plan.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </Label>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {plan.code} · ลำดับ {plan.sort_order}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography variant="h4">
                  {Number(plan.price) === 0
                    ? 'ตามสัญญา'
                    : `฿${Number(plan.price).toLocaleString('th-TH')}`}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {CYCLE_LABEL[plan.billing_cycle]}
                </Typography>
              </Box>
            </Box>

            <Typography variant="body2" sx={{ mt: 2, minHeight: 42, color: 'text.secondary' }}>
              {plan.description || 'ไม่มีคำอธิบาย'}
            </Typography>

            <Divider sx={{ my: 2.5 }} />
            <Box
              sx={{
                gap: 2,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              }}
            >
              {[
                ['ผู้ดูแล', plan.max_school_admins],
                ['ครู', plan.max_teachers],
                ['นักเรียน', plan.max_students],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {label}
                  </Typography>
                  <Typography variant="subtitle1">{quotaLabel(Number(value))}</Typography>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                mt: 2.5,
                gap: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                เปิด {plan.enabled_features.length} ความสามารถ
              </Typography>
              <Box>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<RemixIcon icon="solar:pen-bold" />}
                  onClick={() => {
                    saveMutation.reset();
                    setEditingPlan(plan);
                    setFormOpen(true);
                  }}
                >
                  แก้ไข
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<RemixIcon icon="solar:trash-bin-trash-bold" />}
                  onClick={() => {
                    deleteMutation.reset();
                    setDeletingPlan(plan);
                  }}
                >
                  ลบ
                </Button>
              </Box>
            </Box>
          </Card>
        ))}
      </Box>

      {formOpen && (
        <SubscriptionPlanFormDialog
          plan={editingPlan}
          loading={saveMutation.isPending}
          error={saveMutation.error?.message}
          onClose={() => {
            setFormOpen(false);
            setEditingPlan(null);
          }}
          onSubmit={(input) => saveMutation.mutate({ plan: editingPlan, input })}
        />
      )}

      <Dialog open={Boolean(deletingPlan)} onClose={() => setDeletingPlan(null)}>
        <DialogTitle>ลบแพ็กเกจนี้?</DialogTitle>
        <DialogContent>
          <Typography>
            แพ็กเกจ “{deletingPlan?.name}” จะหายจากรายการ
            แต่โรงเรียนที่เคยใช้แพ็กเกจนี้จะยังคงค่าเดิม
          </Typography>
          {deleteMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteMutation.error.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            disabled={deleteMutation.isPending}
            onClick={() => setDeletingPlan(null)}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={deleteMutation.isPending}
            onClick={() => deletingPlan && deleteMutation.mutate(deletingPlan.id)}
          >
            ยืนยันการลบ
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
