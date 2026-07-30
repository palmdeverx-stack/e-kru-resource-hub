import type { Metadata } from 'next';

import { PopupAnnouncementManagementView } from 'src/sections/marketplace/admin/view/popup-announcement-management-view';

export const metadata: Metadata = { title: 'ประกาศ | eKru Marketplace' };

export default function Page() {
  return <PopupAnnouncementManagementView />;
}
