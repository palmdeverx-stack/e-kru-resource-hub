'use client';

import type { IScannerControls } from '@zxing/browser';
import type { AttendanceScanResult } from '../attendance-scan-actions';

import dayjs from 'dayjs';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Label } from 'src/components/label';
import { RemixIcon } from 'src/components/remix-icon';

import {
  scanStudentQr,
  getAttendanceScanSession,
  closeAttendanceScanSession,
} from '../attendance-scan-actions';

// ----------------------------------------------------------------------

const SESSION_LABEL = {
  homeroom_morning: 'เข้าแถวตอนเช้า',
  class_period: 'เข้าเรียนรายคาบ',
  homeroom_evening: 'เข้าแถวตอนเย็น',
} as const;

type ScanFeedback =
  | { type: 'success'; result: AttendanceScanResult }
  | { type: 'error'; message: string }
  | null;

export function AttendanceScanSessionView({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanInFlightRef = useRef(false);
  const lastPayloadRef = useRef({ value: '', at: 0 });
  const [cameraError, setCameraError] = useState('');
  const [manualPayload, setManualPayload] = useState('');
  const [feedback, setFeedback] = useState<ScanFeedback>(null);

  const sessionQuery = useQuery({
    queryKey: ['attendance-scan-session', sessionId],
    queryFn: () => getAttendanceScanSession(sessionId),
    refetchInterval: (query) => (query.state.data?.session.status === 'open' ? 15000 : false),
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

  const sessionStatus = sessionQuery.data?.session.status;

  useEffect(() => {
    const videoElement = videoRef.current;
    if (sessionStatus !== 'open' || !videoElement) return undefined;

    let disposed = false;
    const startScanner = async () => {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (disposed) return;

      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 1000,
      });
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        },
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
  }, [processPayload, sessionStatus]);

  if (sessionQuery.isLoading) {
    return (
      <Box sx={{ py: 12, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <Container maxWidth="md">
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => sessionQuery.refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          {sessionQuery.error?.message ?? 'ไม่พบรอบเช็คชื่อ'}
        </Alert>
      </Container>
    );
  }

  const { session, events } = sessionQuery.data;
  const assignment = session.teacher_assignment;
  const contextTitle =
    session.session_type === 'class_period'
      ? `${assignment?.subject.name ?? 'วิชา'} · ${session.period_label ?? 'คาบเรียน'}`
      : SESSION_LABEL[session.session_type];
  const isOpen = session.status === 'open' && dayjs().isBefore(dayjs(session.closes_at));

  return (
    <Container maxWidth="xl" sx={{ px: { xs: 1.5, sm: 3 }, pb: { xs: 3, sm: 5 } }}>
      <Box
        sx={{
          mb: { xs: 2, sm: 3 },
          gap: { xs: 1, sm: 2 },
          display: { xs: 'grid', md: 'flex' },
          alignItems: { xs: 'flex-start', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
          gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'none' },
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ gap: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography
              component="h1"
              variant="h3"
              sx={{ fontSize: { xs: '1.35rem', sm: '2rem', md: '2.5rem' } }}
            >
              {contextTitle}
            </Typography>
            <Label color={isOpen ? 'success' : 'default'}>
              {isOpen ? 'กำลังเปิดรับสแกน' : 'ปิดรอบแล้ว'}
            </Label>
          </Box>
          <Typography variant="body2" sx={{ mt: { xs: 0.5, sm: 1 }, color: 'text.secondary' }}>
            {session.classroom.name} · วันที่ {dayjs(session.session_date).format('DD/MM/YYYY')} ·
            สายหลัง {dayjs(session.late_after).format('HH:mm')} น.
          </Typography>
        </Box>
        <Box sx={{ gap: 0.5, display: 'flex' }}>
          <Button
            component={RouterLink}
            href={paths.teacher.attendanceScan}
            color="inherit"
            variant="outlined"
            aria-label="กลับไปเลือกรอบ"
            sx={{
              minWidth: { xs: 40, sm: 64 },
              px: { xs: 1, sm: 2 },
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              กลับไปเลือกรอบ
            </Box>
            <RemixIcon
              icon="solar:reply-bold"
              width={18}
              sx={{ display: { xs: 'block', sm: 'none' } }}
            />
          </Button>
          {isOpen && (
            <Button
              color="error"
              variant="contained"
              loading={closeMutation.isPending}
              onClick={() => closeMutation.mutate()}
              startIcon={<RemixIcon icon="solar:stop-circle-bold" />}
              aria-label="ปิดรอบ"
              sx={{
                minWidth: { xs: 40, sm: 64 },
                px: { xs: 1, sm: 2 },
                '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                ปิดรอบ
              </Box>
            </Button>
          )}
        </Box>
      </Box>

      {closeMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {closeMutation.error.message}
        </Alert>
      )}

      <Box
        sx={{
          gap: { xs: 1.5, sm: 3 },
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(340px, 0.6fr)' },
        }}
      >
        <Card variant="outlined" sx={{ overflow: 'hidden', borderRadius: { xs: 2, sm: 1 } }}>
          <Box
            sx={{
              position: 'relative',
              bgcolor: 'grey.900',
              overflow: 'hidden',
              aspectRatio: { xs: '1 / 1', sm: '16 / 10' },
            }}
          >
            {isOpen ? (
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
                    width: { xs: 230, sm: 300 },
                    height: { xs: 230, sm: 300 },
                    position: 'absolute',
                    borderRadius: 2,
                    border: '3px solid',
                    borderColor: feedback?.type === 'success' ? 'success.main' : 'common.white',
                    transform: 'translate(-50%, -50%)',
                    boxShadow: '0 0 0 999px rgba(0,0,0,0.28)',
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    left: 16,
                    right: 16,
                    bottom: 18,
                    color: 'common.white',
                    textAlign: 'center',
                    position: 'absolute',
                    textShadow: '0 1px 3px rgba(0,0,0,.8)',
                  }}
                >
                  วาง QR ให้อยู่ในกรอบ
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
                <RemixIcon icon="solar:stop-circle-bold" width={56} />
                <Typography variant="h6">รอบเช็คชื่อสิ้นสุดแล้ว</Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ p: { xs: 1.25, sm: 2.5 }, bgcolor: '#fff' }}>
            {cameraError && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {cameraError}
              </Alert>
            )}
            {feedback?.type === 'success' && (
              <Alert severity="success" sx={{ mb: 2 }}>
                บันทึก{' '}
                {`${feedback.result.student.firstName ?? ''} ${feedback.result.student.lastName ?? ''}`.trim() ||
                  feedback.result.student.username}{' '}
                แล้ว · {feedback.result.status === 'late' ? 'สาย' : 'มา'}
              </Alert>
            )}
            {feedback?.type === 'error' && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {feedback.message}
              </Alert>
            )}

            {isOpen && (
              <Box sx={{ gap: 1, display: 'flex', alignItems: 'flex-start' }}>
                <TextField
                  fullWidth
                  size="small"
                  label="กรอก QR กรณีกล้องใช้ไม่ได้"
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
        </Card>

        <Card variant="outlined" sx={{ borderRadius: { xs: 2, sm: 1 } }}>
          <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
            <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}>
              สแกนแล้ว {events.length} คน
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              รายการล่าสุดจะแสดงอยู่ด้านบน
            </Typography>
          </Box>
          <Divider />
          <Box sx={{ maxHeight: 620, overflowY: 'auto' }}>
            {!events.length && (
              <Box sx={{ py: 8, px: 2, textAlign: 'center', color: 'text.secondary' }}>
                <RemixIcon icon="solar:videocamera-record-bold" width={42} sx={{ mb: 1 }} />
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
                    p: { xs: 1.25, sm: 2 },
                    gap: { xs: 1, sm: 1.5 },
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Avatar src={event.student.avatar_url ?? undefined}>{name.charAt(0)}</Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" noWrap>
                      {name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {event.student.student_code ?? `@${event.student.username}`} ·{' '}
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
        </Card>
      </Box>
    </Container>
  );
}
