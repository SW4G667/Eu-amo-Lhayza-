"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  className,
  compact,
}: {
  value: string;
  className?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copiar"
      aria-label={`Copiar ${value}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-1 text-[11px] text-bone-400 transition-colors hover:border-white/[0.16] hover:text-bone-100",
        className
      )}
    >
      {copied ? (
        <Check className="h-3 w-3 text-mint" strokeWidth={2.2} />
      ) : (
        <Copy className="h-3 w-3" strokeWidth={1.8} />
      )}
      {compact ? null : <span>{copied ? "Copiado" : "Copiar"}</span>}
    </button>
  );
}
