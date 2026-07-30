'use client';

import type { LegalDocumentType, MarketplaceLegalDocument } from '../types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import useMediaQuery from '@mui/material/useMediaQuery';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { Editor } from 'src/components/editor';
import { editorClasses } from 'src/components/editor/classes';
import { RiCloseLine, RiExternalLinkLine } from 'src/components/remix-icon';

type Props = {
  open: boolean;
  documentType: LegalDocumentType | null;
  fallbackTitle: string;
  fullPageHref: string;
  onClose: () => void;
};

export function MarketplaceLegalDocumentDialog({
  open,
  documentType,
  fallbackTitle,
  fullPageHref,
  onClose,
}: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [document, setDocument] = useState<MarketplaceLegalDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !documentType) return undefined;

    const controller = new AbortController();
    setDocument(null);
    setError('');
    setLoading(true);

    fetch('/api/marketplace/legal-documents', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as {
          items?: MarketplaceLegalDocument[];
          message?: string;
        };
        if (!response.ok) throw new Error(result.message ?? 'โหลดเอกสารไม่สำเร็จ');
        setDocument(result.items?.find((item) => item.document_type === documentType) ?? null);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'โหลดเอกสารไม่สำเร็จ');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [documentType, open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      aria-labelledby="marketplace-legal-dialog-title"
      slotProps={{
        paper: {
          sx: {
            m: { xs: 0, sm: 3 },
            height: { xs: '100dvh', sm: 'min(86vh, 820px)' },
            maxHeight: { xs: 'none', sm: 'calc(100% - 48px)' },
            borderRadius: { xs: 0, sm: 3 },
          },
        },
      }}
    >
      <DialogTitle
        id="marketplace-legal-dialog-title"
        sx={{
          py: { xs: 1.5, sm: 2 },
          pr: 7,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography component="span" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
          {document?.title ?? fallbackTitle}
        </Typography>
        {document && (
          <Chip
            size="small"
            variant="soft"
            color="primary"
            label={`เวอร์ชัน ${document.version}`}
            sx={{ ml: 1, verticalAlign: 'middle' }}
          />
        )}
        <IconButton
          aria-label="ปิดเอกสาร"
          onClick={onClose}
          sx={{ top: { xs: 8, sm: 12 }, right: { xs: 8, sm: 12 }, position: 'absolute' }}
        >
          <RiCloseLine />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers={false}
        sx={{
          px: { xs: 2, sm: 4 },
          py: { xs: 2.5, sm: 3 },
          mt: 2,
          overscrollBehavior: 'contain',
        }}
      >
        {loading ? (
          <Box sx={{ minHeight: 280, display: 'grid', placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !document ? (
          <Alert severity="info">
            เอกสารนี้อยู่ระหว่างการจัดทำ สามารถเปิดหน้ารายละเอียดฉบับเต็มเพื่อตรวจสอบเพิ่มเติมได้
          </Alert>
        ) : (
          <>
            {document.summary && (
              <Alert severity="info" sx={{ mb: 3, lineHeight: 1.7 }}>
                {document.summary}
              </Alert>
            )}
            <Editor
              key={document.id}
              editable={false}
              value={document.content_html}
              sx={{
                minHeight: 0,
                border: 0,
                opacity: '1 !important',
                [`.${editorClasses.toolbar.root}`]: { display: 'none' },
                [`.${editorClasses.content.root}`]: {
                  overflow: 'visible',
                  bgcolor: 'transparent',
                  '& .tiptap.ProseMirror': {
                    px: 0,
                    fontSize: { xs: 15, sm: 16 },
                    lineHeight: 1.85,
                    overflowWrap: 'anywhere',
                    '& img': { maxWidth: 1, height: 'auto' },
                    '& table': {
                      width: 1,
                      display: 'block',
                      overflowX: 'auto',
                      whiteSpace: 'nowrap',
                    },
                  },
                },
              }}
            />
          </>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          gap: 1,
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, sm: 2 },
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Button
          component="a"
          href={fullPageHref}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<RiExternalLinkLine />}
          sx={{ mr: 'auto' }}
        >
          เปิดหน้าเต็ม
        </Button>
        <Button variant="contained" onClick={onClose}>
          อ่านเรียบร้อย
        </Button>
      </DialogActions>
    </Dialog>
  );
}
