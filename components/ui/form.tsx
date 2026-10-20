"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
  trailing,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={htmlFor} className="label-mono text-bone-400">
            {label}
          </label>
          {trailing}
        </div>
      ) : null}
      {children}
      {error ? (
        <p className="text-[11.5px] leading-snug text-[#FF9A82]">{error}</p>
      ) : hint ? (
        <p className="text-[11.5px] leading-snug text-bone-500">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn("field", className)} {...props} />;
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn("field-area", className)} {...props} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn("field appearance-none pr-9", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-bone-500"
          strokeWidth={1.8}
        />
      </div>
    );
  }
);

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        {label ? <p className="text-[13px] font-medium text-bone-100">{label}</p> : null}
        {description ? (
          <p className="text-[11.5px] leading-relaxed text-bone-500">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-40",
          checked
            ? "border-lime-500/50 bg-lime-400/90"
            : "border-white/[0.08] bg-ink-700"
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] h-[16px] w-[16px] rounded-full transition-all duration-200",
            checked ? "left-[19px] bg-[#111507]" : "left-[2px] bg-bone-300"
          )}
        />
      </button>
    </div>
  );
}
