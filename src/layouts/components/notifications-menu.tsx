'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Badge from '@mui/material/Badge';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { useRouter } from 'src/routes/hooks';

import { RiNotification3Line } from 'src/components/remix-icon';

// ----------------------------------------------------------------------

type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

async function fetchNotifications(): Promise<{
  notifications: AppNotification[];
  unreadCount: number;
}> {
  const response = await fetch('/api/notifications');
  if (!response.ok) return { notifications: [], unreadCount: 0 };
  return response.json();
}

async function markRead(ids?: string[]) {
  await fetch('/api/notifications/mark-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'เมื่อสักครู่';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hours / 24)} วันที่แล้ว`;
}

export function NotificationsMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const markAllReadMutation = useMutation({
    mutationFn: () => markRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOneReadMutation = useMutation({
    mutationFn: (id: string) => markRead([id]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleClick = (notification: AppNotification) => {
    setAnchorEl(null);
    if (!notification.read_at) markOneReadMutation.mutate(notification.id);
    if (notification.link) router.push(notification.link);
  };

  return (
    <>
      <IconButton aria-label="การแจ้งเตือน" onClick={(event) => setAnchorEl(event.currentTarget)}>
        <Badge badgeContent={unreadCount} color="error">
          <RiNotification3Line size={22} />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { width: 360, maxHeight: 440 } } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1">การแจ้งเตือน</Typography>
          {!!unreadCount && (
            <Typography
              variant="caption"
              sx={{ color: 'primary.main', cursor: 'pointer' }}
              onClick={() => markAllReadMutation.mutate()}
            >
              อ่านทั้งหมด
            </Typography>
          )}
        </Box>
        <Divider />

        {!notifications.length && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              ไม่มีการแจ้งเตือน
            </Typography>
          </Box>
        )}

        {notifications.map((notification) => (
          <MenuItem
            key={notification.id}
            onClick={() => handleClick(notification)}
            sx={{
              py: 1.25,
              whiteSpace: 'normal',
              alignItems: 'flex-start',
              bgcolor: notification.read_at ? 'transparent' : 'action.hover',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2">{notification.title}</Typography>
              {notification.body && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {notification.body}
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {timeAgo(notification.created_at)}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
