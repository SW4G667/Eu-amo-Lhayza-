"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, Search } from "lucide-react";
import type { AuditEvent } from "@/lib/cloud/types";
import { cn } from "@/lib/utils";
import { Card, Empty, Pill, fmtDateTime } from "./ui";

const SEVERITY_TONE: Record<string, "ok" | "warn" | "danger" | "info" | "muted"> = {
  success: "ok",
  info: "info",
  warn: "warn",
  danger: "danger",
};

export function EventsTab({ events }: { events: AuditEvent[] }) {
  const [term, setTerm] = useState("");
  const [severity, setSeverity] = useState<string>("todas");
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return events.filter((event) => {
      if (severity !== "todas" && event.severity !== severity) return false;
      if (!needle) return true;
      return (
        event.message.toLowerCase().includes(needle) ||
        event.kind.toLowerCase().includes(needle) ||
        (event.actor || "").toLowerCase().includes(needle)
      );
    });
  }, [events, term, severity]);

  const asText = useMemo(
    () =>
      filtered
        .map(
          (event) =>
            `${fmtDateTime(event.createdAt)} [${event.severity.toUpperCase()}] ${event.kind} · ${
              event.actor ?? "-"
            }${event.ip ? ` (${event.ip})` : ""} :: ${event.message}`
        )
        .join("\n"),
    [filtered]
  );

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(asText || "sem eventos");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const blob = new Blob([asText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `atalaia-eventos-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const severities = ["todas", "success", "info", "warn", "danger"];

  return (
    <Card
      title="trilha de auditoria"
      subtitle={`${filtered.length} de ${events.length} eventos · quem entrou, o que mudou`}
      action={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void copyAll()}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[11px] text-bone-300 transition-colors hover:text-bone-100"
          >
            {copied ? <Check className="h-3 w-3 text-mint" /> : <Copy className="h-3 w-3" />}
            copiar log
          </button>
          <button
            type="button"
            onClick={download}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[11px] text-bone-300 transition-colors hover:text-bone-100"
          >
            <Download className="h-3 w-3" />
            baixar
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.045] px-4 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-bone-600" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="buscar evento, ator ou IP"
            className="h-7 w-[220px] rounded-md border border-white/[0.07] bg-ink-950/70 pl-7 pr-2 text-[11.5px] text-bone-100 outline-none placeholder:text-bone-600 focus:border-lime-500/40"
          />
        </div>
        <div className="flex items-center gap-1">
          {severities.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSeverity(item)}
              className={cn(
                "rounded-md px-1.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.08em] transition-colors",
                severity === item ? "bg-white/[0.08] text-bone-100" : "text-bone-600 hover:text-bone-300"
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty>Nada por aqui. Os eventos aparecem conforme o sistema é usado.</Empty>
      ) : (
        <ul className="max-h-[620px] divide-y divide-white/[0.03] overflow-y-auto">
          {filtered.map((event) => (
            <li key={event.id} className="flex items-start gap-3 px-4 py-2">
              <span className="w-[92px] shrink-0 font-mono text-[10px] leading-4 text-bone-600">
                {fmtDateTime(event.createdAt)}
              </span>
              <Pill tone={SEVERITY_TONE[event.severity] ?? "muted"} className="mt-[1px] shrink-0">
                {event.severity}
              </Pill>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] leading-4 text-bone-200">{event.message}</p>
                <p className="font-mono text-[9.5px] text-bone-700">
                  {event.kind} · {event.actor ?? "sistema"}
                  {event.ip ? ` · ${event.ip}` : ""}
                  {event.licenseId ? ` · lic ${event.licenseId}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
