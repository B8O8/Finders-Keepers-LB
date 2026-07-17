import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Single money formatter for the storefront. Matches the existing inline
 * `$${n.toFixed(2)}` output so nothing changes visually.
 */
export function formatCurrency(amount: number, symbol = "$") {
  return `${symbol}${Number(amount).toFixed(2)}`;
}
