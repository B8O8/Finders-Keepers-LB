import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-sm font-semibold text-black">
          {label}
        </span>
      ) : null}

      <input
        className={cn(
          "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-black outline-none transition focus:border-black",
          error && "border-red-500",
          className,
        )}
        {...props}
      />

      {error ? (
        <span className="mt-2 block text-sm text-red-600">{error}</span>
      ) : null}
    </label>
  );
}