import type { Metadata } from 'next';

import { JwtSignUpView } from 'src/auth/view/jwt';

export const metadata: Metadata = {
  title: 'สมัครสมาชิก | eKru Marketplace',
};

export default function Page() {
  return <JwtSignUpView />;
}
