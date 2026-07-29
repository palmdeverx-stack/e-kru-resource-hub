import type { Metadata } from 'next';

import { JwtGoogleCallbackView } from 'src/auth/view/jwt';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบด้วย Google | eKru Marketplace',
};

export default function Page() {
  return <JwtGoogleCallbackView />;
}

