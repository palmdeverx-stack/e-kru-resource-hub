'use client';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { Form, Field } from 'src/components/hook-form';

import { createUser } from '../user-actions';

// ----------------------------------------------------------------------

export const UserCreateSchema = z.object({
  firstName: z.string().min(1, { error: 'กรุณากรอกชื่อภาษาไทย!' }),
  lastName: z.string().min(1, { error: 'กรุณากรอกนามสกุลภาษาไทย!' }),
  firstNameEn: z.string(),
  lastNameEn: z.string(),
  username: z.string().min(1, { error: 'กรุณากรอกชื่อผู้ใช้งาน!' }),
  email: z.union([z.literal(''), z.email({ error: 'อีเมลไม่ถูกต้อง!' })]),
  password: z.string().min(6, { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร!' }),
  role: z.enum(['teacher', 'student']),
});

// ----------------------------------------------------------------------

export function UserCreateView() {
  const router = useRouter();

  const methods = useForm({
    resolver: zodResolver(UserCreateSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      firstNameEn: '',
      lastNameEn: '',
      username: '',
      email: '',
      password: '',
      role: 'student' as const,
    },
  });

  const { handleSubmit } = methods;

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => router.push(paths.admin.user.root),
  });

  const onSubmit = handleSubmit(async (data) => {
    createUserMutation.mutate({ ...data, email: data.email || undefined });
  });

  return (
    <Container sx={{ py: 10 }}>
      <Typography variant="h3" sx={{ mb: 5 }}>
        เพิ่มผู้ใช้งาน
      </Typography>

      <Card sx={{ p: 3, maxWidth: 480 }}>
        {createUserMutation.error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {createUserMutation.error.message}
          </Alert>
        )}

        <Form methods={methods} onSubmit={onSubmit}>
          <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{
                gap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              <Field.Text name="firstName" label="ชื่อภาษาไทย *" />
              <Field.Text name="lastName" label="นามสกุลภาษาไทย *" />
              <Field.Text name="firstNameEn" label="ชื่อภาษาอังกฤษ" />
              <Field.Text name="lastNameEn" label="นามสกุลภาษาอังกฤษ" />
            </Box>

            <Field.Text name="username" label="ชื่อผู้ใช้งาน" />
            <Field.Text name="email" label="อีเมล (ไม่บังคับ)" />
            <Field.Text name="password" label="รหัสผ่าน" type="password" />

            <Field.Select name="role" label="บทบาท">
              <MenuItem value="student">นักเรียน</MenuItem>
              <MenuItem value="teacher">ครู</MenuItem>
            </Field.Select>

            <Button
              type="submit"
              variant="contained"
              size="large"
              loading={createUserMutation.isPending}
            >
              เพิ่มผู้ใช้งาน
            </Button>
          </Box>
        </Form>
      </Card>
    </Container>
  );
}
