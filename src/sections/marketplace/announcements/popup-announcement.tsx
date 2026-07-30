'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { RiCloseLine, RiExternalLinkLine } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

type PopupAnnouncement = {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  link_url: string | null;
  button_label: string | null;
  updated_at: string;
};

function dismissalKey(item: PopupAnnouncement) {
  return `ekru_popup_dismissed:${item.id}:${item.updated_at}`;
}

export function MarketplacePopupAnnouncement() {
  const { user } = useAuthContext();
  const [item, setItem] = useState<PopupAnnouncement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/marketplace/announcements', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return { items: [] };
        return response.json() as Promise<{ items?: PopupAnnouncement[] }>;
      })
      .then((result) => {
        const firstUndismissed = (result.items ?? []).find(
          (announcement) => !window.localStorage.getItem(dismissalKey(announcement))
        );
        setItem(firstUndismissed ?? null);
      })
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') setItem(null);
      });
    return () => controller.abort();
  }, [user?.id]);

  const close = () => {
    if (item) window.localStorage.setItem(dismissalKey(item), new Date().toISOString());
    setItem(null);
  };

  return (
    <Dialog
      open={Boolean(item)}
      onClose={close}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { overflow: 'hidden', borderRadius: 3 } } }}
    >
      {item && (
        <>
          <IconButton
            aria-label="ปิดประกาศ"
            onClick={close}
            sx={{
              top: 12,
              right: 12,
              zIndex: 1,
              position: 'absolute',
              color: item.image_url ? 'common.white' : 'text.primary',
              bgcolor: item.image_url ? 'rgba(0,0,0,0.45)' : 'action.hover',
              '&:hover': {
                bgcolor: item.image_url ? 'rgba(0,0,0,0.65)' : 'action.selected',
              },
            }}
          >
            <RiCloseLine />
          </IconButton>
          {item.image_url && (
            <Box
              component="img"
              src={item.image_url}
              alt={item.title}
              sx={{ width: 1, maxHeight: 340, display: 'block', objectFit: 'cover' }}
            />
          )}
          <DialogContent sx={{ px: { xs: 2.5, sm: 4 }, pt: 3.5, pb: 2 }}>
            <Typography component="h2" variant="h4">
              {item.title}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1.5, whiteSpace: 'pre-line' }}>
              {item.message}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: { xs: 2.5, sm: 4 }, pb: 3, pt: 1 }}>
            <Button color="inherit" onClick={close}>
              ปิด
            </Button>
            {item.link_url && (
              <Button
                component="a"
                href={item.link_url}
                target={item.link_url.startsWith('/') ? undefined : '_blank'}
                rel={item.link_url.startsWith('/') ? undefined : 'noopener noreferrer'}
                variant="contained"
                endIcon={<RiExternalLinkLine />}
                onClick={close}
              >
                {item.button_label || 'ดูรายละเอียด'}
              </Button>
            )}
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
