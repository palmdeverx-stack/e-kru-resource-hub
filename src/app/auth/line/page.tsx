import { Suspense } from 'react';

import { JwtLineView } from 'src/auth/view/jwt/jwt-line-view';

export default function Page() {
  return (
    <Suspense>
      <JwtLineView />
    </Suspense>
  );
}
