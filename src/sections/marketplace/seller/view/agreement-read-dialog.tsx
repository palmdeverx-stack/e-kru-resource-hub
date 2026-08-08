'use client';

import type { MarketplaceLegalDocument } from '../../legal/types';
import type { Agreement, AgreementKey } from './seller-setup-view';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Editor } from 'src/components/editor';
import { editorClasses } from 'src/components/editor/classes';

type Props = {
  agreement: Agreement | null;
  document: MarketplaceLegalDocument | null;
  onClose: () => void;
  onRead: (key: AgreementKey) => void;
};

export function AgreementReadDialog({ agreement, document, onClose, onRead }: Props) {
  const [reachedEnd, setReachedEnd] = useState(false);

  useEffect(() => {
    setReachedEnd(false);
  }, [agreement]);

  return (
    <Dialog open={Boolean(agreement)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{document?.title ?? 'เอกสารข้อตกลง'}</DialogTitle>
      <DialogContent dividers>
        <Box
          onScroll={(event) => {
            const element = event.currentTarget;
            if (element.scrollTop + element.clientHeight >= element.scrollHeight - 8) {
              setReachedEnd(true);
            }
          }}
          sx={{
            pr: 2,
            maxHeight: { xs: 380, sm: 440 },
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          {document ? (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                เอกสารฉบับเผยแพร่ เวอร์ชัน {document.version}
              </Alert>
              {document.summary && (
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  {document.summary}
                </Typography>
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
          ) : (
            <Alert severity="error">
              ไม่พบเอกสารฉบับเผยแพร่ กรุณาให้ผู้ดูแลเผยแพร่เอกสารฉบับสมบูรณ์
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ปิด
        </Button>
        <Button
          variant="contained"
          disabled={!reachedEnd || !agreement || !document}
          onClick={() => agreement && onRead(agreement.key)}
        >
          ยืนยันว่าอ่านครบแล้ว
        </Button>
      </DialogActions>
    </Dialog>
  );
}
