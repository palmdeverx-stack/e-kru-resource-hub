'use client';

import { useAuthContext } from 'src/auth/hooks';

import { MarketplaceDashboardOverviewView } from './dashboard-overview-view';
import { MarketplaceAdminOverviewView } from '../../admin/view/admin-overview-view';

export function MarketplaceDashboardView() {
  const { user, loading } = useAuthContext();

  if (loading) return null;
  if (user?.role === 'master_admin') return <MarketplaceAdminOverviewView />;

  return <MarketplaceDashboardOverviewView />;
}
