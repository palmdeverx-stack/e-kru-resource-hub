'use client';

import type { IScannerControls } from '@zxing/browser';
import type { AttendanceScanResult } from 'src/sections/attendance-scan/attendance-scan-actions';

import dayjs from 'dayjs';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import useMediaQuery from '@mui/material/useMediaQuery';
import CircularProgress from '@mui/material/CircularProgress';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';

import {
  scanStudentQr,
  getAttendanceScanSession,
  closeAttendanceScanSession,
  createAttendanceScanSession,
} from 'src/sections/attendance-scan/attendance-scan-actions';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  teacherAssignmentId: string;
  sessionDate: string;
  onClose: () => void;
};

type ScanFeedback =
  | { type: 'success'; result: AttendanceScanResult }
  | { type: 'error'; message: string }
  | null;

export function AttendanceQrScanDialog({ open, teacherAssignmentId, sessionDate, onClose }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanInFlightRef = useRef(false);
  const lastPayloadRef = useRef({ value: '', at: 0 });
  const [sessionId, setSessionId] = useState('');
  const [periodLabel, setPeriodLabel] = useState('คาบที่ 1');
  const [lateAfterMinutes, setLateAfterMinutes] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [manualPayload, setManualPayload] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [feedback, setFeedback] = useState<ScanFeedback>(null);

  const sessionQuery = useQuery({
    queryKey: ['attendance-scan-session', sessionId],
    queryFn: () => getAttendanceScanSession(sessionId),
    enabled: open && !!sessionId,
    refetchInterval: (query) => (query.state.data?.session.status === 'open' ? 15000 : false),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createAttendanceScanSession({
        sessionType: 'class_period',
        sessionDate,
        teacherAssignmentId,
        periodLabel,
        lateAfterMinutes,
        durationMinutes,
      }),
    onSuccess: (id) => {
      setSessionId(id);
      setCameraError('');
      setFeedback(null);
    },
  });
  const closeMutation = useMutation({
    mutationFn: () => closeAttendanceScanSession(sessionId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['attendance-scan-session', sessionId] }),
  });

  const processPayload = useCallback(
    async (payload: string) => {
      const normalized = payload.trim();
      const now = Date.now();
      if (
        !sessionId ||
        !normalized ||
        scanInFlightRef.current ||
        (lastPayloadRef.current.value === normalized && now - lastPayloadRef.current.at < 2500)
      ) {
        return;
      }

      scanInFlightRef.current = true;
      lastPayloadRef.current = { value: normalized, at: now };
      try {
        const result = await scanStudentQr(sessionId, normalized);
        setFeedback({ type: 'success', result });
        setManualPayload('');
        navigator.vibrate?.(120);
        await queryClient.invalidateQueries({
          queryKey: ['attendance-scan-session', sessionId],
        });
      } catch (error) {
        setFeedback({
          type: 'error',
          message: error instanceof Error ? error.message : 'ไม่สามารถบันทึกการสแกนได้',
        });
        navigator.vibrate?.([80, 60, 80]);
      } finally {
        scanInFlightRef.current = false;
      }
    },
    [queryClient, sessionId]
  );

  const session = sessionQuery.data?.session;
  const isSessionOpen = session?.status === 'open' && dayjs().isBefore(dayjs(session.closes_at));

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!open || !isSessionOpen || !videoElement) return undefined;

    let disposed = false;
    setCameraError('');
    const startScanner = async () => {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (disposed) return;

      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 1000,
      });
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        videoElement,
        (result) => {
          if (result) void processPayload(result.getText());
        }
      );

      if (disposed) {
        controls.stop();
      } else {
        controlsRef.current = controls;
      }
    };

    void startScanner().catch(() => {
      if (!disposed) {
        setCameraError('เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง หรือเปิดผ่าน HTTPS/localhost');
      }
    });

    return () => {
      disposed = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [isSessionOpen, open, processPayload]);

  const resetDialog = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setSessionId('');
    setPeriodLabel('คาบที่ 1');
    setLateAfterMinutes(10);
    setDurationMinutes(60);
    setManualPayload('');
    setCameraError('');
    setFeedback(null);
    createMutation.reset();
    closeMutation.reset();
  };

  const handleClose = async () => {
    if (closeMutation.isPending) return;
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (sessionId && session?.status === 'open') {
      try {
        await closeAttendanceScanSession(sessionId);
      } catch {
        // The server closes the session automatically at its expiration time.
      }
    }
    resetDialog();
    onClose();
  };

  const events = sessionQuery.data?.events ?? [];
  const canCreate =
    !!periodLabel.trim() &&
    durationMinutes >= 5 &&
    durationMinutes <= 480 &&
    lateAfterMinutes >= 0 &&
    lateAfterMinutes <= durationMinutes;

  return (
    <Dialog
      open={open}
      onClose={() => void handleClose()}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      slotProps={{ paper: { sx: { overflow: 'hidden' } } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ gap: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="h6">สแกน QR เข้าเรียน</Typography>
          {session && (
            <Label color={isSessionOpen ? 'success' : 'default'}>
              {isSessionOpen ? 'กำลังเปิดรับสแกน' : 'ปิดรอบแล้ว'}
            </Label>
          )}
        </Box>
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
          วันที่ {dayjs(sessionDate).format('DD/MM/YYYY')}
          {session ? ` · ${session.period_label}` : ' · ตั้งค่าคาบก่อนเปิดกล้อง'}
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ p: { xs: 2, sm: 2.5 } }}>
        {!sessionId && (
          <>
            {createMutation.isError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {createMutation.error.message}
              </Alert>
            )}
            <Box
              sx={{
                gap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              <TextField
                fullWidth
                size="medium"
                label="ชื่อคาบ"
                value={periodLabel}
                onChange={(event) => setPeriodLabel(event.target.value)}
                placeholder="เช่น คาบที่ 1"
                slotProps={{ htmlInput: { maxLength: 100 } }}
                sx={{ gridColumn: { sm: '1 / -1' } }}
              />
              <TextField
                size="small"
                type="number"
                label="เริ่มนับว่าสายหลัง (นาที)"
                value={lateAfterMinutes}
                onChange={(event) => setLateAfterMinutes(Number(event.target.value))}
                slotProps={{ htmlInput: { min: 0, max: durationMinutes } }}
              />
              <TextField
                size="small"
                type="number"
                label="เปิดรับสแกนทั้งหมด (นาที)"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
                slotProps={{ htmlInput: { min: 5, max: 480 } }}
              />
            </Box>
            <Alert severity="info" sx={{ mt: 2 }}>
              ระบบจะสร้างรอบเช็คชื่อสำหรับวิชา ห้องเรียน วันที่ และคาบนี้
            </Alert>
          </>
        )}

        {!!sessionId && sessionQuery.isLoading && (
          <Box sx={{ py: 10, display: 'grid', placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        )}
        {!!sessionId && sessionQuery.isError && (
          <Alert severity="error">{sessionQuery.error.message}</Alert>
        )}

        {session && (
          <Box
            sx={{
              gap: 2.5,
              display: 'grid',
              alignItems: 'start',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.35fr) minmax(280px, .65fr)' },
            }}
          >
            <Box>
              <Box
                sx={{
                  bgcolor: 'grey.900',
                  overflow: 'hidden',
                  position: 'relative',
                  borderRadius: 2,
                  aspectRatio: { xs: '4 / 5', sm: '16 / 10' },
                }}
              >
                {isSessionOpen ? (
                  <>
                    <Box
                      component="video"
                      ref={videoRef}
                      muted
                      playsInline
                      sx={{ width: 1, height: 1, display: 'block', objectFit: 'cover' }}
                    />
                    <Box
                      sx={{
                        top: '50%',
                        left: '50%',
                        width: { xs: 210, sm: 260 },
                        height: { xs: 210, sm: 260 },
                        position: 'absolute',
                        borderRadius: 2,
                        border: '3px solid',
                        borderColor: feedback?.type === 'success' ? 'success.main' : 'common.white',
                        transform: 'translate(-50%, -50%)',
                        boxShadow: '0 0 0 999px rgba(0,0,0,0.28)',
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        left: 12,
                        right: 12,
                        bottom: 14,
                        color: 'common.white',
                        textAlign: 'center',
                        position: 'absolute',
                        textShadow: '0 1px 3px rgba(0,0,0,.8)',
                      }}
                    >
                      วาง QR นักเรียนในกรอบ
                    </Typography>
                  </>
                ) : (
                  <Box
                    sx={{
                      width: 1,
                      height: 1,
                      gap: 1,
                      color: 'common.white',
                      display: 'flex',
                      alignItems: 'center',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <RemixIcon icon="solar:stop-circle-bold" width={48} />
                    <Typography variant="subtitle1">รอบเช็คชื่อสิ้นสุดแล้ว</Typography>
                  </Box>
                )}
              </Box>

              {cameraError && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {cameraError}
                </Alert>
              )}
              {feedback?.type === 'success' && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  บันทึก{' '}
                  {`${feedback.result.student.firstName ?? ''} ${feedback.result.student.lastName ?? ''}`.trim() ||
                    feedback.result.student.username}{' '}
                  แล้ว · {feedback.result.status === 'late' ? 'สาย' : 'มา'}
                </Alert>
              )}
              {feedback?.type === 'error' && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {feedback.message}
                </Alert>
              )}
              {isSessionOpen && (
                <Box sx={{ gap: 1, mt: 2, display: 'flex' }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="กรอกข้อมูล QR กรณีกล้องใช้ไม่ได้"
                    value={manualPayload}
                    onChange={(event) => setManualPayload(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void processPayload(manualPayload);
                    }}
                  />
                  <Button
                    variant="contained"
                    disabled={!manualPayload.trim() || scanInFlightRef.current}
                    onClick={() => void processPayload(manualPayload)}
                  >
                    บันทึก
                  </Button>
                </Box>
              )}
            </Box>

            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Box sx={{ p: 2 }}>
                <Typography variant="subtitle1">สแกนแล้ว {events.length} คน</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  รายการล่าสุดอยู่ด้านบน
                </Typography>
              </Box>
              <Divider />
              <Box sx={{ maxHeight: { xs: 280, md: 520 }, overflowY: 'auto' }}>
                {!events.length && (
                  <Box sx={{ py: 5, px: 2, textAlign: 'center', color: 'text.secondary' }}>
                    <Typography variant="body2">ยังไม่มีนักเรียนสแกนในรอบนี้</Typography>
                  </Box>
                )}
                {events.map((event) => {
                  const name =
                    `${event.student.first_name ?? ''} ${event.student.last_name ?? ''}`.trim() ||
                    event.student.username;
                  return (
                    <Box
                      key={event.id}
                      sx={{
                        p: 1.5,
                        gap: 1,
                        display: 'flex',
                        alignItems: 'center',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Avatar
                        src={event.student.avatar_url ?? undefined}
                        sx={{ width: 34, height: 34 }}
                      >
                        {name.charAt(0)}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="subtitle2" noWrap>
                          {name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {dayjs(event.scanned_at).format('HH:mm:ss')} น.
                        </Typography>
                      </Box>
                      <Label color={event.status === 'late' ? 'warning' : 'success'}>
                        {event.status === 'late' ? 'สาย' : 'มา'}
                      </Label>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5 }}>
        <Button
          color="inherit"
          disabled={closeMutation.isPending}
          onClick={() => void handleClose()}
        >
          {sessionId ? 'ปิดหน้าต่าง' : 'ยกเลิก'}
        </Button>
        {!sessionId && (
          <Button
            variant="contained"
            disabled={!canCreate}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            startIcon={<RemixIcon icon="solar:camera-add-bold" />}
          >
            เปิดกล้องสแกน
          </Button>
        )}
        {sessionId && isSessionOpen && (
          <Button
            color="error"
            variant="contained"
            loading={closeMutation.isPending}
            onClick={() => {
              controlsRef.current?.stop();
              controlsRef.current = null;
              closeMutation.mutate();
            }}
            startIcon={<RemixIcon icon="solar:stop-circle-bold" />}
          >
            ปิดรอบ
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
