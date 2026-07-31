import type { NavMainProps } from './main/nav/types';

import {
  RiHome5Line,
  RiStore2Line,
  RiBookOpenLine,
  RiShieldStarLine,
} from 'src/components/remix-icon';

// ----------------------------------------------------------------------

export const navData: NavMainProps['data'] = [
  {
    title: 'หน้าแรก',
    path: '/',
    icon: <RiHome5Line size={22} />,
  },
  {
    title: 'สินค้าทางการ',
    path: '/official-products',
    icon: <RiShieldStarLine size={22} />,
  },
  {
    title: 'สื่อการสอน',
    path: '/products',
    icon: <RiBookOpenLine size={22} />,
  },
  {
    title: 'ร้านค้า',
    path: '/stores',
    activePaths: ['/stores', '/store'],
    icon: <RiStore2Line size={22} />,
  },
];
