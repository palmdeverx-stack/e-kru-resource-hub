'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { getQueryClient } from './query-client';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export function ReactQueryProvider({ children }: Props) {
  const [queryClient] = useState(getQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
