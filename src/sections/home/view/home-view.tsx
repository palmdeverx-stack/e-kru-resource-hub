'use client';

import { StudentHomeView } from 'src/sections/student-dashboard/view/student-home-view';

// ----------------------------------------------------------------------

/** Student-only home. Route access is enforced by app/(home)/layout.tsx. */
export function HomeView() {
  return <StudentHomeView />;
}
