'use client';

import type {
  GuardianInput,
  StudentGuardian,
  GuardianLineInvitation,
} from '../student-guardian-actions';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { RemixIcon } from 'src/components/remix-icon';

import { GuardianFormDialog } from './guardian-form-dialog';
import { GuardianLineDialog } from './guardian-line-dialog';
import { GuardianDeleteDialog } from './guardian-delete-dialog';
import {
  unlinkGuardianLine,
  listStudentGuardians,
  createStudentGuardian,
  updateStudentGuardian,
  deleteStudentGuardian,
  getGuardianLineStatus,
  sendGuardianLineHello,
  sendGuardianProfileLink,
  createGuardianLineInvitation,
} from '../student-guardian-actions';

// ----------------------------------------------------------------------

type Student = {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
};

type Props = {
  student: Student;
  teacherAssignmentId?: string;
};

const EMPTY_FORM: GuardianInput = {
  fullName: '',
  relationship: '',
  phone: '',
  email: '',
  occupation: '',
  address: '',
  notes: '',
  isPrimary: false,
};

export function StudentGuardiansPanel({ student, teacherAssignmentId }: Props) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StudentGuardian | null>(null);
  const [form, setForm] = useState<GuardianInput>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<StudentGuardian | null>(null);
  const [lineTarget, setLineTarget] = useState<StudentGuardian | null>(null);
  const [lineInvitation, setLineInvitation] = useState<GuardianLineInvitation | null>(null);
  const [lineQrImage, setLineQrImage] = useState('');
  const assignmentScope = teacherAssignmentId ?? null;
  const queryKey = ['student-guardians', assignmentScope ?? 'admin', student.id];

  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => listStudentGuardians(assignmentScope, student.id),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? updateStudentGuardian(assignmentScope, student.id, editing.id, form)
        : createStudentGuardian(assignmentScope, student.id, form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setFormOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (guardianId: string) => deleteStudentGuardian(assignmentScope, student.id, guardianId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setDeleteTarget(null);
    },
  });

  const lineInviteMutation = useMutation({
    mutationFn: (guardianId: string) => createGuardianLineInvitation(guardianId),
    onSuccess: (invitation) => {
      setLineQrImage('');
      setLineInvitation(invitation);
    },
  });
  const unlinkLineMutation = useMutation({
    mutationFn: (guardianId: string) => unlinkGuardianLine(guardianId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setLineTarget(null);
      setLineInvitation(null);
    },
  });
  const lineStatusQuery = useQuery({
    queryKey: ['guardian-line-status', lineTarget?.id],
    queryFn: () => getGuardianLineStatus(lineTarget!.id),
    enabled: Boolean(lineTarget && (lineInvitation || lineTarget.line_linked_at)),
    refetchInterval: (statusQuery) => (statusQuery.state.data?.linked ? false : 2000),
  });
  const helloLineMutation = useMutation({
    mutationFn: (guardianId: string) => sendGuardianLineHello(guardianId),
  });
  const profileLineMutation = useMutation({
    mutationFn: (guardianId: string) => sendGuardianProfileLink(guardianId),
  });

  useEffect(() => {
    const payload = lineInvitation?.lineChatUrl;
    if (!payload) return undefined;
    let active = true;
    void import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(payload, {
          width: 520,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#111827', light: '#FFFFFF' },
        })
      )
      .then((image) => {
        if (active) setLineQrImage(image);
      })
      .catch(() => {
        if (active) setLineQrImage('');
      });
    return () => {
      active = false;
    };
  }, [lineInvitation?.lineChatUrl]);

  useEffect(() => {
    if (lineStatusQuery.data?.linked) {
      void queryClient.invalidateQueries({
        queryKey: ['student-guardians', assignmentScope ?? 'admin', student.id],
      });
    }
  }, [assignmentScope, lineStatusQuery.data?.linked, queryClient, student.id]);

  const lineConnected = Boolean(lineTarget?.line_linked_at || lineStatusQuery.data?.linked);
  const closeLineDialog = () => {
    setLineTarget(null);
    setLineInvitation(null);
    setLineQrImage('');
  };

  const openLineDialog = (guardian: StudentGuardian) => {
    setLineTarget(guardian);
    setLineInvitation(null);
    setLineQrImage('');
    if (!guardian.line_linked_at) lineInviteMutation.mutate(guardian.id);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, isPrimary: data.length === 0 });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (guardian: StudentGuardian) => {
    setEditing(guardian);
    setForm({
      fullName: guardian.full_name,
      relationship: guardian.relationship,
      phone: guardian.phone,
      email: guardian.email ?? '',
      occupation: guardian.occupation ?? '',
      address: guardian.address ?? '',
      notes: guardian.notes ?? '',
      isPrimary: guardian.is_primary,
    });
    setFormError('');
    setFormOpen(true);
  };

  const submit = () => {
    if (!form.fullName.trim() || !form.relationship.trim() || !form.phone.trim()) {
      setFormError('กรุณากรอกชื่อ ความสัมพันธ์ และเบอร์โทรศัพท์');
      return;
    }
    setFormError('');
    saveMutation.mutate();
  };

  return (
    <>
      <Box
        sx={{
          mb: 2,
          gap: 1.5,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6">ผู้ปกครอง</Typography>
          {!isLoading && (
            <Chip size="small" color="primary" variant="soft" label={`${data.length} คน`} />
          )}
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<RemixIcon icon="mingcute:add-line" />}
          onClick={openCreate}
        >
          เพิ่มผู้ปกครอง
        </Button>
      </Box>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          ไม่สามารถโหลดข้อมูลผู้ปกครองได้
        </Alert>
      )}
      {helloLineMutation.isSuccess && (
        <Alert
          severity="success"
          variant="outlined"
          onClose={() => helloLineMutation.reset()}
          sx={{ mb: 2 }}
        >
          ส่งข้อความสวัสดีไปยัง LINE ผู้ปกครองแล้ว
        </Alert>
      )}
      {helloLineMutation.error && (
        <Alert
          severity="error"
          variant="outlined"
          onClose={() => helloLineMutation.reset()}
          sx={{ mb: 2 }}
        >
          {helloLineMutation.error.message}
        </Alert>
      )}
      {profileLineMutation.isSuccess && (
        <Alert
          severity="success"
          variant="outlined"
          onClose={() => profileLineMutation.reset()}
          sx={{ mb: 2 }}
        >
          ส่งลิงก์โปรไฟล์นักเรียนไปยัง LINE ผู้ปกครองแล้ว
        </Alert>
      )}
      {profileLineMutation.error && (
        <Alert
          severity="error"
          variant="outlined"
          onClose={() => profileLineMutation.reset()}
          sx={{ mb: 2 }}
        >
          {profileLineMutation.error.message}
        </Alert>
      )}
      {isLoading && (
        <Box sx={{ py: 8, gap: 1.5, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={32} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            กำลังโหลดข้อมูลผู้ปกครอง...
          </Typography>
        </Box>
      )}
      {!isLoading && !isError && !data.length && (
        <Box
          sx={{
            py: 7,
            px: 2,
            textAlign: 'center',
            borderRadius: 2,
            bgcolor: 'background.neutral',
            border: '1px dashed',
            borderColor: 'divider',
          }}
        >
          <Avatar
            sx={{
              mx: 'auto',
              width: 56,
              height: 56,
              color: 'text.secondary',
              bgcolor: 'background.paper',
            }}
          >
            <RemixIcon icon="solar:users-group-rounded-bold" width={30} />
          </Avatar>
          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            ยังไม่มีข้อมูลผู้ปกครอง
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            เพิ่มผู้ติดต่อเพื่อให้ครูสามารถประสานงานได้สะดวก
          </Typography>
        </Box>
      )}
      {!isLoading && data.length > 0 && (
        <Box
          sx={{
            overflow: 'hidden',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {data.map((guardian, index) => (
            <Box
              key={guardian.id}
              sx={{
                p: { xs: 2, sm: 2.5 },
                bgcolor: 'background.paper',
                borderBottom: index < data.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'flex-start' }}>
                <Avatar
                  sx={{
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    fontWeight: 700,
                    color: guardian.is_primary ? 'primary.main' : 'text.secondary',
                    bgcolor: guardian.is_primary ? 'primary.lighter' : 'background.neutral',
                  }}
                >
                  {guardian.full_name.trim().charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box
                    sx={{
                      gap: 0.75,
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Typography variant="subtitle1">{guardian.full_name}</Typography>
                    <Chip size="small" variant="soft" label={guardian.relationship} />
                    {guardian.is_primary && (
                      <Chip
                        size="small"
                        color="primary"
                        variant="soft"
                        icon={<RemixIcon icon="eva:star-fill" />}
                        label="ผู้ติดต่อหลัก"
                      />
                    )}
                  </Box>
                  <Box
                    sx={{
                      gap: { xs: 0.75, sm: 2 },
                      mt: 0.75,
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      flexWrap: 'wrap',
                      color: 'text.secondary',
                    }}
                  >
                    <Box sx={{ gap: 0.75, display: 'flex', alignItems: 'center' }}>
                      <RemixIcon icon="solar:phone-bold" width={16} />
                      <Typography variant="body2">{guardian.phone}</Typography>
                    </Box>
                    {guardian.email && (
                      <Box sx={{ gap: 0.75, display: 'flex', alignItems: 'center' }}>
                        <RemixIcon icon="solar:letter-bold" width={16} />
                        <Typography variant="body2">{guardian.email}</Typography>
                      </Box>
                    )}
                    {guardian.occupation && (
                      <Box sx={{ gap: 0.75, display: 'flex', alignItems: 'center' }}>
                        <RemixIcon icon="solar:case-minimalistic-bold" width={16} />
                        <Typography variant="body2">{guardian.occupation}</Typography>
                      </Box>
                    )}
                  </Box>
                  {(guardian.address || guardian.notes) && (
                    <Typography
                      variant="caption"
                      sx={{ mt: 0.75, display: 'block', color: 'text.disabled' }}
                    >
                      {[guardian.address, guardian.notes].filter(Boolean).join(' · ')}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex' }}>
                  <Tooltip title="แก้ไข">
                    <IconButton
                      size="small"
                      aria-label="แก้ไขข้อมูลผู้ปกครอง"
                      onClick={() => openEdit(guardian)}
                    >
                      <RemixIcon icon="solar:pen-bold" width={19} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="ลบ">
                    <IconButton
                      size="small"
                      color="error"
                      aria-label="ลบข้อมูลผู้ปกครอง"
                      onClick={() => setDeleteTarget(guardian)}
                    >
                      <RemixIcon icon="solar:trash-bin-trash-bold" width={19} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Divider sx={{ my: 1.75, borderStyle: 'dashed' }} />

              <Box
                sx={{
                  gap: 1,
                  display: 'flex',
                  alignItems: { xs: 'stretch', sm: 'center' },
                  flexDirection: { xs: 'column', sm: 'row' },
                }}
              >
                <Box
                  sx={{
                    gap: 0.75,
                    display: 'flex',
                    alignItems: 'center',
                    color: guardian.line_linked_at ? 'success.dark' : 'text.secondary',
                  }}
                >
                  <RemixIcon
                    icon={
                      guardian.line_linked_at
                        ? 'solar:check-circle-bold'
                        : 'solar:chat-round-dots-bold'
                    }
                    width={20}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {guardian.line_linked_at
                      ? `เชื่อม LINE แล้ว · ${guardian.line_display_name ?? 'ผู้ปกครอง'}`
                      : 'ยังไม่เชื่อมต่อ LINE'}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }} />
                <Box sx={{ gap: 0.75, display: 'flex', flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    color={guardian.line_linked_at ? 'inherit' : 'success'}
                    variant={guardian.line_linked_at ? 'text' : 'contained'}
                    startIcon={<RemixIcon icon="eva:link-2-fill" />}
                    onClick={() => openLineDialog(guardian)}
                  >
                    {guardian.line_linked_at ? 'จัดการการเชื่อม' : 'เชื่อม LINE'}
                  </Button>
                  {guardian.line_linked_at && (
                    <>
                      <Button
                        size="small"
                        color="success"
                        variant="outlined"
                        loading={
                          profileLineMutation.isPending &&
                          profileLineMutation.variables === guardian.id
                        }
                        startIcon={<RemixIcon icon="solar:user-id-bold" />}
                        onClick={() => profileLineMutation.mutate(guardian.id)}
                      >
                        ส่งโปรไฟล์
                      </Button>
                      <Button
                        size="small"
                        color="success"
                        variant="outlined"
                        loading={
                          helloLineMutation.isPending &&
                          helloLineMutation.variables === guardian.id
                        }
                        startIcon={<RemixIcon icon="solar:chat-round-dots-bold" />}
                        onClick={() => helloLineMutation.mutate(guardian.id)}
                      >
                        ส่งสวัสดี
                      </Button>
                    </>
                  )}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <GuardianFormDialog
        open={formOpen}
        editing={Boolean(editing)}
        value={form}
        errorMessage={formError || saveMutation.error?.message}
        loading={saveMutation.isPending}
        onChange={setForm}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
      />

      <GuardianDeleteDialog
        guardian={deleteTarget}
        errorMessage={deleteMutation.error?.message}
        loading={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />

      <GuardianLineDialog
        guardian={lineTarget}
        invitation={lineInvitation}
        qrImage={lineQrImage}
        connected={lineConnected}
        connectedDisplayName={lineStatusQuery.data?.displayName}
        creatingInvitation={lineInviteMutation.isPending}
        unlinking={unlinkLineMutation.isPending}
        errorMessage={lineInviteMutation.error?.message ?? unlinkLineMutation.error?.message}
        onClose={closeLineDialog}
        onUnlink={() => lineTarget && unlinkLineMutation.mutate(lineTarget.id)}
      />
    </>
  );
}
