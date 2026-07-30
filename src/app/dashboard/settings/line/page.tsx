import type { Metadata } from 'next';

import { LineNotificationSettingsView } from 'src/sections/line-notifications/view/line-notification-settings-view';

export const metadata: Metadata = {
  title: 'ตั้งค่า LINE | E-KRU Marketplace',
};

export default function Page() {
  return <LineNotificationSettingsView scope="marketplace" />;
}
