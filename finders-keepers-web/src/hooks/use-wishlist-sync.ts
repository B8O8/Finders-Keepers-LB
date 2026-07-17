"use client";

import { useEffect, useRef } from "react";

import { wishlistService } from "@/services/wishlist.service";
import { useAuthStore } from "@/stores/auth-store";
import { useWishlistStore } from "@/stores/wishlist-store";

const MERGED_FLAG = "finders-keepers-wishlist-merged";

/**
 * Lifts a guest's device wishlist into their account after login.
 *
 * This is the bridge that makes sale notifications possible: a wishlist kept
 * only in localStorage can never be emailed, because there is nobody to email.
 *
 * Runs at most once per session per customer:
 *  - the server merge is idempotent (unique on customer+product+variant), so a
 *    repeat is harmless, but there is no reason to re-send it;
 *  - a failure is swallowed deliberately - a stale wishlist entry must never
 *    break signing in. The next login retries.
 */
export function useWishlistSync() {
  const customer = useAuthStore((s) => s.customer);
  const items = useWishlistStore((s) => s.items);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!customer || inFlight.current) return;

    const flagKey = `${MERGED_FLAG}:${customer.id}`;
    if (typeof window === "undefined" || sessionStorage.getItem(flagKey)) return;

    if (!items.length) {
      sessionStorage.setItem(flagKey, "1");
      return;
    }

    inFlight.current = true;

    wishlistService
      .merge(items.map((i) => ({ productId: i.productId })))
      .then(() => {
        sessionStorage.setItem(flagKey, "1");
      })
      .catch(() => {
        // Non-fatal: retried on the next login.
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [customer, items]);
}
