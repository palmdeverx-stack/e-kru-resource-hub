'use client';

import type { NavSectionProps } from 'src/components/nav-section';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';

import { DashboardLayout } from 'src/layouts/dashboard';
import { NotificationsMenu } from 'src/layouts/components/notifications-menu';

import { MarketplaceBrand } from 'src/components/marketplace-brand';
import {
  RiBankLine,
  RiKey2Line,
  RiHome5Line,
  RiSearchLine,
  RiStore2Line,
  RiMessage2Line,
  RiDashboardLine,
  RiSettings3Line,
  RiShieldStarLine,
  RiShieldCheckLine,
  RiShoppingBag3Line,
  RiMoneyDollarBoxLine,
} from 'src/components/remix-icon';

import { MarketplaceAccountMenu } from 'src/sections/marketplace/account/components/account-menu';

import { useAuthContext } from 'src/auth/hooks';

const memberNavData: NavSectionProps['data'] = [
  {
    subheader: 'Marketplace',
    items: [
      {
        title: 'สินค้าทั้งหมด',
        path: '/products',
        deepMatch: false,
        icon: <RiSearchLine />,
      },
      {
        title: 'ภาพรวม',
        path: '/dashboard',
        icon: <RiDashboardLine />,
      },
      {
        title: 'รายการซื้อ',
        path: '/dashboard/purchases',
        icon: <RiShoppingBag3Line />,
      },
      {
        title: 'ร้านค้าของฉัน',
        path: '/dashboard/seller',
        deepMatch: false,
        icon: <RiStore2Line />,
      },
      {
        title: 'ข้อมูลร้านค้า',
        path: '/dashboard/seller/profile',
        icon: <RiStore2Line />,
      },
      {
        title: 'รายได้ของร้าน',
        path: '/dashboard/seller/finance',
        icon: <RiMoneyDollarBoxLine />,
      },
      {
        title: 'LINE แจ้งเตือน',
        path: '/dashboard/seller/settings/line',
        icon: <RiMessage2Line />,
      },
    ],
  },
];

const adminNavData: NavSectionProps['data'] = [
  {
    subheader: 'Super Admin',
    items: [
      {
        title: 'สินค้าทั้งหมด',
        path: '/products',
        deepMatch: false,
        icon: <RiSearchLine />,
      },
      {
        title: 'ศูนย์ควบคุม',
        path: '/dashboard',
        icon: <RiShieldStarLine />,
      },
      {
        title: 'อนุมัติร้านค้า',
        path: '/dashboard/seller-approvals',
        icon: <RiStore2Line />,
      },
      {
        title: 'อนุมัติสินค้า',
        path: '/dashboard/product-approvals',
        icon: <RiShieldCheckLine />,
      },
      {
        title: 'ตรวจสอบการชำระเงิน',
        path: '/dashboard/payment-reviews',
        icon: <RiBankLine />,
      },
      {
        title: 'โอนเงินผู้ขาย',
        path: '/dashboard/payouts',
        icon: <RiMoneyDollarBoxLine />,
      },
    ],
  },
  {
    subheader: 'Master',
    items: [
      {
        title: 'Master',
        path: '/dashboard/master',
        icon: <RiSettings3Line />,
        children: [
          {
            title: 'หมวดหมู่',
            path: '/dashboard/master/categories',
          },
          {
            title: 'ประเภทสื่อ',
            path: '/dashboard/master/media-types',
          },
          {
            title: 'ประเภทการจำหน่าย',
            path: '/dashboard/master/sale-types',
          },
          {
            title: 'ตรวจสอบสื่อ',
            path: '/dashboard/master/media-review-rules',
          },
          {
            title: 'คำสั่งซื้อและการเงิน',
            path: '/dashboard/master/order-finance-types',
          },
          {
            title: 'รีวิวและรายงาน',
            path: '/dashboard/master/report-reasons',
          },
          {
            title: 'ระดับชั้น',
            path: '/dashboard/master/grade-levels',
          },
          {
            title: 'หลักสูตร',
            path: '/dashboard/master/curricula',
          },
          {
            title: 'แท็ก',
            path: '/dashboard/master/tags',
          },
        ],
      },
    ],
  },
  {
    subheader: 'บัญชีของฉัน',
    items: [
      {
        title: 'รายการซื้อ',
        path: '/dashboard/purchases',
        icon: <RiShoppingBag3Line />,
      },
      {
        title: 'ร้านค้าของฉัน',
        path: '/dashboard/seller',
        deepMatch: false,
        icon: <RiStore2Line />,
      },
      {
        title: 'ข้อมูลร้านค้า',
        path: '/dashboard/seller/profile',
        icon: <RiStore2Line />,
      },
      {
        title: 'รายได้ของร้าน',
        path: '/dashboard/seller/finance',
        icon: <RiMoneyDollarBoxLine />,
      },
      {
        title: 'LINE แจ้งเตือน',
        path: '/dashboard/seller/settings/line',
        icon: <RiMessage2Line />,
      },
    ],
  },
  {
    subheader: 'ตั้งค่า',
    items: [
      {
        title: 'ตั้งค่า LINE',
        path: '/dashboard/settings/line',
        icon: <RiMessage2Line />,
      },
      {
        title: 'ตั้งค่าการเงิน',
        path: '/dashboard/settings/finance',
        icon: <RiBankLine />,
      },
    ],
  },
];

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  const { user } = useAuthContext();
  const navData =
    user?.role === 'master_admin'
      ? adminNavData
      : user?.role === 'school_admin'
        ? memberNavData.map((section) => ({
            ...section,
            items: [
              ...section.items.slice(0, 3),
              {
                title: 'สิทธิ์และ License',
                path: '/dashboard/licenses',
                icon: <RiKey2Line />,
              },
              ...section.items.slice(3),
            ],
          }))
        : memberNavData;

  return (
    <DashboardLayout
      slotProps={{
        nav: {
          data: navData,
          headerIdentity: (
            <div style={{ padding: '20px 28px 8px' }}>
              <MarketplaceBrand />
            </div>
          ),
        },
        header: {
          slots: {
            centerArea: (
              <Button
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                startIcon={<RiHome5Line />}
              >
                ดูหน้าเว็บไซต์
              </Button>
            ),
            rightArea: (
              <Stack direction="row" spacing={1} alignItems="center">
                <NotificationsMenu />
                <MarketplaceAccountMenu />
              </Stack>
            ),
          },
          slotProps: {
            centerArea: {
              sx: {
                justifyContent: 'flex-start',
              },
            },
          },
        },
      }}
    >
      {children}
    </DashboardLayout>
  );
}
