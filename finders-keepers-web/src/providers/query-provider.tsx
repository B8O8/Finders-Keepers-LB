"use client";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { useState } from "react";

import { useWishlistSync } from "@/hooks/use-wishlist-sync";

/**
 * Merges a guest's device wishlist into their account once they log in.
 * Mounted inside the query provider so it runs app-wide, exactly once.
 */
function WishlistSync() {
  useWishlistSync();
  return null;
}

export function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WishlistSync />
      {children}
    </QueryClientProvider>
  );
}