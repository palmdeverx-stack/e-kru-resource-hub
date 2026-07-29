'use client';

import type { BoxProps } from '@mui/material/Box';
import type {
  LegalDocumentType,
  MarketplaceLegalDocument,
} from 'src/sections/marketplace/legal/types';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { useTranslate } from 'src/locales';

import { Editor } from 'src/components/editor';
import { editorClasses } from 'src/components/editor/classes';
import { RiCloseLine, RiShieldCheckLine } from 'src/components/remix-icon';

export function SignUpTerms({ sx, ...other }: BoxProps) {
  const { t } = useTranslate();
  const [documentType, setDocumentType] = useState<LegalDocumentType | null>(null);
  const [document, setDocument] = useState<MarketplaceLegalDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!documentType) return undefined;

    const controller = new AbortController();
    setLoading(true);
    setError('');
    setDocument(null);

    fetch('/api/marketplace/legal-documents', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? t('auth.legal.loadingError'));
        setDocument(
          (result.items as MarketplaceLegalDocument[]).find(
            (item) => item.document_type === documentType
          ) ?? null
        );
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : t('auth.legal.loadingError'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [documentType, t]);

  const closeDialog = () => setDocumentType(null);

  const renderDocumentLink = (type: LegalDocumentType, label: string) => (
    <Link
      component="button"
      type="button"
      underline="always"
      color="text.primary"
      onClick={() => setDocumentType(type)}
      sx={{ font: 'inherit', fontWeight: 600, verticalAlign: 'baseline' }}
    >
      {label}
    </Link>
  );

  return (
    <>
      <Box
        component="span"
        sx={[
          () => ({
            mt: 3,
            display: 'block',
            textAlign: 'center',
            typography: 'caption',
            color: 'text.secondary',
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...other}
      >
        {t('auth.legal.agreementPrefix')}{' '}
        {renderDocumentLink('terms_of_service', t('auth.legal.terms'))} {t('auth.legal.and')}{' '}
        {renderDocumentLink('privacy_policy', t('auth.legal.privacy'))}.
      </Box>

      <Dialog
        fullWidth
        scroll="paper"
        maxWidth="md"
        open={documentType !== null}
        onClose={closeDialog}
        slotProps={{
          paper: {
            sx: {
              borderRadius: { xs: 0, sm: 3 },
              height: { xs: '100%', sm: 'min(760px, calc(100% - 64px))' },
              m: { xs: 0, sm: 2 },
            },
          },
        }}
      >
        <DialogTitle sx={{ pr: 7 }}>
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                display: 'grid',
                flexShrink: 0,
                borderRadius: 1.5,
                placeItems: 'center',
                color: 'primary.main',
                bgcolor: 'primary.lighter',
              }}
            >
              <RiShieldCheckLine size={21} />
            </Box>
            <Box>
              <Typography variant="h6">
                {document?.title ??
                  (documentType === 'terms_of_service'
                    ? t('auth.legal.terms')
                    : documentType === 'privacy_policy'
                      ? t('auth.legal.privacy')
                      : t('auth.legal.document'))}
              </Typography>
              {document && (
                <Typography variant="caption" color="text.secondary">
                  {t('auth.legal.version', { version: document.version })}
                </Typography>
              )}
            </Box>
          </Box>
          <IconButton
            aria-label={t('auth.legal.closeDocument')}
            onClick={closeDialog}
            sx={{ position: 'absolute', top: 14, right: 14 }}
          >
            <RiCloseLine size={22} />
          </IconButton>
        </DialogTitle>

        <Divider />
        <DialogContent dividers={false} sx={{ py: 3 }}>
          {loading ? (
            <Box sx={{ minHeight: 280, display: 'grid', placeItems: 'center' }}>
              <CircularProgress size={32} />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : !document ? (
            <Alert severity="info">{t('auth.legal.unavailable')}</Alert>
          ) : (
            <>
              {document.summary && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  {document.summary}
                </Alert>
              )}
              <Editor
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
                    '& .tiptap.ProseMirror': { px: 0 },
                  },
                }}
              />
            </>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="contained" onClick={closeDialog}>
            {t('actions.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
