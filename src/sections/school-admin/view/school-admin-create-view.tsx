'use client';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { createUser } from 'src/sections/user/user-actions';
import { listSchools } from 'src/sections/school/school-actions';

// ----------------------------------------------------------------------

export const SchoolAdminCreateSchema = z.object({
  firstName: z.string().trim().min(1, { error: 'กรุณากรอกชื่อ!' }),
  lastName: z.string().trim().min(1, { error: 'กรุณากรอกนามสกุล!' }),
  username: z.string().trim().min(1, { error: 'กรุณากรอกชื่อผู้ใช้งาน!' }),
  email: z.union([z.literal(''), z.email({ error: 'อีเมลไม่ถูกต้อง!' })]),
  password: z.string().min(6, { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร!' }),
  schoolId: z.string().min(1, { error: 'กรุณาเลือกโรงเรียน!' }),
});

// ----------------------------------------------------------------------

export function SchoolAdminCreateView() {
  const router = useRouter();
  const {
    data: schools = [],
    isLoading: isLoadingSchools,
    isError: isSchoolsError,
  } = useQuery({
    queryKey: ['schools'],
    queryFn: listSchools,
  });

  const methods = useForm({
    resolver: zodResolver(SchoolAdminCreateSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      password: '',
      schoolId: '',
    },
  });
  const { handleSubmit } = methods;

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => router.push(paths.master.schoolAdmin.root),
  });

  const onSubmit = handleSubmit((data) =>
    createMutation.mutate({
      ...data,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      username: data.username.trim(),
      email: data.email || undefined,
      role: 'school_admin',
    })
  );

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Button
        component={RouterLink}
        href={paths.master.schoolAdmin.root}
        color="inherit"
        startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        sx={{ mb: 2 }}
      >
        กลับไปหน้ารายการ
      </Button>
      <Box sx={{ mb: 4 }}>
        <Typography component="h1" variant="h3">
          เพิ่มผู้ดูแลโรงเรียน
        </Typography>
        <Typography sx={{ mt: 1, color: 'text.secondary' }}>
          สร้างบัญชีและกำหนดโรงเรียนที่รับผิดชอบ
        </Typography>
      </Box>
      <Box
        sx={{
          gap: 3,
          display: 'grid',
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' },
        }}
      >
        <Card variant="outlined">
          <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  display: 'grid',
                  borderRadius: 1.5,
                  placeItems: 'center',
                  color: 'primary.main',
                  bgcolor: 'primary.lighter',
                }}
              >
                <RemixIcon icon="solar:user-plus-bold" width={24} />
              </Box>
              <Box>
                <Typography variant="h6">ข้อมูลบัญชีผู้ดูแล</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  ข้อมูลสำหรับเข้าสู่ระบบและระบุตัวตน
                </Typography>
              </Box>
            </Box>
          </Box>
          <Divider />
          <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
            {createMutation.error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {createMutation.error.message}
              </Alert>
            )}
            {isSchoolsError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                ไม่สามารถโหลดรายชื่อโรงเรียนได้
              </Alert>
            )}
            {!isLoadingSchools && !schools.length && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                ต้องเพิ่มโรงเรียนก่อนสร้างบัญชีผู้ดูแล
              </Alert>
            )}
            <Form methods={methods} onSubmit={onSubmit}>
              <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
                <Field.Select
                  name="schoolId"
                  label="โรงเรียนที่รับผิดชอบ"
                  disabled={isLoadingSchools || !schools.length}
                >
                  {schools
                    .filter((school) => school.is_active)
                    .map((school) => (
                      <MenuItem key={school.id} value={school.id}>
                        {school.name} · {school.code}
                      </MenuItem>
                    ))}
                </Field.Select>
                <Box
                  sx={{
                    gap: 2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                  }}
                >
                  <Field.Text name="firstName" label="ชื่อ" />
                  <Field.Text name="lastName" label="นามสกุล" />
                </Box>
                <Divider>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    ข้อมูลเข้าสู่ระบบ
                  </Typography>
                </Divider>
                <Field.Text
                  name="username"
                  label="ชื่อผู้ใช้งาน"
                  placeholder="เช่น admin.school"
                  helperText="ใช้สำหรับเข้าสู่ระบบและต้องไม่ซ้ำกับบัญชีอื่น"
                />
                <Field.Text name="email" label="อีเมล (ไม่บังคับ)" type="email" />
                <Field.Text
                  name="password"
                  label="รหัสผ่านชั่วคราว"
                  type="password"
                  helperText="อย่างน้อย 6 ตัวอักษร ผู้ใช้จะต้องเปลี่ยนเมื่อเข้าสู่ระบบครั้งแรก"
                />
                <Box sx={{ gap: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    component={RouterLink}
                    href={paths.master.schoolAdmin.root}
                    color="inherit"
                    disabled={createMutation.isPending}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    loading={createMutation.isPending}
                    disabled={!schools.length}
                    startIcon={<RemixIcon icon="solar:user-plus-bold" />}
                  >
                    สร้างบัญชีผู้ดูแล
                  </Button>
                </Box>
              </Box>
            </Form>
          </Box>
        </Card>

        <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
          <Card variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6">สิทธิ์ของผู้ดูแล</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, mb: 2.5, color: 'text.secondary' }}>
              บัญชีนี้จะจัดการข้อมูลภายในโรงเรียนที่เลือกเท่านั้น
            </Typography>
            {[
              'ข้อมูลโรงเรียนและปีการศึกษา',
              'ครู นักเรียน และห้องเรียน',
              'รายวิชา การลงทะเบียน และคะแนน',
            ].map((label) => (
              <Box key={label} sx={{ gap: 1, mb: 1.5, display: 'flex', alignItems: 'center' }}>
                <RemixIcon icon="solar:check-circle-bold" width={19} sx={{ color: 'success.main' }} />
                <Typography variant="body2">{label}</Typography>
              </Box>
            ))}
          </Card>
          <Alert severity="info" icon={<RemixIcon icon="solar:shield-check-bold" />}>
            บัญชีผู้ดูแลไม่สามารถเข้าถึงข้อมูลของโรงเรียนอื่นได้
          </Alert>
        </Box>
      </Box>
    </Container>
  );
}
