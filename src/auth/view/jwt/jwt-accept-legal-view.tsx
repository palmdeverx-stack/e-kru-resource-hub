'use client';

import { useRef, useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useRouter } from 'src/routes/hooks';

import { Markdown } from 'src/components/markdown';
import { RemixIcon } from 'src/components/remix-icon';

import { useAuthContext } from '../../hooks';
import { getErrorMessage } from '../../utils';
import { FormHead } from '../../components/form-head';
import { signOut, acceptLegal } from '../../context/jwt';
import { getHomePathForRole } from '../../utils/role-home-path';

// ----------------------------------------------------------------------

type Props = {
  termsOfService: string;
  privacyPolicy: string;
};

const MARKDOWN_SX = {
  '& h1': { mb: 1.5 },
  '& h2': { mt: 4, scrollMarginTop: 96 },
  '& blockquote': {
    m: 0,
    mt: 3,
    px: 2.5,
    py: 1,
    borderRadius: 1.5,
    color: 'warning.darker',
    bgcolor: 'warning.lighter',
    borderLeftColor: 'warning.main',
  },
  '& table': { minWidth: 480 },
} as const;

const SCROLL_BOTTOM_THRESHOLD = 24;

export function JwtAcceptLegalView({ termsOfService, privacyPolicy }: Props) {
  const router = useRouter();
  const { user, checkUserSession } = useAuthContext();

  const scrollBoxRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'terms' | 'privacy'>('terms');
  const [agreed, setAgreed] = useState(false);
  const [readTerms, setReadTerms] = useState(false);
  const [readPrivacy, setReadPrivacy] = useState(false);
  const hasReadBoth = readTerms && readPrivacy;

  const markReadIfAtBottom = (el: HTMLDivElement) => {
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BOTTOM_THRESHOLD;
    if (!atBottom) return;
    if (tab === 'terms') setReadTerms(true);
    else setReadPrivacy(true);
  };

  useEffect(() => {
    const el = scrollBoxRef.current;
    if (!el) return;
    el.scrollTop = 0;
    // Content shorter than the box (nothing to scroll) counts as read immediately.
    markReadIfAtBottom(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const acceptMutation = useMutation({
    mutationFn: acceptLegal,
    onSuccess: async () => {
      await checkUserSession?.();
      router.replace(getHomePathForRole(user?.role));
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      await signOut();
      await checkUserSession?.();
    },
  });

  const errorMessage = acceptMutation.error ? getErrorMessage(acceptMutation.error) : null;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <FormHead
        title="ยอมรับข้อกำหนดการใช้บริการและนโยบายความเป็นส่วนตัว"
        description="กรุณาอ่านและยอมรับก่อนเข้าใช้งานระบบ"
      />

      {!!errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 3 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 2 }}>
          <Tab
            value="terms"
            label="ข้อกำหนดการใช้บริการ"
            icon={
              readTerms ? (
                <RemixIcon icon="solar:check-circle-bold" width={16} sx={{ color: 'success.main' }} />
              ) : undefined
            }
            iconPosition="end"
          />
          <Tab
            value="privacy"
            label="นโยบายความเป็นส่วนตัว"
            icon={
              readPrivacy ? (
                <RemixIcon icon="solar:check-circle-bold" width={16} sx={{ color: 'success.main' }} />
              ) : undefined
            }
            iconPosition="end"
          />
        </Tabs>

        <Box
          ref={scrollBoxRef}
          onScroll={(event) => markReadIfAtBottom(event.currentTarget)}
          sx={{
            p: { xs: 2.5, sm: 4 },
            maxHeight: 420,
            overflowY: 'auto',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Markdown sx={MARKDOWN_SX}>{tab === 'terms' ? termsOfService : privacyPolicy}</Markdown>
        </Box>
      </Paper>

      <Box sx={{ mt: 3 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={agreed}
              disabled={!hasReadBoth}
              onChange={(event) => setAgreed(event.target.checked)}
            />
          }
          label="ข้าพเจ้าได้อ่านและยอมรับข้อกำหนดการใช้บริการและนโยบายความเป็นส่วนตัวข้างต้น"
        />
        {!hasReadBoth && (
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            กรุณาเลื่อนอ่านข้อความจนจบทั้งข้อกำหนดการใช้บริการและนโยบายความเป็นส่วนตัวก่อน
            จึงจะติ๊กยอมรับได้
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          mt: 2,
          gap: 1.5,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'flex-end',
        }}
      >
        <Button
          color="inherit"
          loading={signOutMutation.isPending}
          onClick={() => signOutMutation.mutate()}
        >
          ออกจากระบบ
        </Button>
        <Button
          variant="contained"
          disabled={!agreed}
          loading={acceptMutation.isPending}
          onClick={() => acceptMutation.mutate()}
        >
          ยอมรับและเข้าใช้งาน
        </Button>
      </Box>
    </Container>
  );
}
