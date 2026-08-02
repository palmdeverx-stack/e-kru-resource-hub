'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { RiCloseLine, RiExternalLinkLine } from 'src/components/remix-icon';

export type DocumentPreviewFile = {
  url: string;
  title: string;
  fileName?: string;
  mimeType?: string | null;
};

type Props = {
  file: DocumentPreviewFile | null;
  onClose: () => void;
};

const HASH_LIKE_FILE_NAME = /^[a-f\d]{24,}(?:\s+(?:copy|\(\d+\)))?$/i;

function getReadableFileName(file: DocumentPreviewFile) {
  if (!file.fileName) return null;

  const extensionIndex = file.fileName.lastIndexOf('.');
  const extension = extensionIndex >= 0 ? file.fileName.slice(extensionIndex) : '';
  const baseName = extensionIndex >= 0 ? file.fileName.slice(0, extensionIndex) : file.fileName;
  if (!HASH_LIKE_FILE_NAME.test(baseName.trim())) return file.fileName;

  const documentName = file.title.replace(/^ตัวอย่าง\s*/, '').trim() || 'เอกสารยืนยัน';
  return `${documentName}${extension.toLowerCase()}`;
}

export function DocumentPreviewDialog({ file, onClose }: Props) {
  const isPdf =
    file?.mimeType === 'application/pdf' || Boolean(file?.fileName?.toLowerCase().endsWith('.pdf'));
  const readableFileName = file ? getReadableFileName(file) : null;

  return (
    <Dialog
      fullWidth
      maxWidth="lg"
      open={Boolean(file)}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            m: { xs: 1, sm: 3 },
            width: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 48px)' },
            maxHeight: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 48px)' },
          },
        },
      }}
    >
      <DialogTitle sx={{ pr: 7 }}>
        <Typography variant="h6">{file?.title ?? 'ดูตัวอย่างเอกสาร'}</Typography>
        {!!readableFileName && (
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            ชื่อไฟล์: {readableFileName}
          </Typography>
        )}
        <IconButton
          aria-label="ปิดตัวอย่าง"
          onClick={onClose}
          sx={{ position: 'absolute', top: 12, right: 12 }}
        >
          <RiCloseLine />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{ p: { xs: 1, sm: 2 }, bgcolor: 'background.neutral', minHeight: '60vh' }}
      >
        {file &&
          (isPdf ? (
            <Box
              component="iframe"
              title={file.title}
              src={file.url}
              sx={{ width: 1, height: { xs: '68vh', md: '74vh' }, border: 0, bgcolor: 'white' }}
            />
          ) : (
            <Box
              component="img"
              src={file.url}
              alt={file.title}
              sx={{ width: 1, height: '70vh', display: 'block', objectFit: 'contain' }}
            />
          ))}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ปิด
        </Button>
        {!!file && (
          <Button
            component="a"
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<RiExternalLinkLine />}
          >
            เปิดในแท็บใหม่
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
