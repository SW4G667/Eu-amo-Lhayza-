"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-white/[0.06] bg-[#0A0C0C]", className)}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.055] px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-200">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[11px] text-bone-600">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

const TONES = {
  ok: "border-mint/25 bg-mint/[0.08] text-mint",
  warn: "border-amberglow/25 bg-amberglow/[0.08] text-amberglow",
  danger: "border-ember/25 bg-ember/[0.08] text-[#FFB4A2]",
  info: "border-[#8B9CFF]/25 bg-[#8B9CFF]/[0.08] text-[#AEB9FF]",
  lime: "border-lime-500/25 bg-lime-400/[0.08] text-lime-300",
  muted: "border-white/[0.07] bg-white/[0.03] text-bone-400",
} as const;

export function Pill({
  tone = "muted",
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-[0.08em]",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function TextField({
  label,
  hint,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.13em] text-bone-600">
        {label}
      </span>
      <input
        {...rest}
        className="h-8 w-full rounded-md border border-white/[0.07] bg-ink-950/70 px-2.5 text-[12px] text-bone-100 outline-none transition-colors placeholder:text-bone-600 focus:border-lime-500/40"
      />
      {hint ? <span className="mt-1 block text-[10px] text-bone-700">{hint}</span> : null}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-left"
    >
      <span
        className={cn(
          "relative h-[18px] w-[32px] shrink-0 rounded-full border transition-colors",
          checked ? "border-lime-500/40 bg-lime-400/30" : "border-white/[0.09] bg-white/[0.05]"
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] h-[12px] w-[12px] rounded-full transition-all",
            checked ? "left-[16px] bg-lime-300" : "left-[2px] bg-bone-500"
          )}
        />
      </span>
      <span className={cn("text-[11.5px]", checked ? "text-bone-100" : "text-bone-500")}>{label}</span>
    </button>
  );
}

export function ActionButton({
  children,
  onClick,
  tone = "default",
  busy,
  disabled,
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "primary" | "danger";
  busy?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      title={title}
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1.5 rounded-md border px-2 text-[11px] transition-colors disabled:opacity-40",
        tone === "primary" && "border-lime-500/30 bg-lime-400/[0.12] text-lime-300 hover:bg-lime-400/[0.2]",
        tone === "danger" && "border-ember/25 bg-ember/[0.07] text-[#FFB4A2] hover:bg-ember/[0.13]",
        tone === "default" &&
          "border-white/[0.08] bg-white/[0.03] text-bone-300 hover:border-white/[0.16] hover:text-bone-100",
        className
      )}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : children}
    </button>
  );
}

export function CopyInline({ value, label = "copiar" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-bone-500 transition-colors hover:text-bone-100"
    >
      {copied ? <Check className="h-2.5 w-2.5 text-mint" /> : <Copy className="h-2.5 w-2.5" />}
      {copied ? "copiado" : label}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-[11.5px] leading-relaxed text-bone-600">{children}</div>
  );
}

export function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function fmtDateTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
