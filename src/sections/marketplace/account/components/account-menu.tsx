'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Chip from '@mui/material/Chip';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { RouterLink } from 'src/routes/components';

import {
  RiKey2Line,
  RiStore2Line,
  RiSearchLine,
  RiLogoutBoxLine,
  RiDashboardLine,
  RiShoppingBag3Line,
} from 'src/components/remix-icon';

import { signOut } from 'src/auth/context/jwt';
import { useAuthContext } from 'src/auth/hooks';

const memberMenuItems = [
  { label: 'สินค้าทั้งหมด', href: '/products', icon: RiSearchLine },
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
  const isSuperAdmin = isSuperAdminRole(user.role);
  let menuItems: { label: string; href: string; icon: typeof RiSearchLine }[] = isSuperAdmin
    ? []
    : [...memberMenuItems];
  if (user.role === 'school_admin') {
    menuItems = [
      ...menuItems.slice(0, 2),
      { label: 'สิทธิ์และ License', href: '/dashboard/licenses', icon: RiKey2Line },
      ...menuItems.slice(2),
    ];
  }

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
        <IconButton
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-label="เมนูโปรไฟล์"
          sx={{ p: { xs: 0.5, sm: 1 } }}
        >
          <Badge
            overlap="circular"
            variant="dot"
            color="success"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Avatar
              src={user.photoURL || user.avatar_url || undefined}
              sx={{
                width: { xs: 34, sm: 38 },
                height: { xs: 34, sm: 38 },
              }}
            >
              {initials}
            </Avatar>
          </Badge>
        </IconButton>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: 280,
              maxHeight: 'calc(100vh - 24px)',
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle1" noWrap>
            {displayName}
          </Typography>
          {!!user.email && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {user.email}
            </Typography>
          )}
          <Chip
            size="small"
            color={isSuperAdmin ? 'primary' : 'default'}
            variant="soft"
            label={roleLabel(user.role)}
            sx={{ mt: 1 }}
          />
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
        {!!menuItems.length && <Divider />}
        <MenuItem onClick={handleSignOut} sx={{ gap: 1.5, color: 'error.main' }}>
          <RiLogoutBoxLine size={20} />
          ออกจากระบบ
        </MenuItem>
      </Menu>
    </>
  );
}

function roleLabel(role?: string) {
  if (isSuperAdminRole(role)) return 'Super Admin';
  if (role === 'teacher') return 'ครู';
  if (role === 'school_admin') return 'ผู้ดูแลโรงเรียน';
  if (role === 'student') return 'นักเรียน';
  return 'สมาชิก Marketplace';
}

function isSuperAdminRole(role?: string) {
  return role === 'master_admin' || role === 'super_admin';
}
