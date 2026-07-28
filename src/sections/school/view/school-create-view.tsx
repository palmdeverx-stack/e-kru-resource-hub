'use client';

import type { CreateSchoolResult } from '../school-actions';

import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { toast } from 'src/components/snackbar';
import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { createSchool } from '../school-actions';

// ----------------------------------------------------------------------

export type SchoolCreateSchemaType = z.infer<typeof SchoolCreateSchema>;

export const SchoolCreateSchema = z.object({
  name: z.string().trim().min(1, { error: 'กรุณากรอกชื่อโรงเรียนภาษาไทย!' }),
  nameEn: z.string().trim(),
  code: z
    .string()
    .trim()
    .regex(/^\d{8}$/, { error: 'รหัสโรงเรียนต้องเป็นตัวเลข 8 หลัก' }),
  email: z.email({ error: 'กรุณากรอกอีเมลโรงเรียนให้ถูกต้อง' }),
});

// ----------------------------------------------------------------------

export function SchoolCreateView() {
  const router = useRouter();
  const [result, setResult] = useState<CreateSchoolResult | null>(null);

  const methods = useForm({
    resolver: zodResolver(SchoolCreateSchema),
    defaultValues: { name: '', nameEn: '', code: '', email: '' },
  });
  const { handleSubmit } = methods;

  const createSchoolMutation = useMutation({
    mutationFn: createSchool,
    onSuccess: (data) => setResult(data),
  });

  const onSubmit = handleSubmit((data) =>
    createSchoolMutation.mutate({
      name: data.name.trim(),
      nameEn: data.nameEn.trim() || undefined,
      code: data.code.trim(),
      email: data.email.trim(),
    })
  );

  const closeResultDialog = () => {
    setResult(null);
    router.push(paths.master.school.root);
  };

  const copyPassword = async () => {
    if (!result?.adminPassword) return;
    await navigator.clipboard.writeText(result.adminPassword);
    toast.success('คัดลอกรหัสผ่านแล้ว');
  };

  return (
    <Container maxWidth={false} sx={{ pb: 5 }}>
      <Button
        component={RouterLink}
        href={paths.master.school.root}
        color="inherit"
        startIcon={<RemixIcon icon="eva:arrow-ios-back-fill" />}
        sx={{ mb: 2 }}
      >
        กลับไปหน้ารายการ
      </Button>
      <Box sx={{ mb: 4 }}>
        <Typography component="h1" variant="h3">
          เพิ่มโรงเรียนใหม่
        </Typography>
        <Typography sx={{ mt: 1, color: 'text.secondary' }}>
          สร้างพื้นที่สำหรับโรงเรียนใหม่ในระบบ
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
                <RemixIcon icon="solar:home-angle-bold-duotone" width={24} />
              </Box>
              <Box>
                <Typography variant="h6">ข้อมูลโรงเรียน</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  กรอกข้อมูลพื้นฐานที่ใช้แสดงในระบบ
                </Typography>
              </Box>
            </Box>
          </Box>
          <Divider />
          <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
            {createSchoolMutation.error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {createSchoolMutation.error.message}
              </Alert>
            )}
            <Form methods={methods} onSubmit={onSubmit}>
              <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
                <Field.Text
                  name="name"
                  label="ชื่อโรงเรียนภาษาไทย *"
                  placeholder="เช่น โรงเรียนตัวอย่างวิทยา"
                  helperText="ชื่อหลักที่ต้องการให้แสดงบนหน้าระบบ"
                />
                <Field.Text
                  name="nameEn"
                  label="ชื่อโรงเรียนภาษาอังกฤษ"
                  placeholder="e.g. Example Wittaya School"
                  helperText="ไม่บังคับ"
                  slotProps={{ htmlInput: { lang: 'en' } }}
                />
                <Field.Text
                  name="code"
                  label="รหัสโรงเรียน"
                  placeholder="เช่น 12345678"
                  helperText="ตัวเลข 8 หลัก ใช้เป็น PIN สำหรับผู้ดูแลโรงเรียน"
                  slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 8 } }}
                />
                <Field.Text
                  name="email"
                  label="อีเมลโรงเรียน"
                  type="email"
                  placeholder="เช่น school@example.ac.th"
                  helperText="ใช้ส่งคำเชิญพร้อมบัญชีผู้ดูแลโรงเรียนให้ทันทีที่สร้างเสร็จ"
                />
                <Box sx={{ gap: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    component={RouterLink}
                    href={paths.master.school.root}
                    color="inherit"
                    disabled={createSchoolMutation.isPending}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    loading={createSchoolMutation.isPending}
                    startIcon={<RemixIcon icon="solar:file-text-bold" />}
                  >
                    บันทึกโรงเรียน
                  </Button>
                </Box>
              </Box>
            </Form>
          </Box>
        </Card>

        <Card variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6">เกิดอะไรขึ้นต่อจากนี้</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, mb: 2.5, color: 'text.secondary' }}>
            ทำอัตโนมัติทันทีที่บันทึกโรงเรียนสำเร็จ
          </Typography>
          {[
            { label: 'สร้างบัญชีผู้ดูแลโรงเรียนให้อัตโนมัติ', icon: 'solar:user-plus-bold' as const },
            {
              label: 'ส่งอีเมลเชิญพร้อมชื่อผู้ใช้งานและรหัสผ่านชั่วคราว',
              icon: 'solar:letter-bold-duotone' as const,
            },
            {
              label: 'ผู้ดูแลโรงเรียนเข้าสู่ระบบและเริ่มเพิ่มครู/นักเรียนเอง',
              icon: 'solar:users-group-rounded-bold-duotone' as const,
            },
          ].map((item, index) => (
            <Box key={item.label} sx={{ gap: 1.25, mb: 2, display: 'flex', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  display: 'grid',
                  borderRadius: '50%',
                  placeItems: 'center',
                  color: 'primary.main',
                  bgcolor: 'primary.lighter',
                }}
              >
                <RemixIcon icon={item.icon} width={17} />
              </Box>
              <Box>
                <Typography variant="subtitle2">{item.label}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  ขั้นตอนที่ {index + 1}
                </Typography>
              </Box>
            </Box>
          ))}
          <Alert severity="info" sx={{ mt: 2 }}>
            สถานะเริ่มต้นของโรงเรียนจะเป็น “เปิดใช้งาน”
          </Alert>
        </Card>
      </Box>

      <Dialog open={!!result} onClose={closeResultDialog} maxWidth="xs" fullWidth>
        <DialogTitle>
          {result?.emailSent ? 'ส่งคำเชิญเรียบร้อย' : 'สร้างโรงเรียนสำเร็จ'}
        </DialogTitle>
        <DialogContent>
          {result?.adminCreated === false ? (
            <Alert severity="warning">{result.message}</Alert>
          ) : result?.emailSent ? (
            <Alert severity="success">
              ส่งอีเมลเชิญพร้อมชื่อผู้ใช้งานและรหัสผ่านไปที่อีเมลโรงเรียนแล้ว
            </Alert>
          ) : (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                สร้างบัญชีผู้ดูแลโรงเรียนสำเร็จ แต่ส่งอีเมลเชิญไม่สำเร็จ — กรุณาคัดลอกข้อมูลด้านล่างไปส่งให้โรงเรียนเอง
              </Alert>
              <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}>
                <TextField
                  label="ชื่อผู้ใช้งาน"
                  value={result?.adminUsername ?? ''}
                  slotProps={{ input: { readOnly: true } }}
                  fullWidth
                />
                <TextField
                  label="รหัสผ่านชั่วคราว"
                  value={result?.adminPassword ?? ''}
                  slotProps={{
                    input: {
                      readOnly: true,
                      endAdornment: (
                        <Button size="small" onClick={copyPassword}>
                          คัดลอก
                        </Button>
                      ),
                    },
                  }}
                  fullWidth
                />
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={closeResultDialog}>
            ไปที่รายการโรงเรียน
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
