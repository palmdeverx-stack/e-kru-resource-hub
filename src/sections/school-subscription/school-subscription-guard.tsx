'use client';

import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { usePathname } from 'src/routes/hooks';

import { useAuthContext } from 'src/auth/hooks';

import { useSchoolSubscription, requiredFeatureForPath } from './use-school-subscription';

// ----------------------------------------------------------------------

export function SchoolSubscriptionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuthContext();
  const subscriptionQuery = useSchoolSubscription(user?.school_id);

  if (!user?.school_id || user.role === 'master_admin') return children;

  if (subscriptionQuery.isLoading) {
    return (
      <Box sx={{ py: 12, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (subscriptionQuery.isError || !subscriptionQuery.data) {
    return (
      <Container maxWidth="md" sx={{ py: 5 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => subscriptionQuery.refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          ไม่สามารถตรวจสอบแพ็กเกจของโรงเรียนได้
        </Alert>
      </Container>
    );
  }

  const { subscription } = subscriptionQuery.data;
  const today = new Date().toISOString().slice(0, 10);
  const usable =
    ['trialing', 'active'].includes(subscription.status) &&
    (!subscription.ends_at || subscription.ends_at >= today);
  if (!usable) {
    return (
      <Container maxWidth="md" sx={{ py: 5 }}>
        <Alert severity="error">
          <Typography variant="subtitle1">แพ็กเกจโรงเรียนไม่พร้อมใช้งาน</Typography>
          กรุณาติดต่อผู้ดูแลระบบเพื่อตรวจสอบการชำระเงินหรือวันหมดอายุ
        </Alert>
      </Container>
    );
  }

  if (!['school_admin', 'teacher', 'student'].includes(user.role)) return children;
  const feature = requiredFeatureForPath(
    user.role as 'school_admin' | 'teacher' | 'student',
    pathname
  );
  if (feature && !subscription.enabled_features.includes(feature)) {
    return (
      <Container maxWidth="md" sx={{ py: 5 }}>
        <Alert severity="warning">
          <Typography variant="subtitle1">แพ็กเกจนี้ไม่รองรับเมนูดังกล่าว</Typography>
          กรุณาติดต่อผู้ดูแลโรงเรียนหรืออัปเกรดแพ็กเกจเพื่อเปิดใช้งาน
        </Alert>
      </Container>
    );
  }

  return children;
}
