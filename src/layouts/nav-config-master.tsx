import type { NavSectionProps } from 'src/components/nav-section';

import { paths } from 'src/routes/paths';

import {
  RiAdminLine,
  RiFlowChart,
  RiBuildingLine,
  RiDashboardLine,
  RiPriceTag3Line,
} from 'src/components/remix-icon';

// ----------------------------------------------------------------------

const ICONS = {
  dashboard: <RiDashboardLine />,
  school: <RiBuildingLine />,
  schoolAdmin: <RiAdminLine />,
  subscription: <RiPriceTag3Line />,
  systemFlow: <RiFlowChart />,
};

// ----------------------------------------------------------------------

/**
 * Master admin navigation — system-wide, across every school.
 */
export const navData: NavSectionProps['data'] = [
  {
    subheader: 'ภาพรวม',
    items: [{ title: 'ภาพรวมระบบ', path: paths.master.root, icon: ICONS.dashboard }],
  },
  {
    subheader: 'การจัดการระบบ',
    items: [
      {
        title: 'โรงเรียนทั้งหมด',
        path: paths.master.school.root,
        icon: ICONS.school,
      },
      {
        title: 'ผู้ดูแลโรงเรียน',
        path: paths.master.schoolAdmin.root,
        icon: ICONS.schoolAdmin,
      },
      {
        title: 'ตั้งค่าแพ็กเกจ',
        path: paths.master.subscriptionPlan.root,
        icon: ICONS.subscription,
      },
    ],
  },
  {
    subheader: 'เอกสารระบบ',
    items: [
      {
        title: 'การทำงานของระบบ',
        path: paths.master.systemFlow,
        icon: ICONS.systemFlow,
      },
    ],
  },
];
