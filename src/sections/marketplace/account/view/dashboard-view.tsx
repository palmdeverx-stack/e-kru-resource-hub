'use client';

import { useAuthContext } from 'src/auth/hooks';

import { MarketplaceAdminOverviewView } from '../../admin/view/admin-overview-view';
import {
  MarketplaceDashboardOverviewView,
  MarketplaceDashboardCollectionsSection,
} from './dashboard-overview-view';

export function MarketplaceDashboardView() {
  const { user, loading } = useAuthContext();

  if (loading) return null;
  if (user?.role === 'master_admin') {
    return (
      <>
        <MarketplaceAdminOverviewView />
        <MarketplaceDashboardCollectionsSection />
      </>
    );
  }

  return <MarketplaceDashboardOverviewView />;
}
