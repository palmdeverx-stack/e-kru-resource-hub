"use client";

import { useState } from 'react';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { RouterLink } from 'src/routes/components';

import {
  RiStore2Line,
  RiLogoutBoxLine,
  RiDashboardLine,
  RiShieldStarLine,
  RiShoppingBag3Line,
} from 'src/components/remix-icon';

import { signOut } from 'src/auth/context/jwt';
import { useAuthContext } from 'src/auth/hooks';

const memberMenuItems = [
  { label: 'ภาพรวม', href: '/dashboard', icon: RiDashboardLine },
  { label: 'รายการซื้อ', href: '/dashboard/purchases', icon: RiShoppingBag3Line },
  { label: 'ร้านค้าของฉัน', href: '/dashboard/seller', icon: RiStore2Line },
] as const;

export function MarketplaceAccountMenu() {
  const { user, authenticated, checkUserSession } = useAuthContext();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  if (!authenticated || !user) return null;

  const displayName = user.displayName || user.username || 'สมาชิก Marketplace';
  const initials = String(displayName).trim().charAt(0).toUpperCase();
  const menuItems =
    user.role === 'master_admin'
      ? [
          {
            label: 'ศูนย์ควบคุม',
            href: '/dashboard',
            icon: RiShieldStarLine,
          },
          ...memberMenuItems.slice(1),
        ]
      : memberMenuItems;

  const handleSignOut = async () => {
    setAnchorEl(null);
    await signOut();
    await checkUserSession?.();
    window.location.replace('/');
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'right' }}>
          <Typography variant="subtitle2" noWrap>
            {displayName}
          </Typography>
          <Typography variant="caption" color="success.main">
            เข้าสู่ระบบแล้ว
          </Typography>
        </Box>
        <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} aria-label="เมนูโปรไฟล์">
          <Badge
            overlap="circular"
            variant="dot"
            color="success"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Avatar src={user.photoURL || user.avatar_url || undefined} sx={{ width: 38, height: 38 }}>
              {initials}
            </Avatar>
          </Badge>
        </IconButton>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { mt: 1, width: 240 } } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle1" noWrap>
            {displayName}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {user.email || roleLabel(user.role)}
          </Typography>
        </Box>
        <Divider />
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <MenuItem
              key={item.href}
              component={RouterLink}
              href={item.href}
              onClick={() => setAnchorEl(null)}
              sx={{ gap: 1.5 }}
            >
              <Icon size={20} />
              {item.label}
            </MenuItem>
          );
        })}
        <Divider />
        <MenuItem onClick={handleSignOut} sx={{ gap: 1.5, color: 'error.main' }}>
          <RiLogoutBoxLine size={20} />
          ออกจากระบบ
        </MenuItem>
      </Menu>
    </>
  );
}

function roleLabel(role?: string) {
  if (role === 'teacher') return 'ครู eKru';
  if (role === 'school_admin') return 'ผู้ดูแลโรงเรียน';
  if (role === 'master_admin') return 'Super Admin';
  if (role === 'student') return 'นักเรียน';
  return 'สมาชิก Marketplace';
}
