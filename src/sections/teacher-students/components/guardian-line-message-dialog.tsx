'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { RemixIcon } from 'src/components/remix-icon';

import {
  sendGuardianLineMessage,
  listHomeroomStudentGuardians,
} from 'src/sections/student-guardian/student-guardian-actions';

// ----------------------------------------------------------------------

const MAX_LENGTH = 1000;

type Props = {
  studentId: string;
  studentName: string;
  onClose: () => void;
};

export function GuardianLineMessageDialog({ studentId, studentName, onClose }: Props) {
  const [guardianId, setGuardianId] = useState('');
  const [text, setText] = useState('');

  const {
    data: guardians = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['homeroom-student-guardians', studentId],
    queryFn: () => listHomeroomStudentGuardians(studentId),
  });

  const linkedGuardians = useMemo(
    () => guardians.filter((guardian) => guardian.line_linked_at),
    [guardians]
  );

  useEffect(() => {
    if (!guardianId && linkedGuardians.length) setGuardianId(linkedGuardians[0].id);
  }, [guardianId, linkedGuardians]);

  const sendMutation = useMutation({
    mutationFn: () => sendGuardianLineMessage(guardianId, text),
    onSuccess: () => setText(''),
  });

  const selectedGuardian = guardians.find((guardian) => guardian.id === guardianId) ?? null;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography component="h2" variant="h6">
              ส่งข้อความ LINE ถึงผู้ปกครอง
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              {studentName}
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="ปิดหน้าต่าง">
            <RemixIcon icon="mingcute:close-line" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {isLoading && (
          <Box sx={{ py: 4, gap: 1.5, display: 'grid', placeItems: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {isError && <Alert severity="error">ไม่สามารถโหลดข้อมูลผู้ปกครองได้</Alert>}

        {!isLoading && !isError && !guardians.length && (
          <Alert severity="info">นักเรียนคนนี้ยังไม่มีข้อมูลผู้ปกครอง</Alert>
        )}

        {!isLoading && !isError && guardians.length > 0 && !linkedGuardians.length && (
          <Alert severity="warning">ผู้ปกครองของนักเรียนคนนี้ยังไม่ได้เชื่อมต่อ LINE</Alert>
        )}

        {linkedGuardians.length > 0 && (
          <>
            {linkedGuardians.length > 1 && (
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  ส่งถึง
                </Typography>
                <Box sx={{ gap: 0.75, display: 'flex', flexWrap: 'wrap' }}>
                  {linkedGuardians.map((guardian) => (
                    <Chip
                      key={guardian.id}
                      clickable
                      label={`${guardian.full_name} (${guardian.relationship})`}
                      color={guardian.id === guardianId ? 'primary' : 'default'}
                      variant={guardian.id === guardianId ? 'filled' : 'soft'}
                      onClick={() => setGuardianId(guardian.id)}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {sendMutation.isSuccess && (
              <Alert
                severity="success"
                variant="outlined"
                onClose={() => sendMutation.reset()}
                sx={{ mb: 2 }}
              >
                ส่งข้อความถึง {selectedGuardian?.full_name} แล้ว
              </Alert>
            )}
            {sendMutation.error && (
              <Alert
                severity="error"
                variant="outlined"
                onClose={() => sendMutation.reset()}
                sx={{ mb: 2 }}
              >
                {sendMutation.error.message}
              </Alert>
            )}

            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={4}
              label="ข้อความ"
              placeholder={`พิมพ์ข้อความถึง ${selectedGuardian?.full_name ?? 'ผู้ปกครอง'}`}
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, MAX_LENGTH))}
              helperText={`${text.length}/${MAX_LENGTH} ตัวอักษร`}
            />
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ปิด
        </Button>
        {linkedGuardians.length > 0 && (
          <Button
            variant="contained"
            color="success"
            startIcon={<RemixIcon icon="solar:chat-round-dots-bold" />}
            disabled={!text.trim() || !guardianId}
            loading={sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            ส่งข้อความ
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
