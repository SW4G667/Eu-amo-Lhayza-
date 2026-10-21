import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
  flat,
}: {
  className?: string;
  children: ReactNode;
  flat?: boolean;
}) {
  return <div className={cn(flat ? "panel-flat" : "panel", className)}>{children}</div>;
}

export function PanelHeader({
  title,
  subtitle,
  action,
  className,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] px-5 py-3.5",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? <span className="text-bone-400">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-medium text-bone-100">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11.5px] text-bone-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

type BadgeTone = "neutral" | "ok" | "warn" | "danger" | "info" | "lime" | "muted";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-white/[0.08] bg-white/[0.04] text-bone-300",
  ok: "border-mint/25 bg-mint/[0.08] text-mint",
  warn: "border-amberglow/25 bg-amberglow/[0.08] text-amberglow",
  danger: "border-ember/25 bg-ember/[0.08] text-[#FF9A82]",
  info: "border-[#8B9CFF]/25 bg-[#8B9CFF]/[0.08] text-[#AEB9FF]",
  lime: "border-lime-500/25 bg-lime-400/[0.08] text-lime-300",
  muted: "border-white/[0.05] bg-transparent text-bone-500",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] font-mono text-[10px] uppercase tracking-[0.08em]",
        badgeTones[tone],
        className
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function StatusDot({
  tone = "ok",
  pulse,
  className,
}: {
  tone?: "ok" | "warn" | "danger" | "idle" | "info";
  pulse?: boolean;
  className?: string;
}) {
  const colors = {
    ok: "bg-mint",
    warn: "bg-amberglow",
    danger: "bg-ember",
    idle: "bg-bone-500",
    info: "bg-[#8B9CFF]",
  };
  return (
    <span className={cn("relative flex h-2 w-2 shrink-0", className)}>
      {pulse ? (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-40",
            colors[tone]
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", colors[tone])} />
    </span>
  );
}

export function SectionLabel({
  children,
  className,
  right,
}: {
  children: ReactNode;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span className="label-mono">{children}</span>
      {right}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon ? (
        <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-bone-400">
          {icon}
        </div>
      ) : null}
      <p className="text-[13px] font-medium text-bone-200">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-bone-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-bone-400">
      {children}
    </kbd>
  );
}
