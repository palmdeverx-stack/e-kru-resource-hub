import type { Metadata } from 'next';

import { JwtSignInView } from 'src/auth/view/jwt';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ | E-KRU Marketplace',
};

export default function Page() {
  return <JwtSignInView />;
}
