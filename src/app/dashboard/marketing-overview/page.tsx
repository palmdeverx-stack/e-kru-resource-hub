import { CONFIG } from 'src/global-config';

import { MarketplaceMarketingOverviewView } from 'src/sections/marketplace/admin/view/marketing-overview-view';

export const metadata = { title: `ภาพรวมการตลาด | ${CONFIG.appName}` };

export default function Page() {
  return <MarketplaceMarketingOverviewView />;
}
