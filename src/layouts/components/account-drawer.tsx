'use client';

import type { IconButtonProps } from '@mui/material/IconButton';

import { varAlpha } from 'minimal-shared/utils';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import Drawer from '@mui/material/Drawer';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';
import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import { Label } from 'src/components/label';
import { Scrollbar } from 'src/components/scrollbar';
import {
  RiTeamLine,
  RiGuideLine,
  RiCloseLine,
  RiHome5Line,
  RiUser3Line,
  RiSchoolLine,
  RiContractLine,
  RiFileTextLine,
  RiShieldUserLine,
  RiArrowRightSLine,
  RiShieldCheckLine,
  RiShieldKeyholeLine,
  RiGraduationCapLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { AccountButton } from './account-button';
import { SignOutButton } from './sign-out-button';

// ----------------------------------------------------------------------

export type AccountDrawerProps = IconButtonProps & {
  data?: {
    label: string;
    href: string;
    icon?: React.ReactNode;
    info?: React.ReactNode;
  }[];
};

const ROLE_LABEL: Record<string, string> = {
  master_admin: 'ผู้ดูแลระบบหลัก',
  school_admin: 'ผู้ดูแลโรงเรียน',
  teacher: 'ครูผู้สอน',
  student: 'นักเรียน',
};

const ROOT_PATHS = [paths.master.root, paths.admin.root, paths.teacher.root, paths.student.root];

export function AccountDrawer({ data = [], sx, ...other }: AccountDrawerProps) {
  const pathname = usePathname();
  const { t } = useTranslate('navbar');
  const { user } = useAuthContext();
  const { value: open, onFalse: onClose, onTrue: onOpen } = useBoolean();

  const isAdmin = user?.role === 'school_admin' || user?.role === 'master_admin';
  const avatarUrl = user?.avatar_url ?? user?.photoURL;
  const displayName = user?.displayName || user?.username || t('ผู้ใช้งาน');
  const rawRoleLabel = ROLE_LABEL[user?.role] ?? 'ผู้ใช้งาน';
  const roleLabel = t(rawRoleLabel, { defaultValue: rawRoleLabel });

  const adminMenu: NonNullable<AccountDrawerProps['data']> =
    user?.role === 'master_admin'
      ? [
          {
            label: 'ภาพรวมระบบ',
            href: paths.master.root,
            icon: <RiHome5Line />,
          },
          {
            label: 'จัดการโรงเรียน',
            href: paths.master.school.root,
            icon: <RiSchoolLine />,
          },
          {
            label: 'ผู้ดูแลโรงเรียน',
            href: paths.master.schoolAdmin.root,
            icon: <RiTeamLine />,
          },
          {
            label: 'เปลี่ยนรหัสผ่าน',
            href: paths.auth.jwt.changePassword,
            icon: <RiShieldKeyholeLine />,
          },
        ]
      : [
          {
            label: 'ภาพรวมโรงเรียน',
            href: paths.admin.root,
            icon: <RiHome5Line />,
          },
          {
            label: 'ข้อมูลโรงเรียน',
            href: paths.admin.school,
            icon: <RiSchoolLine />,
          },
          {
            label: 'บุคลากรและครู',
            href: paths.admin.user.root,
            icon: <RiTeamLine />,
          },
          {
            label: 'นักเรียน',
            href: paths.admin.student.root,
            icon: <RiGraduationCapLine />,
          },
          {
            label: 'วิธีใช้งาน',
            href: paths.admin.guide,
            icon: <RiGuideLine />,
          },
          {
            label: 'นโยบายความเป็นส่วนตัว',
            href: paths.legal.privacyPolicy,
            icon: <RiShieldUserLine />,
          },
          {
            label: 'ข้อกำหนดการใช้บริการ',
            href: paths.legal.termsOfService,
            icon: <RiFileTextLine />,
          },
          {
            label: 'ข้อตกลงการให้บริการ',
            href: paths.legal.serviceAgreement,
            icon: <RiContractLine />,
          },
          {
            label: 'เปลี่ยนรหัสผ่าน',
            href: paths.auth.jwt.changePassword,
            icon: <RiShieldKeyholeLine />,
          },
        ];

  const teacherMenu: NonNullable<AccountDrawerProps['data']> = [
    {
      label: 'หน้าหลักครู',
      href: paths.teacher.root,
      icon: <RiHome5Line />,
    },
    {
      label: 'โปรไฟล์ของฉัน',
      href: paths.teacher.profile,
      icon: <RiUser3Line />,
    },
    {
      label: 'วิธีใช้งาน',
      href: paths.teacher.guide,
      icon: <RiGuideLine />,
    },
    {
      label: 'นโยบายความเป็นส่วนตัว',
      href: paths.legal.privacyPolicy,
      icon: <RiShieldUserLine />,
    },
    {
      label: 'ข้อกำหนดการใช้บริการ',
      href: paths.legal.termsOfService,
      icon: <RiFileTextLine />,
    },
    {
      label: 'ข้อตกลงการให้บริการ',
      href: paths.legal.serviceAgreement,
      icon: <RiContractLine />,
    },
    {
      label: 'เปลี่ยนรหัสผ่าน',
      href: paths.auth.jwt.changePassword,
      icon: <RiShieldKeyholeLine />,
    },
  ];

  const menuData = isAdmin ? adminMenu : user?.role === 'teacher' ? teacherMenu : data;

  return (
    <>
      <AccountButton
        onClick={onOpen}
        photoURL={avatarUrl}
        displayName={displayName}
        sx={sx}
        {...other}
      />

      <Drawer
        open={open}
        onClose={onClose}
        anchor="right"
        sx={(theme) => ({ zIndex: theme.zIndex.drawer + 2 })}
        slotProps={{
          backdrop: {
            sx: {
              bgcolor: (theme) => varAlpha(theme.vars.palette.grey['900Channel'], 0.32),
              backdropFilter: 'blur(2px)',
            },
          },
          paper: {
            sx: {
              width: { xs: 'calc(100% - 24px)', sm: 360 },
              maxWidth: 360,
              bgcolor: 'background.paper',
            },
          },
        }}
      >
        <Scrollbar>
          <Box
            sx={{
              p: 3,
              pt: 5.5,
              color: isAdmin ? 'primary.contrastText' : 'text.primary',
              position: 'relative',
              background: isAdmin
                ? (theme) =>
                    `linear-gradient(145deg, ${theme.vars.palette.primary.darker}, ${theme.vars.palette.primary.main})`
                : 'background.neutral',
            }}
          >
            <IconButton
              onClick={onClose}
              aria-label={t('ปิดเมนูบัญชี', { defaultValue: 'ปิดเมนูบัญชี' })}
              sx={{
                top: 10,
                right: 10,
                position: 'absolute',
                color: isAdmin ? 'inherit' : 'text.secondary',
                bgcolor: (theme) =>
                  isAdmin ? varAlpha(theme.vars.palette.common.whiteChannel, 0.08) : 'transparent',
                '&:hover': {
                  bgcolor: (theme) =>
                    isAdmin
                      ? varAlpha(theme.vars.palette.common.whiteChannel, 0.16)
                      : 'action.hover',
                },
              }}
            >
              <RiCloseLine />
            </IconButton>

            <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
              <Avatar
                src={avatarUrl}
                alt={displayName}
                sx={{
                  width: 68,
                  height: 68,
                  flexShrink: 0,
                  typography: 'h5',
                  color: 'primary.main',
                  bgcolor: 'common.white',
                  border: (theme) =>
                    `3px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.4)}`,
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" noWrap>
                  {displayName}
                </Typography>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    mt: 0.25,
                    color: isAdmin
                      ? (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.72)
                      : 'text.secondary',
                  }}
                >
                  {user?.email || `@${user?.username ?? '-'}`}
                </Typography>
                <Label
                  sx={{
                    mt: 1,
                    color: isAdmin ? 'common.white' : 'primary.darker',
                    bgcolor: (theme) =>
                      isAdmin
                        ? varAlpha(theme.vars.palette.common.whiteChannel, 0.14)
                        : theme.vars.palette.primary.lighter,
                  }}
                >
                  {roleLabel}
                </Label>
              </Box>
            </Box>

            {isAdmin && (
              <Box
                sx={{
                  p: 1.5,
                  gap: 1,
                  mt: 2.5,
                  display: 'flex',
                  borderRadius: 1.5,
                  alignItems: 'center',
                  bgcolor: (theme) => varAlpha(theme.vars.palette.common.whiteChannel, 0.08),
                }}
              >
                <RiShieldCheckLine size={20} />
                <Typography variant="caption" sx={{ opacity: 0.84 }}>
                  {t('คุณกำลังใช้งานพื้นที่จัดการระบบของโรงเรียน')}
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ px: 2, py: 2.5 }}>
            <Typography
              variant="overline"
              sx={{ px: 1.5, mb: 1, display: 'block', color: 'text.disabled' }}
            >
              {isAdmin ? t('เมนูผู้ดูแล') : t('เมนูบัญชี')}
            </Typography>
            <MenuList
              disablePadding
              sx={{
                gap: 0.5,
                display: 'grid',
              }}
            >
              {menuData.map((option) => {
                const isRootPath = ROOT_PATHS.includes(option.href);
                const selected =
                  pathname === option.href ||
                  (!isRootPath && option.href !== '#' && pathname.startsWith(`${option.href}/`));

                return (
                  <MenuItem
                    key={`${option.label}-${option.href}`}
                    disableGutters
                    sx={{
                      '&:hover': {
                        color: 'text.primary',
                        bgcolor: 'transparent',
                      },
                    }}
                  >
                    <Link
                      component={RouterLink}
                      href={option.href}
                      color="inherit"
                      underline="none"
                      onClick={onClose}
                      aria-current={selected ? 'page' : undefined}
                      sx={{
                        p: 1.25,
                        gap: 1.5,
                        width: 1,
                        minHeight: 48,
                        display: 'flex',
                        borderRadius: 1.25,
                        typography: 'subtitle2',
                        alignItems: 'center',
                        color: selected ? 'primary.main' : 'text.secondary',
                        bgcolor: selected ? 'transparent' : 'transparent',
                        '& svg': { width: 23, height: 23, flexShrink: 0 },
                        '&:hover': {
                          color: 'text.primary',
                          bgcolor: 'transparent',
                        },
                      }}
                    >
                      {option.icon}
                      <Box component="span" sx={{ minWidth: 0, flexGrow: 1 }}>
                        {t(option.label, { defaultValue: option.label })}
                      </Box>
                      {option.info && <Label color="error">{option.info}</Label>}
                      <RiArrowRightSLine
                        size={18}
                        style={{ color: 'var(--palette-text-disabled)' }}
                      />
                    </Link>
                  </MenuItem>
                );
              })}
            </MenuList>
          </Box>
        </Scrollbar>

        <Box
          sx={{
            p: 2.5,
            bgcolor: 'transparent',
          }}
        >
          <SignOutButton onClose={onClose} />
        </Box>
      </Drawer>
    </>
  );
}
