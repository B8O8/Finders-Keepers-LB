import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "gold" | "success" | "danger";

const variants: Record<BadgeVariant, string> = {
  default: "bg-black/5 text-black",
  gold: "bg-[#d4af37]/20 text-[#8a6a12]",
  success: "bg-green-100 text-green-700",
  danger: "bg-red-100 text-red-700",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}