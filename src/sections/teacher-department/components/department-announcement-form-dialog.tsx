'use client';

import * as z from 'zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { toast } from 'src/components/snackbar';
import { RemixIcon } from 'src/components/remix-icon';
import { Form, Field } from 'src/components/hook-form';

import { createDepartmentAnnouncement } from '../teacher-department-actions';

// ----------------------------------------------------------------------

const FormSchema = z.object({
  title: z.string().trim().min(1, { error: 'กรุณากรอกหัวข้อประกาศ!' }),
  content: z.string().trim().min(1, { error: 'กรุณากรอกรายละเอียดประกาศ!' }),
});

type Props = { open: boolean; onClose: () => void };

export function DepartmentAnnouncementFormDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const methods = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: { title: '', content: '' },
  });

  const createMutation = useMutation({
    mutationFn: createDepartmentAnnouncement,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['department-announcements'] });
      toast.success('เผยแพร่ประกาศฝ่ายเรียบร้อยแล้ว');
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;
    createMutation.reset();
    methods.reset({ title: '', content: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = methods.handleSubmit((values) => createMutation.mutate(values));

  return (
    <Dialog open={open} onClose={createMutation.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6">สร้างประกาศฝ่าย</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                ประกาศจะแสดงให้สมาชิกในฝ่ายเห็นเท่านั้น
              </Typography>
            </Box>
            <IconButton onClick={onClose} disabled={createMutation.isPending} aria-label="ปิดหน้าต่าง">
              <RemixIcon icon="mingcute:close-line" />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {createMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {createMutation.error.message}
            </Alert>
          )}
          <Box sx={{ gap: 2.5, display: 'flex', flexDirection: 'column' }}>
            <Field.Text name="title" label="หัวข้อประกาศ *" />
            <Field.Text name="content" label="รายละเอียด *" multiline minRows={4} />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button color="inherit" onClick={onClose} disabled={createMutation.isPending}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="contained" loading={createMutation.isPending}>
            เผยแพร่ประกาศ
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
