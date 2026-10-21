"use client";

import { useEffect, useId, useState } from "react";
import type { Bucket } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Sparkline({
  data,
  className,
  stroke = "#CBEF6E",
  height = 36,
}: {
  data: number[];
  className?: string;
  stroke?: string;
  height?: number;
}) {
  const gradientId = useId().replace(/[:]/g, "");
  const values = data.length ? data : [0, 0];
  const max = Math.max(1, ...values);
  const width = 120;
  const step = width / Math.max(1, values.length - 1);
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - 4 - (value / max) * (height - 9);
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-9 w-full", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function ActivityBars({
  buckets,
  className,
}: {
  buckets: Bucket[];
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const slots = 30;
  const now = mounted ? Math.floor(Date.now() / 60000) * 60000 : 0;
  const series = Array.from({ length: slots }, (_, index) => {
    const t = now - (slots - 1 - index) * 60000;
    if (!mounted) return { t, checks: 0, available: 0, errors: 0 };
    return buckets.find((bucket) => bucket.t === t) ?? { t, checks: 0, available: 0, errors: 0 };
  });
  const max = Math.max(1, ...series.map((entry) => entry.checks));

  return (
    <div className={cn("flex h-[92px] items-end gap-[3px]", className)}>
      {series.map((entry, index) => {
        const height = entry.checks === 0 ? 2 : Math.max(6, (entry.checks / max) * 88);
        const isNow = index === series.length - 1;
        return (
          <div
            key={entry.t}
            className="group relative flex-1"
            suppressHydrationWarning
            title={`${new Date(entry.t).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })} · ${entry.checks} checagens`}
          >
            <div
              className={cn(
                "w-full rounded-[2px] transition-colors",
                entry.checks === 0
                  ? "bg-white/[0.05]"
                  : isNow
                    ? "bg-lime-400"
                    : "bg-lime-500/35 group-hover:bg-lime-500/60"
              )}
              style={{ height }}
            />
            {entry.available > 0 ? (
              <span className="absolute -top-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-mint" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function ProgressBar({
  value,
  className,
  tone = "lime",
}: {
  value: number;
  className?: string;
  tone?: "lime" | "muted";
}) {
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", tone === "lime" ? "bg-lime-400" : "bg-bone-500")}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
