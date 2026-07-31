import type { IconButtonProps } from '@mui/material/IconButton';

import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';

import { Label } from 'src/components/label';
import { CustomPopover } from 'src/components/custom-popover';
import {
  RiTeamLine,
  RiGuideLine,
  RiHome5Line,
  RiUser3Line,
  RiQrCodeLine,
  RiContractLine,
  RiFileTextLine,
  RiShieldUserLine,
  RiShieldKeyholeLine,
} from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { AccountButton } from './account-button';
import { SignOutButton } from './sign-out-button';

// ----------------------------------------------------------------------

export type AccountPopoverProps = IconButtonProps & {
  data?: {
    label: string;
    href: string;
    icon?: React.ReactNode;
    info?: React.ReactNode;
  }[];
};

const POSITION_FALLBACK: Record<string, string> = {
  master_admin: 'ผู้ดูแลระบบหลัก',
  school_admin: 'ผู้ดูแลโรงเรียน',
  teacher: 'ครู/บุคลากร',
  student: 'นักเรียน',
};

export function AccountPopover({ data = [], sx, ...other }: AccountPopoverProps) {
  const pathname = usePathname();
  const { t } = useTranslate('navbar');

  const { open, anchorEl, onClose, onOpen } = usePopover();

  const { user } = useAuthContext();
  const rawPositionTitle = user?.position_title || POSITION_FALLBACK[user?.role] || '-';
  const positionTitle = t(rawPositionTitle, { defaultValue: rawPositionTitle });

  const studentMenu = [
    {
      label: 'โปรไฟล์ของฉัน',
      href: paths.student.profile,
      icon: <RiUser3Line />,
    },
    {
      label: 'ห้องเรียนของฉัน',
      href: paths.student.classroom,
      icon: <RiTeamLine />,
    },
    {
      label: 'QR ของฉัน',
      href: paths.student.qr,
      icon: <RiQrCodeLine />,
    },
  ];
  const teacherMenu = [
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
  const menuData: NonNullable<AccountPopoverProps['data']> =
    user?.role === 'student'
      ? [
          ...studentMenu,
          ...data.filter(
            (option) => !studentMenu.some((studentOption) => studentOption.href === option.href)
          ),
        ]
      : user?.role === 'teacher'
        ? teacherMenu
        : data;

  const renderMenuActions = () => (
    <CustomPopover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      slotProps={{ paper: { sx: { p: 0, width: 200 } } }}
    >
      <Box sx={{ p: 2, pb: 1.5 }}>
        <Typography variant="subtitle2" noWrap>
          {user?.displayName}
        </Typography>

        <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
          {user?.email}
        </Typography>
      </Box>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <MenuList sx={{ p: 1, my: 1, '& li': { p: 0 } }}>
        {menuData.map((option) => {
          const rootLabel = pathname.includes('/admin') ? t('Home') : t('Dashboard');
          const rootHref = pathname.includes('/admin') ? '/' : paths.admin.root;

          return (
            <MenuItem key={option.label}>
              <Link
                component={RouterLink}
                href={option.label === 'Home' ? rootHref : option.href}
                color="inherit"
                underline="none"
                onClick={onClose}
                sx={{
                  px: 1,
                  py: 0.75,
                  width: 1,
                  display: 'flex',
                  typography: 'body2',
                  alignItems: 'center',
                  color: 'text.secondary',
                  '& svg': { width: 24, height: 24 },
                  '&:hover': { color: 'text.primary' },
                }}
              >
                {option.icon}

                <Box component="span" sx={{ ml: 2 }}>
                  {option.label === 'Home'
                    ? rootLabel
                    : t(option.label, { defaultValue: option.label })}
                </Box>

                {option.info && (
                  <Label color="error" sx={{ ml: 1 }}>
                    {option.info}
                  </Label>
                )}
              </Link>
            </MenuItem>
          );
        })}
      </MenuList>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Box sx={{ p: 1 }}>
        <SignOutButton
          size="medium"
          variant="text"
          onClose={onClose}
          sx={{ display: 'block', textAlign: 'left' }}
        />
      </Box>
    </CustomPopover>
  );

  return (
    <>
      <Box sx={{ p: 2, pb: 1.5 }} display="flex" flexDirection="column" alignItems="flex-end">
        <Typography variant="subtitle2" noWrap>
          {user?.displayName}
        </Typography>

        <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
          {positionTitle}
        </Typography>
      </Box>

      <AccountButton
        onClick={onOpen}
        photoURL={user?.photoURL}
        displayName={user?.displayName}
        sx={sx}
        {...other}
      />

      {renderMenuActions()}
    </>
  );
}
