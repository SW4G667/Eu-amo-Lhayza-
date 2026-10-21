import type { CheckStatus } from "@/lib/types";
import { Badge } from "@/components/ui/primitives";

export const STATUS_META: Record<
  CheckStatus,
  { label: string; tone: "neutral" | "ok" | "warn" | "danger" | "info" | "lime" | "muted" }
> = {
  available: { label: "livre", tone: "ok" },
  taken: { label: "em uso", tone: "muted" },
  error: { label: "erro", tone: "danger" },
  rate_limited: { label: "limite", tone: "warn" },
  unconfigured: { label: "sem token", tone: "warn" },
  unsupported: { label: "n/d", tone: "muted" },
};

export function StatusBadge({ status }: { status: CheckStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.error;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function scoreTone(score: number): "ok" | "lime" | "neutral" | "muted" {
  if (score >= 85) return "ok";
  if (score >= 70) return "lime";
  if (score >= 55) return "neutral";
  return "muted";
}
