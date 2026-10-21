"use client";

import { useEffect, useState } from "react";
import { clock, timeAgo } from "@/lib/utils";

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function TimeAgo({ ts, className }: { ts: number | null | undefined; className?: string }) {
  const mounted = useMounted();
  return (
    <span className={className} suppressHydrationWarning>
      {mounted ? timeAgo(ts) : "—"}
    </span>
  );
}

export function Clock({ ts, className }: { ts: number | null | undefined; className?: string }) {
  const mounted = useMounted();
  return (
    <span className={className} suppressHydrationWarning>
      {mounted ? clock(ts) : "--:--:--"}
    </span>
  );
}
