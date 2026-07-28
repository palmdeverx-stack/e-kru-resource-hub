'use client';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { varAlpha } from 'minimal-shared/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { UploadAvatar } from 'src/components/upload';
import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from 'src/auth/hooks';

import { getSchool, updateSchool, uploadSchoolLogo, listSchoolTeachers } from '../school-actions';

// ----------------------------------------------------------------------

export const SchoolProfileSchema = z.object({
  name: z.string().trim().min(1, { error: 'กรุณากรอกชื่อโรงเรียนภาษาไทย!' }),
  nameEn: z.string().trim(),
});

type SchoolProfileSchemaType = z.infer<typeof SchoolProfileSchema>;

const LOGO_ACCEPT = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
};

const MAX_LOGO_SIZE = 2 * 1024 * 1024;

type Props = {
  readOnly?: boolean;
};

export function SchoolProfileView({ readOnly = false }: Props) {
  const { user } = useAuthContext();
  const schoolId = user?.school_id ?? '';
  const queryClient = useQueryClient();

  const {
    data: school,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => getSchool(schoolId),
    enabled: !!schoolId,
  });

  const teachersQuery = useQuery({
    queryKey: ['school-teachers', schoolId],
    queryFn: () => listSchoolTeachers(schoolId),
    enabled: !!schoolId,
  });

  const methods = useForm<SchoolProfileSchemaType>({
    resolver: zodResolver(SchoolProfileSchema),
    defaultValues: { name: '', nameEn: '' },
    values: school ? { name: school.name, nameEn: school.name_en ?? '' } : undefined,
  });

  const {
    handleSubmit,
    formState: { isDirty },
  } = methods;

  const updateMutation = useMutation({
    mutationFn: (params: { name: string; nameEn?: string }) => updateSchool(schoolId, params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['school', schoolId] }),
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => uploadSchoolLogo(schoolId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['school', schoolId] }),
  });

  const onSubmit = handleSubmit(async (data) =>
    updateMutation.mutate({
      name: data.name.trim(),
      nameEn: data.nameEn.trim(),
    })
  );

  const errorMessage = updateMutation.error?.message ?? logoMutation.error?.message;

  if (!schoolId) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
        <Alert severity="warning">
          บัญชีนี้ยังไม่ได้เชื่อมโยงกับโรงเรียน กรุณาติดต่อผู้ดูแลระบบ
        </Alert>
      </Container>
    );
  }

  if (isLoading) {
    return <SchoolProfileSkeleton />;
  }

  if (isError || !school) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              ลองอีกครั้ง
            </Button>
          }
        >
          ไม่สามารถโหลดข้อมูลโรงเรียนได้ กรุณาลองใหม่อีกครั้ง
        </Alert>
      </Container>
    );
  }

  const createdDate = new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(school.created_at));

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Card
        sx={{
          mb: 4,
          p: { xs: 3, sm: 4 },
          color: 'common.white',
          overflow: 'hidden',
          position: 'relative',
          background: (theme) =>
            `linear-gradient(135deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.main} 100%)`,
          '&::after': {
            width: 260,
            height: 260,
            content: '""',
            borderRadius: '50%',
            position: 'absolute',
            right: { xs: -180, sm: -80 },
            bottom: -180,
            backgroundColor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.08),
          },
        }}
      >
        <Box
          sx={{
            gap: 2.5,
            zIndex: 1,
            display: 'flex',
            position: 'relative',
            alignItems: 'center',
          }}
        >
          <Box
            sx={{
              width: { xs: 64, sm: 80 },
              height: { xs: 64, sm: 80 },
              flexShrink: 0,
              display: 'grid',
              overflow: 'hidden',
              borderRadius: 2.5,
              placeItems: 'center',
              bgcolor: 'common.white',
              border: (theme) =>
                `3px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.3)}`,
            }}
          >
            {school.logo_url ? (
              <Box
                component="img"
                src={school.logo_url}
                alt={`โลโก้ ${school.name}`}
                sx={{ width: 1, height: 1, objectFit: 'cover' }}
              />
            ) : (
              <RemixIcon
                icon="solar:users-group-rounded-bold-duotone"
                width={38}
                sx={{ color: 'primary.main' }}
              />
            )}
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography component="p" variant="overline" sx={{ opacity: 0.76 }}>
              ข้อมูลโรงเรียน
            </Typography>
            <Typography component="h1" variant="h3" sx={{ mb: 1 }}>
              {school.name}
            </Typography>
            {school.name_en && (
              <Typography sx={{ mb: 1, opacity: 0.8 }}>{school.name_en}</Typography>
            )}
            <Box sx={{ gap: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={`รหัส ${school.code}`}
                sx={(theme) => ({
                  color: 'common.white',
                  bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.14),
                })}
              />
              <Chip
                size="small"
                icon={
                  <RemixIcon
                    icon={
                      school.is_active ? 'solar:check-circle-bold' : 'solar:forbidden-circle-bold'
                    }
                  />
                }
                label={school.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                sx={{
                  color: 'common.white',
                  bgcolor: (theme) =>
                    varAlpha(
                      school.is_active
                        ? theme.vars.palette.success.mainChannel
                        : theme.vars.palette.error.mainChannel,
                      school.is_active ? 0.28 : 0.3
                    ),
                  '& .MuiChip-icon': { color: 'inherit' },
                }}
              />
            </Box>
          </Box>
        </Box>
      </Card>

      {!readOnly && (errorMessage || updateMutation.isSuccess || logoMutation.isSuccess) && (
        <Alert severity={errorMessage ? 'error' : 'success'} sx={{ mb: 3 }}>
          {errorMessage ??
            (logoMutation.isSuccess
              ? 'อัปเดตโลโก้โรงเรียนเรียบร้อยแล้ว'
              : 'บันทึกข้อมูลโรงเรียนเรียบร้อยแล้ว')}
        </Alert>
      )}

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: '320px minmax(0, 1fr)' },
        }}
      >
        <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, height: '100%' }}>
          <Box sx={{ mb: 3 }}>
            <Typography component="h2" variant="h6">
              โลโก้โรงเรียน
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              ใช้แสดงในระบบและเอกสารของโรงเรียน
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            {readOnly ? (
              <Box
                sx={{
                  width: 180,
                  height: 180,
                  display: 'grid',
                  overflow: 'hidden',
                  borderRadius: 3,
                  placeItems: 'center',
                }}
              >
                {school.logo_url ? (
                  <Box
                    component="img"
                    src={school.logo_url}
                    alt={`โลโก้ ${school.name}`}
                    sx={{ width: 1, height: 1, p: 2, objectFit: 'contain' }}
                  />
                ) : (
                  <RemixIcon icon="solar:school-bold" width={72} sx={{ color: 'text.disabled' }} />
                )}
              </Box>
            ) : (
              <UploadAvatar
                value={school.logo_url ?? undefined}
                loading={logoMutation.isPending}
                disabled={logoMutation.isPending}
                accept={LOGO_ACCEPT}
                maxSize={MAX_LOGO_SIZE}
                onDrop={(files) => {
                  const file = files[0];
                  if (file) logoMutation.mutate(file);
                }}
                helperText={
                  <Box sx={{ mt: 2.5, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      คลิกหรือลากรูปมาวางเพื่อเปลี่ยนโลโก้
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}
                    >
                      PNG, JPEG, WEBP หรือ SVG ขนาดไม่เกิน 2MB
                    </Typography>
                  </Box>
                }
              />
            )}
          </Box>

          {!readOnly && (
            <Alert
              severity="info"
              icon={<RemixIcon icon="solar:info-circle-bold" />}
              sx={{ mt: 3 }}
            >
              แนะนำรูปสี่เหลี่ยมจัตุรัส พื้นหลังโปร่งใส เพื่อให้แสดงผลได้สวยในทุกจุด
            </Alert>
          )}
        </Card>

        <Card variant="outlined">
          <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
            <Box sx={{ mb: 3 }}>
              <Typography component="h2" variant="h6">
                ข้อมูลทั่วไป
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                ข้อมูลนี้จะแสดงแก่ครู นักเรียน และผู้ดูแลในระบบ
              </Typography>
            </Box>

            {readOnly ? (
              <Box
                sx={{
                  gap: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                }}
              >
                <ReadOnlyInfo
                  icon="solar:school-bold"
                  label="ชื่อโรงเรียนภาษาไทย"
                  value={school.name}
                  description="ชื่ออย่างเป็นทางการของโรงเรียน"
                />
                <ReadOnlyInfo
                  icon="solar:global-bold"
                  label="ชื่อโรงเรียนภาษาอังกฤษ"
                  value={school.name_en || '-'}
                  description={school.name_en ? 'ชื่อภาษาอังกฤษ' : 'ยังไม่ได้ระบุ'}
                />
                <ReadOnlyInfo
                  icon="solar:file-text-bold"
                  label="รหัสโรงเรียน"
                  value={school.code}
                  description="รหัสประจำโรงเรียน 8 หลัก"
                />
                <ReadOnlyInfo
                  icon="solar:calendar-date-bold"
                  label="เริ่มใช้งานเมื่อ"
                  value={createdDate}
                  description="วันที่เข้าร่วมระบบ"
                />
              </Box>
            ) : (
              <Form methods={methods} onSubmit={onSubmit}>
                <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
                  <Field.Text
                    name="name"
                    label="ชื่อโรงเรียนภาษาไทย *"
                    placeholder="เช่น โรงเรียนตัวอย่างวิทยา"
                    helperText="ชื่อหลักที่ใช้แสดงในระบบ"
                  />
                  <Field.Text
                    name="nameEn"
                    label="ชื่อโรงเรียนภาษาอังกฤษ"
                    placeholder="e.g. Example Wittaya School"
                    helperText="ไม่บังคับ"
                    slotProps={{ htmlInput: { lang: 'en' } }}
                  />

                  <Divider />

                  <Box
                    sx={{
                      gap: 2,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    }}
                  >
                    <ReadOnlyInfo
                      icon="solar:file-text-bold"
                      label="รหัสโรงเรียน"
                      value={school.code}
                      description="รหัสนี้ไม่สามารถแก้ไขได้"
                    />
                    <ReadOnlyInfo
                      icon="solar:calendar-date-bold"
                      label="เริ่มใช้งานเมื่อ"
                      value={createdDate}
                      description="วันที่สร้างโรงเรียนในระบบ"
                    />
                  </Box>

                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="submit"
                      size="large"
                      variant="contained"
                      disabled={!isDirty}
                      loading={updateMutation.isPending}
                      loadingIndicator="กำลังบันทึก..."
                      startIcon={<RemixIcon icon="solar:check-circle-bold" />}
                      sx={{ width: { xs: 1, sm: 'auto' }, minWidth: 210 }}
                    >
                      บันทึกการเปลี่ยนแปลง
                    </Button>
                  </Box>
                </Box>
              </Form>
            )}
          </Box>
        </Card>
      </Box>

      <Card variant="outlined" sx={{ mt: 3 }}>
        <Box
          sx={{
            px: { xs: 2.5, sm: 3 },
            py: 2.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography component="h2" variant="h6">
            บอร์ดบุคลากรโรงเรียน
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
            {teachersQuery.isLoading
              ? 'กำลังโหลด...'
              : `${teachersQuery.data?.length ?? 0} คน — ข้อมูลบุคลากร ฝ่าย และครูประจำชั้น`}
          </Typography>
        </Box>

        {teachersQuery.isError && (
          <Alert severity="error" sx={{ m: 2.5 }}>
            ไม่สามารถโหลดรายชื่อครูได้
          </Alert>
        )}

        <Box sx={{ gap: 1.5, p: 2, display: { xs: 'grid', md: 'none' } }}>
          {teachersQuery.isLoading &&
            Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} variant="rounded" height={180} />
            ))}
          {!teachersQuery.isLoading && !teachersQuery.data?.length && (
            <Typography sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
              ยังไม่มีบุคลากรในโรงเรียนนี้
            </Typography>
          )}
          {teachersQuery.data?.map((teacher) => (
            <Card key={teacher.id} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
                <Avatar src={teacher.avatar_url ?? undefined} sx={{ width: 48, height: 48 }}>
                  {teacher.first_name?.charAt(0) ?? '?'}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1">
                    {`${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`.trim()}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {[teacher.position_title, teacher.academic_rank].filter(Boolean).join(' · ') ||
                      'ยังไม่ได้ระบุตำแหน่ง'}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <Box sx={{ gap: 1.25, display: 'grid' }}>
                <BoardInfoRow label="ฝ่าย" value={teacher.department_name || 'ไม่มีฝ่าย'} />
                <BoardInfoRow
                  label="หน้าที่ในฝ่าย"
                  value={
                    teacher.role_in_department === 'head'
                      ? 'หัวหน้าฝ่าย'
                      : teacher.role_in_department === 'member'
                        ? 'สมาชิกฝ่าย'
                        : '-'
                  }
                />
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    ครูประจำชั้น
                  </Typography>
                  {teacher.homeroom_classrooms.length ? (
                    <Box sx={{ gap: 0.5, mt: 0.5, display: 'flex', flexWrap: 'wrap' }}>
                      {teacher.homeroom_classrooms.map((classroom) => (
                        <Chip
                          key={`${classroom.grade_level}-${classroom.name}`}
                          size="small"
                          variant="soft"
                          label={
                            classroom.grade_level
                              ? `${classroom.grade_level} ${classroom.name}`
                              : classroom.name
                          }
                        />
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2">ไม่ได้เป็นครูประจำชั้น</Typography>
                  )}
                </Box>
              </Box>
            </Card>
          ))}
        </Box>

        <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>บุคลากร</TableCell>
                <TableCell>ฝ่าย</TableCell>
                <TableCell>ตำแหน่ง</TableCell>
                <TableCell>หน้าที่ในฝ่าย</TableCell>
                <TableCell>ครูประจำชั้น</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teachersQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={5}>กำลังโหลด...</TableCell>
                </TableRow>
              )}
              {!teachersQuery.isLoading && !teachersQuery.data?.length && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}
                  >
                    ยังไม่มีบุคลากรในโรงเรียนนี้
                  </TableCell>
                </TableRow>
              )}
              {teachersQuery.data?.map((teacher) => (
                <TableRow key={teacher.id} hover>
                  <TableCell>
                    <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
                      <Avatar src={teacher.avatar_url ?? undefined}>
                        {teacher.first_name?.charAt(0) ?? '?'}
                      </Avatar>
                      <Typography variant="subtitle2">
                        {`${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`.trim()}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {teacher.department_name ?? (
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                        ไม่มีฝ่าย
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {[teacher.position_title, teacher.academic_rank].filter(Boolean).join(' · ') ||
                      '-'}
                  </TableCell>
                  <TableCell>
                    {teacher.role_in_department ? (
                      <Chip
                        size="small"
                        variant="soft"
                        color={teacher.role_in_department === 'head' ? 'primary' : 'default'}
                        label={teacher.role_in_department === 'head' ? 'หัวหน้าฝ่าย' : 'สมาชิกฝ่าย'}
                      />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {teacher.homeroom_classrooms.length ? (
                      <Box sx={{ gap: 0.5, display: 'flex', flexWrap: 'wrap' }}>
                        {teacher.homeroom_classrooms.map((classroom) => (
                          <Chip
                            key={classroom.name}
                            size="small"
                            variant="soft"
                            label={
                              classroom.grade_level
                                ? `${classroom.grade_level} ${classroom.name}`
                                : classroom.name
                            }
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                        ไม่ได้เป็นครูประจำชั้น
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Container>
  );
}

// ----------------------------------------------------------------------

function BoardInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ gap: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 600 }}>
        {value}
      </Typography>
    </Box>
  );
}

type ReadOnlyInfoProps = {
  icon:
    | 'solar:school-bold'
    | 'solar:global-bold'
    | 'solar:file-text-bold'
    | 'solar:calendar-date-bold';
  label: string;
  value: string;
  description: string;
};

function ReadOnlyInfo({ icon, label, value, description }: ReadOnlyInfoProps) {
  return (
    <Box
      sx={{
        gap: 1.5,
        p: 2,
        display: 'flex',
        borderRadius: 2,
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          flexShrink: 0,
          display: 'grid',
          borderRadius: 1.25,
          color: 'primary.main',
          placeItems: 'center',
          bgcolor: 'primary.lighter',
        }}
      >
        <RemixIcon icon={icon} width={22} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography variant="subtitle2" sx={{ wordBreak: 'break-word' }}>
          {value}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {description}
        </Typography>
      </Box>
    </Box>
  );
}

function SchoolProfileSkeleton() {
  return (
    <Container maxWidth="lg" aria-label="กำลังโหลดข้อมูลโรงเรียน" sx={{ py: { xs: 4, md: 8 } }}>
      <Skeleton variant="rounded" height={176} sx={{ mb: 4, borderRadius: 2 }} />
      <Box
        sx={{
          gap: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '320px minmax(0, 1fr)' },
        }}
      >
        <Skeleton variant="rounded" height={390} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" height={390} sx={{ borderRadius: 2 }} />
      </Box>
    </Container>
  );
}
