import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

interface ButtonLinkProps {
  children: ReactNode;
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

const base =
  "inline-flex items-center justify-center gap-2 font-semibold no-underline transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border border-black bg-black text-white hover:border-[#d4af37] hover:bg-[#d4af37] hover:text-black",

  secondary:
    "border border-[#d4af37] bg-[#d4af37] text-black hover:border-black hover:bg-black hover:text-white",

  outline:
    "border border-black/15 bg-white text-black hover:border-black hover:bg-black hover:text-white",

  ghost:
    "border border-transparent bg-transparent text-black hover:bg-black/5 hover:text-black",
};

const sizes: Record<ButtonSize, string> = {
  sm: "rounded-xl px-4 py-2 text-sm",
  md: "rounded-2xl px-6 py-3 text-sm",
  lg: "rounded-2xl px-8 py-4 text-base",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        base,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
    >
      {children}
    </Link>
  );
}