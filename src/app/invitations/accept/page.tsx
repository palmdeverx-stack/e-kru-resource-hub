import type { Metadata } from 'next';

import { AcceptSchoolInvitationView } from 'src/sections/marketplace/account/view/accept-school-invitation-view';

export const metadata: Metadata = {
  title: 'ตอบรับคำเชิญเข้าโรงเรียน | E-KRU Marketplace',
};

export default function Page() {
  return <AcceptSchoolInvitationView />;
}
