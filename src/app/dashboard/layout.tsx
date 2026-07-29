'use client';

import type { NavSectionProps } from 'src/components/nav-section';

import { useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';

import { languageOptions } from 'src/locales';
import { DashboardLayout } from 'src/layouts/dashboard';
import { LanguagePopover } from 'src/layouts/components/language-popover';
import { NotificationsMenu } from 'src/layouts/components/notifications-menu';

import { MarketplaceBrand } from 'src/components/marketplace-brand';
import {
  RiKey2Line,
  RiHome5Line,
  RiRocketLine,
  RiSchoolLine,
  RiIdCardLine,
  RiSearchLine,
  RiStore2Line,
  RiReceiptLine,
  RiWallet3Line,
  RiBankCardLine,
  RiDashboardLine,
  RiSettings3Line,
  RiFilePaper2Line,
  RiShieldStarLine,
  RiUserFollowLine,
  RiShieldCheckLine,
  RiChatSettingsLine,
  RiSecurePaymentLine,
  RiNotification3Line,
  RiShoppingCart2Line,
  RiExchangeDollarLine,
} from 'src/components/remix-icon';

import { MarketplaceAccountMenu } from 'src/sections/marketplace/account/components/account-menu';

import { useAuthContext } from 'src/auth/hooks';

const memberNavData: NavSectionProps['data'] = [
  {
    subheader: 'Marketplace',
    items: [
      {
        title: 'สินค้าทั้งหมด',
        path: '/dashboard/products',
        deepMatch: false,
        icon: <RiSearchLine />,
      },
      {
        title: 'ตะกร้าของฉัน',
        path: '/dashboard/cart',
        icon: <RiShoppingCart2Line />,
      },
    ],
  },
  {
    subheader: 'บัญชีของฉัน',
    items: [
      {
        title: 'ภาพรวม',
        path: '/dashboard',
        icon: <RiDashboardLine />,
      },
      {
        title: 'รายการซื้อ',
        path: '/dashboard/purchases',
        icon: <RiReceiptLine />,
      },
      {
        title: 'แอปและสิทธิ์ของฉัน',
        path: '/dashboard/my-apps',
        icon: <RiRocketLine />,
      },
    ],
  },
  {
    subheader: 'ร้านค้าของฉัน',
    items: [
      {
        title: 'ร้านค้าของฉัน',
        path: '/dashboard/seller',
        deepMatch: false,
        icon: <RiStore2Line />,
      },
      {
        title: 'ข้อมูลร้านค้า',
        path: '/dashboard/seller/profile',
        icon: <RiIdCardLine />,
      },
      {
        title: 'รายได้ของร้าน',
        path: '/dashboard/seller/finance',
        icon: <RiWallet3Line />,
      },
    ],
  },
];

const adminNavData: NavSectionProps['data'] = [
  {
    subheader: 'Marketplace',
    items: [
      {
        title: 'สินค้าทั้งหมด',
        path: '/dashboard/products',
        deepMatch: false,
        icon: <RiSearchLine />,
      },
      {
        title: 'ตะกร้าของฉัน',
        path: '/dashboard/cart',
        icon: <RiShoppingCart2Line />,
      },
    ],
  },
  {
    subheader: 'การดูแล Marketplace',
    items: [
      {
        title: 'ศูนย์ควบคุม',
        path: '/dashboard',
        icon: <RiShieldStarLine />,
      },
      {
        title: 'อนุมัติร้านค้า',
        path: '/dashboard/seller-approvals',
        icon: <RiUserFollowLine />,
      },
      {
        title: 'อนุมัติสินค้า',
        path: '/dashboard/product-approvals',
        icon: <RiShieldCheckLine />,
      },
      {
        title: 'ตรวจสอบการชำระเงิน',
        path: '/dashboard/payment-reviews',
        icon: <RiBankCardLine />,
      },
      {
        title: 'โอนเงินผู้ขาย',
        path: '/dashboard/payouts',
        icon: <RiExchangeDollarLine />,
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
          {
            title: 'เอกสารข้อกำหนด',
            path: '/dashboard/master/legal-documents',
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
        icon: <RiReceiptLine />,
      },
    ],
  },
  {
    subheader: 'ผู้ขาย',
    items: [
      {
        title: 'ร้านค้าของฉัน',
        path: '/dashboard/seller',
        deepMatch: false,
        icon: <RiStore2Line />,
      },
      {
        title: 'ข้อมูลร้านค้า',
        path: '/dashboard/seller/profile',
        icon: <RiIdCardLine />,
      },
      {
        title: 'รายได้ของร้าน',
        path: '/dashboard/seller/finance',
        icon: <RiWallet3Line />,
      },
      {
        title: 'ข้อเสนอขายโรงเรียน',
        path: '/dashboard/seller/deals',
        icon: <RiFilePaper2Line />,
      },
      {
        title: 'LINE แจ้งเตือนร้านค้า',
        path: '/dashboard/seller/settings/line',
        icon: <RiNotification3Line />,
      },
    ],
  },
  {
    subheader: 'ตั้งค่าระบบ',
    items: [
      {
        title: 'ตั้งค่า LINE',
        path: '/dashboard/settings/line',
        icon: <RiChatSettingsLine />,
      },
      {
        title: 'ตั้งค่าการเงิน',
        path: '/dashboard/settings/finance',
        icon: <RiSecurePaymentLine />,
      },
    ],
  },
];

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  const { user } = useAuthContext();
  const [canViewSchoolEntitlements, setCanViewSchoolEntitlements] = useState(false);
  const [canUseSellerLine, setCanUseSellerLine] = useState(false);

  useEffect(() => {
    if (user?.role !== 'teacher' && user?.role !== 'marketplace_user') {
      setCanViewSchoolEntitlements(false);
      return undefined;
    }

    setCanViewSchoolEntitlements(false);
    const controller = new AbortController();

    const loadSchoolEntitlementAccess = async () => {
      try {
        const response = await fetch('/api/marketplace/school-entitlements?summary=1', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          setCanViewSchoolEntitlements(false);
          return;
        }
        const data = (await response.json()) as { canViewSchoolEntitlements?: boolean };
        setCanViewSchoolEntitlements(Boolean(data.canViewSchoolEntitlements));
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setCanViewSchoolEntitlements(false);
        }
      }
    };

    void loadSchoolEntitlementAccess();
    return () => controller.abort();
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user?.role || user.role === 'master_admin') {
      setCanUseSellerLine(user?.role === 'master_admin');
      return undefined;
    }

    setCanUseSellerLine(false);
    const controller = new AbortController();

    fetch('/api/marketplace/seller/line-settings?access=1', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return { allowed: false };
        return response.json() as Promise<{ allowed?: boolean }>;
      })
      .then((result) => setCanUseSellerLine(Boolean(result.allowed)))
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') setCanUseSellerLine(false);
      });

    return () => controller.abort();
  }, [user?.id, user?.role]);

  const navData =
    user?.role === 'master_admin'
      ? adminNavData
      : memberNavData.map((section) => {
          if (section.subheader === 'ร้านค้าของฉัน') {
            const lineItems = canUseSellerLine
                ? [
                  {
                    title: 'LINE แจ้งเตือนร้านค้า',
                    path: '/dashboard/seller/settings/line',
                    icon: <RiNotification3Line />,
                  },
                ]
              : [];
            return { ...section, items: [...section.items, ...lineItems] };
          }
          if (section.subheader !== 'บัญชีของฉัน') return section;
          const roleItems =
            user?.role === 'school_admin'
              ? [
                  {
                    title: 'สิทธิ์และ License',
                    path: '/dashboard/licenses',
                    icon: <RiKey2Line />,
                  },
                ]
              : canViewSchoolEntitlements
                ? [
                    {
                      title: 'สิทธิ์จากโรงเรียน',
                      path: '/dashboard/school-entitlements',
                      icon: <RiSchoolLine />,
                    },
                  ]
                : [];
          return { ...section, items: [...section.items, ...roleItems] };
        });

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
                <LanguagePopover showTranslateIcon data={languageOptions} />
                <NotificationsMenu scope="marketplace" />
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
