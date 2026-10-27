"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ApiRequestError } from "@/lib/api/client";

/**
 * Server state in the browser — what a panel or a bell fetches after the page has loaded. Answers are kept for half a minute so reopening
 * a panel is instant, are refreshed when the tab is looked at again, and a refusal (4xx) is never retried because asking twice will not
 * change it.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: (failures, error) => !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500) && failures < 2,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
