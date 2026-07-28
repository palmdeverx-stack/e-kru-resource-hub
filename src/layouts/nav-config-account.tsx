import type { AccountDrawerProps } from './components/account-drawer';

import {
  RiHome5Line,
  RiUser3Line,
  RiFolderLine,
  RiBankCardLine,
  RiSettings3Line,
  RiShieldKeyholeLine,
} from 'src/components/remix-icon';

// ----------------------------------------------------------------------

export const _account: AccountDrawerProps['data'] = [
  { label: 'Home', href: '/', icon: <RiHome5Line /> },
  {
    label: 'Profile',
    href: '#',
    icon: <RiUser3Line />,
  },
  {
    label: 'Projects',
    href: '#',
    icon: <RiFolderLine />,
    info: '3',
  },
  {
    label: 'Subscription',
    href: '#',
    icon: <RiBankCardLine />,
  },
  { label: 'Security', href: '#', icon: <RiShieldKeyholeLine /> },
  { label: 'Account settings', href: '#', icon: <RiSettings3Line /> },
];
