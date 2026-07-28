'use client';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { RemixIcon } from 'src/components/remix-icon';

import { StudentGuardiansPanel } from './student-guardians-panel';

// ----------------------------------------------------------------------

type Student = {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
};

type Props = {
  open: boolean;
  student: Student | null;
  teacherAssignmentId?: string;
  onClose: () => void;
};

export function StudentGuardiansDialog({ open, student, teacherAssignmentId, onClose }: Props) {
  const studentName = student
    ? `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || student.username
    : '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{
        paper: {
          sx: {
            overflow: 'hidden',
            borderRadius: { xs: 0, sm: 2.5 },
          },
        },
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            py: 2.5,
            gap: 2,
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'background.neutral',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Avatar
            variant="rounded"
            sx={{
              width: 48,
              height: 48,
              color: 'primary.main',
              bgcolor: 'primary.lighter',
            }}
          >
            <RemixIcon icon="solar:users-group-rounded-bold" width={26} />
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h5">ข้อมูลผู้ปกครอง</Typography>
            <Typography variant="body2" noWrap sx={{ mt: 0.25, color: 'text.secondary' }}>
              {studentName} · รหัสนักเรียน {student?.username}
            </Typography>
          </Box>
          <IconButton aria-label="ปิดหน้าข้อมูลผู้ปกครอง" onClick={onClose}>
            <RemixIcon icon="mingcute:close-line" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
        {open && student && (
          <StudentGuardiansPanel student={student} teacherAssignmentId={teacherAssignmentId} />
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Button color="inherit" onClick={onClose}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  );
}
