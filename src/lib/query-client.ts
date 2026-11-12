import { QueryClient } from '@tanstack/react-query';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false },
    },
  });
}

let browserClient: QueryClient | undefined;

/** Never share a QueryClient between server-rendered requests. */
export function getQueryClient() {
  if (typeof window === 'undefined') return createQueryClient();
  browserClient ??= createQueryClient();
  return browserClient;
}
