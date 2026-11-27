import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, createTRPCClient } from '@trpc/client';
import { useState, ReactNode } from 'react';
import { TRPCProvider } from '../utils/trpc';
import { appRouter } from '@greenlight/platform';
import { ipcLink } from '../utils/ipc-link';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 1000 * 5,
      },
    },
  });
}

export const TrpcProviderComponent = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(makeQueryClient);
  const [trpcClient] = useState(() =>
    createTRPCClient<typeof appRouter>({
      links: [
        // Use IPC when running inside Electron, fall back to HTTP for web builds
        typeof window !== 'undefined' && 'trpcIpc' in window
          ? ipcLink<typeof appRouter>()
          : httpBatchLink({
              url: '/trpc',
              methodOverride: 'POST',
              maxItems: 16,
              fetch: (input,init)=>fetch(input,{...init,cache:'no-store'}),
            }),
      ],
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}