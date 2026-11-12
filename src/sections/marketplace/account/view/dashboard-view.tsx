'use client';

import dynamic from 'next/dynamic';

import { useAuthContext } from 'src/auth/hooks';

const MarketplaceDashboardOverviewView = dynamic(() =>
  import('./dashboard-overview-view').then((module) => module.MarketplaceDashboardOverviewView)
);
const MarketplaceAdminOverviewView = dynamic(() =>
  import('../../admin/view/admin-overview-view').then(
    (module) => module.MarketplaceAdminOverviewView
  )
);

export function MarketplaceDashboardView() {
  const { user, loading } = useAuthContext();

  if (loading) return null;
  if (user?.role === 'master_admin') {
    return <MarketplaceAdminOverviewView />;
  }

  return <MarketplaceDashboardOverviewView />;
}
