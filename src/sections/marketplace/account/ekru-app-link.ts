import type { LicenseTargetSystem } from '../shared/types';

export const SCHOOL_LINE_NOTIFICATIONS_FEATURE = 'admin.line_notifications';

export function getLicenseAppDestination({
  baseUrl,
  role,
  targetSystem,
  featureKeys = [],
}: {
  baseUrl: string;
  role?: string | null;
  targetSystem?: LicenseTargetSystem | null;
  featureKeys?: string[];
}) {
  const resolvedTarget =
    targetSystem ??
    (featureKeys.some((key) => key.startsWith('marketplace.')) ? 'marketplace' : 'ekru');

  if (resolvedTarget === 'marketplace') {
    const isSellerLine = featureKeys.some((key) => key.startsWith('marketplace.seller_line_'));
    return {
      href: isSellerLine ? '/dashboard/seller/settings/line' : '/dashboard',
      label: 'เปิดใช้งานใน Marketplace',
      external: false,
    };
  }

  if (!baseUrl) return { href: '', label: 'เปิดใช้งานใน E-KRU', external: true };

  let path = '/';
  if (featureKeys.includes(SCHOOL_LINE_NOTIFICATIONS_FEATURE)) {
    path = '/admin/line-notifications/';
  } else if (role === 'master_admin' || role === 'marketplace_admin') {
    path = '/master/';
  } else if (role === 'teacher' || featureKeys.some((key) => key.startsWith('teacher.'))) {
    path = '/teacher/';
  } else if (role === 'student' || featureKeys.some((key) => key.startsWith('student.'))) {
    path = '/student/';
  } else if (
    role === 'school_admin' ||
    role === 'admin' ||
    featureKeys.some((key) => key.startsWith('admin.'))
  ) {
    path = '/admin/';
  }

  return {
    href: `${baseUrl.replace(/\/+$/, '')}${path}?source=marketplace`,
    label: 'เปิดใช้งานใน E-KRU',
    external: true,
  };
}
