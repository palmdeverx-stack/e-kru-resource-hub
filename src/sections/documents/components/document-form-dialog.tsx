'use client';

import type { UserDocument } from '../document-actions';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { toast } from 'src/components/snackbar';

import { SCHOOL_DOCUMENT_TEMPLATES } from '../document-catalog';
import { createMyDocument, updateMyDocument } from '../document-actions';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  document?: UserDocument | null;
  onClose: () => void;
};

export function DocumentFormDialog({ open, document = null, onClose }: Props) {
  const queryClient = useQueryClient();
  const [templateSlug, setTemplateSlug] = useState('');
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');

  const mutation = useMutation({
    mutationFn: (params: { templateSlug: string; title: string; purpose?: string }) =>
      document ? updateMyDocument(document.id, params) : createMyDocument(params),
    onSuccess: async (savedDocument: UserDocument) => {
      await queryClient.invalidateQueries({ queryKey: ['my-documents'] });
      toast.success(
        document
          ? `แก้ไขเอกสาร “${savedDocument.title}” แล้ว`
          : `สร้างเอกสาร “${savedDocument.title}” แล้ว`
      );
      handleClose();
    },
  });

  useEffect(() => {
    if (!open) return;

    setTemplateSlug(document?.template_slug ?? '');
    setTitle(document?.title ?? '');
    setPurpose(document?.purpose ?? '');
  }, [document, open]);

  const handleClose = () => {
    if (mutation.isPending) return;
    setTemplateSlug('');
    setTitle('');
    setPurpose('');
    mutation.reset();
    onClose();
  };

  const handleTemplateChange = (slug: string) => {
    const template = SCHOOL_DOCUMENT_TEMPLATES.find((item) => item.slug === slug);
    setTemplateSlug(slug);
    setTitle((current) => current || template?.name || '');
  };

  const handleSubmit = () => {
    if (!templateSlug || !title.trim()) return;
    mutation.mutate({ templateSlug, title: title.trim(), purpose: purpose.trim() });
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Typography component="h2" variant="h6">
          {document ? 'แก้ไขเอกสาร' : 'สร้างเอกสาร'}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
          {document
            ? 'ปรับประเภท ชื่อ และรายละเอียดของเอกสารฉบับร่าง'
            : 'เลือกประเภทและระบุรายละเอียด เอกสารใหม่จะบันทึกเป็นฉบับร่าง'}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {mutation.error && (
          <Alert severity="error" sx={{ mb: 2.5 }}>
            {mutation.error.message}
          </Alert>
        )}
        <TextField
          select
          fullWidth
          required
          label="ประเภทเอกสาร"
          value={templateSlug}
          onChange={(event) => handleTemplateChange(event.target.value)}
        >
          {SCHOOL_DOCUMENT_TEMPLATES.map((template) => (
            <MenuItem key={template.slug} value={template.slug}>
              {template.code} — {template.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth
          required
          label="ชื่อเอกสาร"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 200 } }}
          sx={{ mt: 2.5 }}
        />
        <TextField
          fullWidth
          multiline
          minRows={3}
          label="วัตถุประสงค์ / หมายเหตุ"
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
          sx={{ mt: 2.5 }}
        />
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={handleClose} disabled={mutation.isPending}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          loading={mutation.isPending}
          disabled={!templateSlug || !title.trim()}
          onClick={handleSubmit}
        >
          {document ? 'บันทึกการแก้ไข' : 'สร้างเอกสาร'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
