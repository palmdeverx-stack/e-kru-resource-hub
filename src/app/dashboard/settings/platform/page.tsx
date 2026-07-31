import type { Metadata } from 'next';

import { MarketplacePlatformSettingsView } from 'src/sections/marketplace/admin/view/platform-settings-view';

export const metadata: Metadata = { title: 'ข้อมูลแพลตฟอร์ม | E-KRU Marketplace' };

export default function Page() {
  return <MarketplacePlatformSettingsView />;
}
