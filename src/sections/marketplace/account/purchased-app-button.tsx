'use client';

import type { MarketplaceProduct } from '../shared/types';

import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';

import { CONFIG } from 'src/global-config';

import { RiExternalLinkLine } from 'src/components/remix-icon';

import { useAuthContext } from 'src/auth/hooks';

import { getLicenseAppDestination } from './ekru-app-link';

type Props = {
  product: Pick<
    MarketplaceProduct,
    'license_target_system' | 'grants_feature_key' | 'grants_feature_keys'
  >;
  fullWidth?: boolean;
};

export function PurchasedAppButton({ product, fullWidth = false }: Props) {
  const { user } = useAuthContext();
  const destination = getLicenseAppDestination({
    baseUrl: CONFIG.ekruUrl,
    role: user?.role,
    targetSystem: product.license_target_system,
    featureKeys: product.grants_feature_keys?.length
      ? product.grants_feature_keys
      : product.grants_feature_key
        ? [product.grants_feature_key]
        : [],
  });
  return (
    <Button
      href={destination.href || paths.marketplace.personalEntitlements}
      target={destination.href && destination.external ? '_blank' : undefined}
      rel={destination.external ? 'noopener noreferrer' : undefined}
      fullWidth={fullWidth}
      variant="contained"
      startIcon={<RiExternalLinkLine />}
    >
      {destination.href ? destination.label : 'ดูสิทธิ์เพื่อเข้าใช้งานระบบ'}
    </Button>
  );
}
