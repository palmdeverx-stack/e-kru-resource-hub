'use client';

import type { TeacherLineInvitation } from 'src/sections/teacher-line/teacher-line-actions';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { varAlpha } from 'minimal-shared/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { getTeachingScheduleStatus } from 'src/utils/teaching-schedule';
import {
  formatImageSize,
  resizeProfileImage,
  PROFILE_IMAGE_SOURCE_LIMIT_BYTES,
} from 'src/utils/resize-profile-image';

import { UploadAvatar } from 'src/components/upload';
import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { TeacherLineDialog } from 'src/sections/teacher-line/components/teacher-line-dialog';
import {
  unlinkTeacherLine,
  getTeacherLineStatus,
  createTeacherLineInvitation,
} from 'src/sections/teacher-line/teacher-line-actions';

import { useAuthContext } from 'src/auth/hooks';

import { STAFF_TYPES, EMPLOYMENT_STATUSES } from 'src/types/staff-employment';

import {
  getTeacherProfile,
  deleteTeacherAvatar,
  uploadTeacherAvatar,
  updateTeacherProfile,
  type UpdateTeacherProfileParams,
} from '../teacher-profile-actions';

// ----------------------------------------------------------------------

const ProfileSchema = z.object({
  firstName: z.string().trim().min(1, { error: 'กรุณากรอกชื่อภาษาไทย' }),
  lastName: z.string().trim().min(1, { error: 'กรุณากรอกนามสกุลภาษาไทย' }),
  namePrefix: z
    .string()
    .trim()
    .min(1, { error: 'กรุณาเลือกคำนำหน้าชื่อ' })
    .max(30, { error: 'คำนำหน้าชื่อยาวเกินไป' }),
  firstNameEn: z.string(),
  lastNameEn: z.string(),
  nickname: z.string().max(100, { error: 'ชื่อเล่นยาวเกินไป' }),
  email: z.union([z.literal(''), z.email({ error: 'รูปแบบอีเมลไม่ถูกต้อง' })]),
  phone: z.string().refine((value) => !value || /^\+?[0-9][0-9 -]{7,19}$/.test(value), {
    error: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง',
  }),
  address: z.string().max(500, { error: 'ที่อยู่ยาวเกิน 500 ตัวอักษร' }),
  username: z.string(),
});

type ProfileSchemaType = z.infer<typeof ProfileSchema>;

const AVATAR_ACCEPT = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

const STAFF_TYPE_LABEL = Object.fromEntries(
  STAFF_TYPES.map((option) => [option.value, option.label])
);
const EMPLOYMENT_STATUS_LABEL = Object.fromEntries(
  EMPLOYMENT_STATUSES.map((option) => [option.value, option.label])
);

function employmentDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function TeacherProfileView() {
  const queryClient = useQueryClient();
  const { checkUserSession } = useAuthContext();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [lineInvitation, setLineInvitation] = useState<TeacherLineInvitation | null>(null);
  const [lineQrImage, setLineQrImage] = useState('');

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const {
    data: profile,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['teacher-profile'],
    queryFn: getTeacherProfile,
  });

  const methods = useForm<ProfileSchemaType>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      namePrefix: '',
      firstNameEn: '',
      lastNameEn: '',
      nickname: '',
      email: '',
      phone: '',
      address: '',
      username: '',
    },
    values: profile
      ? {
          firstName: profile.first_name ?? '',
          lastName: profile.last_name ?? '',
          namePrefix: profile.name_prefix ?? '',
          firstNameEn: profile.first_name_en ?? '',
          lastNameEn: profile.last_name_en ?? '',
          nickname: profile.nickname ?? '',
          email: profile.email ?? '',
          phone: profile.phone ?? '',
          address: profile.address ?? '',
          username: profile.username,
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (params: UpdateTeacherProfileParams) => updateTeacherProfile(params),
    onSuccess: async (updatedProfile) => {
      queryClient.setQueryData(['teacher-profile'], updatedProfile);
      await queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
      await checkUserSession?.();
      methods.reset({
        firstName: updatedProfile.first_name ?? '',
        lastName: updatedProfile.last_name ?? '',
        namePrefix: updatedProfile.name_prefix ?? '',
        firstNameEn: updatedProfile.first_name_en ?? '',
        lastNameEn: updatedProfile.last_name_en ?? '',
        nickname: updatedProfile.nickname ?? '',
        email: updatedProfile.email ?? '',
        phone: updatedProfile.phone ?? '',
        address: updatedProfile.address ?? '',
        username: updatedProfile.username,
      });
    },
  });

  const refreshProfile = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['teacher-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] }),
    ]);
    await checkUserSession?.();
  };

  const avatarMutation = useMutation({
    mutationFn: uploadTeacherAvatar,
    onSuccess: async () => {
      setAvatarFile(null);
      await refreshProfile();
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: deleteTeacherAvatar,
    onSuccess: refreshProfile,
  });

  const lineStatusQuery = useQuery({
    queryKey: ['teacher-line-status'],
    queryFn: getTeacherLineStatus,
    refetchInterval: (statusQuery) =>
      lineDialogOpen && !statusQuery.state.data?.linked ? 2000 : false,
  });
  const lineInviteMutation = useMutation({
    mutationFn: createTeacherLineInvitation,
    onSuccess: (invitation) => {
      setLineQrImage('');
      setLineInvitation(invitation);
    },
  });
  const unlinkLineMutation = useMutation({
    mutationFn: unlinkTeacherLine,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teacher-line-status'] });
      setLineDialogOpen(false);
      setLineInvitation(null);
    },
  });

  const openLineDialog = () => {
    setLineDialogOpen(true);
    setLineInvitation(null);
    setLineQrImage('');
    if (!lineStatusQuery.data?.linked) lineInviteMutation.mutate();
  };
  const closeLineDialog = () => {
    setLineDialogOpen(false);
    setLineInvitation(null);
    setLineQrImage('');
  };

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

  const lineConnected = Boolean(lineStatusQuery.data?.linked);

  const prepareAvatar = async (file: File) => {
    setAvatarError(null);
    setIsPreparingAvatar(true);
    avatarMutation.reset();
    try {
      setAvatarFile(await resizeProfileImage(file));
    } catch (error) {
      setAvatarFile(null);
      setAvatarError(error instanceof Error ? error.message : 'ไม่สามารถเตรียมรูปภาพได้');
    } finally {
      setIsPreparingAvatar(false);
    }
  };

  const onSubmit = methods.handleSubmit((values) =>
    mutation.mutate({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      namePrefix: values.namePrefix.trim(),
      firstNameEn: values.firstNameEn.trim(),
      lastNameEn: values.lastNameEn.trim(),
      nickname: values.nickname.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      address: values.address.trim(),
    })
  );

  if (isLoading) return <TeacherProfileSkeleton />;

  if (isError || !profile) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 7 } }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          ไม่สามารถโหลดข้อมูลโปรไฟล์ครูได้ กรุณาลองใหม่อีกครั้ง
        </Alert>
      </Container>
    );
  }

  const displayName =
    `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.username;
  const initials =
    [profile.first_name, profile.last_name]
      .filter(Boolean)
      .map((name) => name?.charAt(0))
      .join('') || profile.username.charAt(0).toUpperCase();
  const memberSince = new Intl.DateTimeFormat('th-TH', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(profile.created_at));
  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Card
        sx={{
          mb: 3,
          p: { xs: 2.5, sm: 4 },
          color: 'common.white',
          overflow: 'hidden',
          position: 'relative',
          background: (theme) =>
            `linear-gradient(135deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.main} 65%, ${theme.vars.palette.primary.light} 100%)`,
          '&::after': {
            top: -100,
            right: -40,
            width: 240,
            height: 240,
            content: '""',
            borderRadius: '50%',
            position: 'absolute',
            bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.08),
          },
        }}
      >
        <Box
          sx={{
            gap: { xs: 2, sm: 3 },
            zIndex: 1,
            display: 'flex',
            position: 'relative',
            alignItems: 'center',
          }}
        >
          <Avatar
            src={profile.avatar_url ?? undefined}
            aria-label={`รูปโปรไฟล์ของ ${displayName}`}
            sx={(theme) => ({
              width: { xs: 72, sm: 92 },
              height: { xs: 72, sm: 92 },
              fontSize: { xs: 26, sm: 34 },
              fontWeight: 800,
              color: 'primary.darker',
              bgcolor: 'common.white',
              border: `4px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.3)}`,
            })}
          >
            {initials}
          </Avatar>

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: 1 }}>
              โปรไฟล์ครูผู้สอน
            </Typography>
            <Typography component="h1" variant="h3" sx={{ overflowWrap: 'anywhere' }}>
              {displayName}
            </Typography>
            {(profile.first_name_en || profile.last_name_en) && (
              <Typography sx={{ mt: 0.25, opacity: 0.8 }}>
                {`${profile.first_name_en ?? ''} ${profile.last_name_en ?? ''}`.trim()}
              </Typography>
            )}
            <Box sx={{ gap: 1, mt: 1.25, display: 'flex', flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={profile.school?.name ?? 'ยังไม่มีข้อมูลโรงเรียน'}
                sx={(theme) => ({
                  color: 'common.white',
                  bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
                })}
              />
              <Chip
                size="small"
                label={`${profile.summary.assignments} ชั้นเรียนที่รับผิดชอบ`}
                sx={(theme) => ({
                  color: 'common.white',
                  bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
                })}
              />
              {(profile.position_title || profile.academic_rank) && (
                <Chip
                  size="small"
                  label={[profile.position_title, profile.academic_rank]
                    .filter(Boolean)
                    .join(' · ')}
                  sx={(theme) => ({
                    color: 'common.white',
                    bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
                  })}
                />
              )}
            </Box>
          </Box>
        </Box>
      </Card>

      {(mutation.error || avatarMutation.error || deleteAvatarMutation.error || avatarError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {(mutation.error || avatarMutation.error || deleteAvatarMutation.error)?.message ??
            avatarError}
        </Alert>
      )}
      {(mutation.isSuccess || avatarMutation.isSuccess || deleteAvatarMutation.isSuccess) && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {avatarMutation.isSuccess
            ? 'อัปเดตรูปโปรไฟล์เรียบร้อยแล้ว'
            : deleteAvatarMutation.isSuccess
              ? 'ลบรูปโปรไฟล์เรียบร้อยแล้ว'
              : 'บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว'}
        </Alert>
      )}

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
        }}
      >
        <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
          <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
            <Typography component="h2" variant="h6">
              ข้อมูลส่วนตัว
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, mb: 3, color: 'text.secondary' }}>
              แก้ไขข้อมูลที่ใช้แสดงแก่นักเรียนและผู้ดูแลโรงเรียน
            </Typography>

            <Form methods={methods} onSubmit={onSubmit}>
              <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
                <Box
                  sx={{
                    gap: 2.5,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  }}
                >
                  <Field.Select name="namePrefix" label="คำนำหน้าชื่อ *">
                    {(profile.prefix_options ?? []).map((option) => (
                      <MenuItem key={option.id} value={option.name}>
                        {option.name_en ? `${option.name} / ${option.name_en}` : option.name}
                      </MenuItem>
                    ))}
                  </Field.Select>
                  <Field.Text name="nickname" label="ชื่อเล่น" />
                  <Field.Text name="firstName" label="ชื่อภาษาไทย *" autoComplete="given-name" />
                  <Field.Text name="lastName" label="นามสกุลภาษาไทย *" autoComplete="family-name" />
                  <Field.Text
                    name="firstNameEn"
                    label="ชื่อภาษาอังกฤษ"
                    slotProps={{ htmlInput: { lang: 'en' } }}
                  />
                  <Field.Text
                    name="lastNameEn"
                    label="นามสกุลภาษาอังกฤษ"
                    slotProps={{ htmlInput: { lang: 'en' } }}
                  />
                </Box>
                <Box
                  sx={{
                    gap: 2.5,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  }}
                >
                  <Field.Text
                    name="email"
                    type="email"
                    label="อีเมล"
                    placeholder="teacher@example.com"
                    autoComplete="email"
                  />
                  <Field.Text
                    name="phone"
                    type="tel"
                    label="เบอร์โทรศัพท์"
                    placeholder="0812345678"
                    autoComplete="tel"
                  />
                </Box>
                <Field.Text name="address" label="ที่อยู่สำหรับติดต่อ" multiline minRows={3} />
                <Field.Text
                  name="username"
                  label="ชื่อผู้ใช้"
                  disabled
                  helperText="ชื่อผู้ใช้เปลี่ยนเองไม่ได้ หากต้องการแก้ไขกรุณาติดต่อผู้ดูแลโรงเรียน"
                />

                <Divider />

                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="submit"
                    size="large"
                    variant="contained"
                    loading={mutation.isPending}
                    disabled={!methods.formState.isDirty}
                    loadingIndicator="กำลังบันทึก..."
                    startIcon={<RemixIcon icon="solar:check-circle-bold" />}
                    sx={{ width: { xs: 1, sm: 'auto' }, minWidth: 210 }}
                  >
                    บันทึกการเปลี่ยนแปลง
                  </Button>
                </Box>
              </Box>
            </Form>
          </Card>

          <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center' }}>
              <Box sx={{ flex: 1 }}>
                <Typography component="h2" variant="h6">
                  รายวิชาที่รับผิดชอบ
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  รายการล่าสุดที่ได้รับมอบหมาย
                </Typography>
              </Box>
              <Button component={RouterLink} href={paths.teacher.assignments} size="small">
                ดูทั้งหมด
              </Button>
            </Box>

            {profile.teaching_assignments.length ? (
              <Box sx={{ gap: 1.5, display: 'flex', flexDirection: 'column' }}>
                {profile.teaching_assignments.map((item) => {
                  const isTeachingNow =
                    currentTime &&
                    item.semester?.is_active &&
                    Boolean(getTeachingScheduleStatus(item.schedules ?? [], currentTime).active);

                  return (
                    <Box
                      key={item.id}
                      component={RouterLink}
                      href={paths.teacher.assignmentDetail(item.id)}
                      sx={{
                        gap: 1.5,
                        p: 2,
                        display: 'flex',
                        borderRadius: 2,
                        alignItems: 'center',
                        color: 'text.primary',
                        textDecoration: 'none',
                        bgcolor: isTeachingNow ? 'success.lighter' : 'background.neutral',
                        border: '1px solid',
                        borderColor: isTeachingNow ? 'success.light' : 'transparent',
                        '&:hover': {
                          borderColor: isTeachingNow ? 'success.main' : 'primary.main',
                          bgcolor: isTeachingNow ? 'success.lighter' : 'primary.lighter',
                        },
                      }}
                    >
                      <Avatar
                        variant="rounded"
                        sx={{
                          color: isTeachingNow ? 'success.main' : 'primary.main',
                          bgcolor: isTeachingNow ? 'success.lighter' : 'primary.lighter',
                        }}
                      >
                        <RemixIcon icon="solar:notebook-bold-duotone" />
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="subtitle2" noWrap>
                          {item.subject?.code ? `${item.subject.code} · ` : ''}
                          {item.subject?.name ?? 'ไม่ระบุรายวิชา'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                          ห้อง {item.classroom?.name ?? '-'} · {item.semester?.name ?? '-'}
                        </Typography>
                      </Box>
                      {isTeachingNow ? (
                        <Chip size="small" color="success" variant="soft" label="กำลังสอน" />
                      ) : (
                        item.semester?.is_active && (
                          <Chip size="small" color="info" variant="soft" label="ภาคเรียนปัจจุบัน" />
                        )
                      )}
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Alert severity="info">ยังไม่มีรายวิชาที่ได้รับมอบหมาย</Alert>
            )}
          </Card>
        </Box>

        <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
          <Card variant="outlined" sx={{ p: 3 }}>
            <Typography component="h2" variant="h6">
              รูปโปรไฟล์
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, mb: 3, color: 'text.secondary' }}>
              ใช้แสดงในหน้าโปรไฟล์ รายวิชา และเมนูบัญชีของคุณ
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <UploadAvatar
                value={avatarFile ?? profile.avatar_url ?? undefined}
                loading={isPreparingAvatar || avatarMutation.isPending}
                disabled={
                  isPreparingAvatar || avatarMutation.isPending || deleteAvatarMutation.isPending
                }
                accept={AVATAR_ACCEPT}
                maxSize={PROFILE_IMAGE_SOURCE_LIMIT_BYTES}
                onDrop={(files) => {
                  const file = files[0];
                  if (file) void prepareAvatar(file);
                }}
                helperText={
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {avatarFile ? 'ตรวจสอบรูปก่อนกดบันทึก' : 'คลิกหรือลากรูปมาวาง'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {avatarFile
                        ? `ย่อแล้ว ${formatImageSize(avatarFile.size)} · WEBP`
                        : 'ระบบจะย่อรูปอัตโนมัติให้ไม่เกิน 1MB'}
                    </Typography>
                  </Box>
                }
              />
            </Box>

            {avatarFile && (
              <Box sx={{ gap: 1, mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <Button
                  color="inherit"
                  variant="outlined"
                  disabled={avatarMutation.isPending}
                  onClick={() => {
                    setAvatarFile(null);
                    setAvatarError(null);
                  }}
                >
                  ยกเลิก
                </Button>
                <Button
                  variant="contained"
                  loading={avatarMutation.isPending}
                  onClick={() => avatarMutation.mutate(avatarFile)}
                >
                  บันทึกรูป
                </Button>
              </Box>
            )}

            {profile.avatar_url && (
              <Button
                fullWidth
                color="error"
                variant="text"
                loading={deleteAvatarMutation.isPending}
                disabled={isPreparingAvatar || avatarMutation.isPending || Boolean(avatarFile)}
                startIcon={<RemixIcon icon="solar:trash-bin-trash-bold" />}
                onClick={() => deleteAvatarMutation.mutate()}
                sx={{ mt: 2 }}
              >
                ลบรูปโปรไฟล์
              </Button>
            )}
          </Card>

          <Card variant="outlined" sx={{ p: 3 }}>
            <Typography component="h2" variant="h6">
              ข้อมูลการทำงาน
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, mb: 2.5, color: 'text.secondary' }}>
              ผู้ดูแลโรงเรียนเป็นผู้กำหนด หากข้อมูลไม่ถูกต้องกรุณาติดต่อผู้ดูแล
            </Typography>
            <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}>
              {[
                {
                  label: 'ประเภทบุคลากร',
                  value:
                    (profile.staff_type_name_en && profile.staff_type_name
                      ? `${profile.staff_type_name} / ${profile.staff_type_name_en}`
                      : profile.staff_type_name) ??
                    (profile.staff_type ? STAFF_TYPE_LABEL[profile.staff_type] : '-'),
                },
                {
                  label: 'สถานะการทำงาน',
                  value:
                    (profile.employment_status_name_en && profile.employment_status_name
                      ? `${profile.employment_status_name} / ${profile.employment_status_name_en}`
                      : profile.employment_status_name) ??
                    (profile.employment_status
                      ? EMPLOYMENT_STATUS_LABEL[profile.employment_status]
                      : '-'),
                },
                {
                  label: 'วันที่เริ่มงาน',
                  value: employmentDate(profile.employment_start_date),
                },
                {
                  label: 'วันที่บรรจุ',
                  value: employmentDate(profile.appointment_date),
                },
                {
                  label: 'วันที่สิ้นสุดสัญญา',
                  value: employmentDate(profile.contract_end_date),
                },
                { label: 'ตำแหน่ง', value: profile.position_title || '-' },
                { label: 'วิทยฐานะ', value: profile.academic_rank || '-' },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    gap: 1,
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {item.label}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ textAlign: 'right' }}>
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Card>

          <Card variant="outlined" sx={{ p: 3 }}>
            <Typography component="h2" variant="h6" sx={{ mb: 2.5 }}>
              ภาพรวมการสอน
            </Typography>
            <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}>
              <SummaryFact
                icon="solar:notebook-bold-duotone"
                label="รายการสอน"
                value={`${profile.summary.assignments} รายการ`}
              />
              <SummaryFact
                icon="solar:gallery-wide-bold"
                label="รายวิชา"
                value={`${profile.summary.subjects} วิชา`}
              />
              <SummaryFact
                icon="solar:users-group-rounded-bold"
                label="ห้องเรียน"
                value={`${profile.summary.classrooms} ห้อง`}
              />
              <SummaryFact
                icon="solar:home-angle-bold-duotone"
                label="โรงเรียน"
                value={profile.school?.name ?? 'ยังไม่มีข้อมูล'}
              />
            </Box>
          </Card>

          <Card variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
              <Avatar
                variant="rounded"
                sx={{
                  color: lineConnected ? 'success.main' : 'primary.main',
                  bgcolor: lineConnected ? 'success.lighter' : 'primary.lighter',
                }}
              >
                <RemixIcon icon="ic:round-vpn-key" />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h2" variant="subtitle1">
                  แจ้งเตือนผ่าน LINE
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                  {lineConnected
                    ? `เชื่อมแล้ว · ${lineStatusQuery.data?.displayName ?? 'บัญชี LINE'}`
                    : 'ยังไม่เชื่อมต่อ LINE'}
                </Typography>
              </Box>
            </Box>
            <Button
              fullWidth
              color={lineConnected ? 'inherit' : 'success'}
              variant={lineConnected ? 'outlined' : 'contained'}
              startIcon={
                <RemixIcon icon={lineConnected ? 'solar:settings-bold' : 'solar:qr-code-bold'} />
              }
              onClick={openLineDialog}
              sx={{ mt: 2.5 }}
            >
              {lineConnected ? 'จัดการการเชื่อม' : 'เชื่อม LINE'}
            </Button>
          </Card>

          <Card variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
              <Avatar variant="rounded" sx={{ color: 'primary.main', bgcolor: 'primary.lighter' }}>
                <RemixIcon icon="solar:shield-keyhole-bold-duotone" />
              </Avatar>
              <Box>
                <Typography component="h2" variant="subtitle1">
                  ความปลอดภัยของบัญชี
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  เป็นสมาชิกตั้งแต่ {memberSince}
                </Typography>
              </Box>
            </Box>
            <Button
              fullWidth
              component={RouterLink}
              href={paths.auth.jwt.changePassword}
              variant="outlined"
              startIcon={<RemixIcon icon="ic:round-vpn-key" />}
              sx={{ mt: 2.5 }}
            >
              เปลี่ยนรหัสผ่าน
            </Button>
          </Card>
        </Box>
      </Box>

      <TeacherLineDialog
        open={lineDialogOpen}
        invitation={lineInvitation}
        qrImage={lineQrImage}
        connected={lineConnected}
        connectedDisplayName={lineStatusQuery.data?.displayName}
        creatingInvitation={lineInviteMutation.isPending}
        unlinking={unlinkLineMutation.isPending}
        errorMessage={lineInviteMutation.error?.message ?? unlinkLineMutation.error?.message}
        onClose={closeLineDialog}
        onUnlink={() => unlinkLineMutation.mutate()}
      />
    </Container>
  );
}

// ----------------------------------------------------------------------

type SummaryFactProps = {
  icon:
    | 'solar:notebook-bold-duotone'
    | 'solar:gallery-wide-bold'
    | 'solar:users-group-rounded-bold'
    | 'solar:home-angle-bold-duotone';
  label: string;
  value: string;
};

function SummaryFact({ icon, label, value }: SummaryFactProps) {
  return (
    <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
      <Avatar variant="rounded" sx={{ color: 'primary.main', bgcolor: 'primary.lighter' }}>
        <RemixIcon icon={icon} width={21} />
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

function TeacherProfileSkeleton() {
  return (
    <Container maxWidth="lg" aria-label="กำลังโหลดโปรไฟล์ครู" sx={{ pb: 5 }}>
      <Skeleton variant="rounded" height={184} sx={{ mb: 3, borderRadius: 2 }} />
      <Box
        sx={{
          gap: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
        }}
      >
        <Skeleton variant="rounded" height={560} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" height={410} sx={{ borderRadius: 2 }} />
      </Box>
    </Container>
  );
}
