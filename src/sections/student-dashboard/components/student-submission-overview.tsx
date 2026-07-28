'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { SectionHeading } from '../view/student-dashboard-shared';

// ----------------------------------------------------------------------

type Props = {
  total: number;
  submitted: number;
  pending: number;
  progress: number;
  scorePercent: number;
};

export function StudentSubmissionOverview({
  total,
  submitted,
  pending,
  progress,
  scorePercent,
}: Props) {
  return (
    <Card variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, mb: 3, borderRadius: 3 }}>
      <SectionHeading
        compact
        icon="solar:check-circle-bold"
        title="ภาพรวมการส่งงาน"
        subtitle="ความคืบหน้าของงานทั้งหมด"
      />
      <Box
        sx={{ p: 2.5, mb: 2, textAlign: 'center', borderRadius: 2, bgcolor: 'background.neutral' }}
      >
        <Typography variant="h2" sx={{ color: 'primary.main' }}>
          {Math.round(progress)}%
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          ส่งแล้ว {submitted} จาก {total} งาน
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ mt: 2, height: 9, borderRadius: 5 }}
        />
      </Box>
      <Stack spacing={1.5} divider={<Divider flexItem />}>
        <OverviewRow label="ส่งแล้ว / รอตรวจ" value={`${submitted} งาน`} color="success.main" />
        <OverviewRow label="ยังไม่ส่ง / ขาด / ลา" value={`${pending} งาน`} color="error.main" />
        <OverviewRow
          label="คะแนนเฉลี่ยจากงานที่ตรวจแล้ว"
          value={`${Math.round(scorePercent)}%`}
          color="info.main"
        />
      </Stack>
    </Card>
  );
}

function OverviewRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="subtitle2" sx={{ color }}>
        {value}
      </Typography>
    </Stack>
  );
}
