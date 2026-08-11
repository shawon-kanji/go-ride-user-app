import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/** Test-only client: no retries (production uses retry: 1) and no GC delay,
 *  so a failing mutation surfaces its error on the first tick. Mutations also
 *  get gcTime: 0 — the default 5-minute mutation gcTime schedules a real
 *  setTimeout that outlives the test and leaves Jest unable to exit. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
}

export function createQueryWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
