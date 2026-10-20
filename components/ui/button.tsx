"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-lime-400 text-[#0B0D08] hover:bg-lime-300 active:bg-lime-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_2px_rgba(0,0,0,0.4)]",
  secondary:
    "border border-white/[0.09] bg-ink-800 text-bone-100 hover:border-white/[0.16] hover:bg-ink-750",
  ghost: "text-bone-300 hover:bg-white/[0.045] hover:text-bone-50",
  danger:
    "border border-ember/25 bg-ember/[0.09] text-[#FFA48E] hover:bg-ember/[0.16] hover:border-ember/40",
  subtle: "bg-white/[0.055] text-bone-100 hover:bg-white/[0.09]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[12px] gap-1.5 rounded-[7px]",
  md: "h-9 px-3.5 text-[13px] gap-2",
  lg: "h-11 px-5 text-[13.5px] gap-2",
  icon: "h-8 w-8 rounded-[7px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", loading = false, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
});
