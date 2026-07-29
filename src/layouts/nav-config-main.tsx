import type { NavMainProps } from './main/nav/types';

import { RiHome5Line, RiBookOpenLine } from 'src/components/remix-icon';

// ----------------------------------------------------------------------

export const navData: NavMainProps['data'] = [
  {
    title: 'หน้าแรก',
    path: '/',
    icon: <RiHome5Line size={22} />,
  },
  {
    title: 'สื่อการสอน',
    path: '/products',
    icon: <RiBookOpenLine size={22} />,
  },
];
